from __future__ import absolute_import, unicode_literals
import pytz
from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
import random
import asyncio
import time
import os
from contextlib import contextmanager
from django.core.cache import cache
from .utils import (_send_message, read_last_messages, notify_user,
                    check_substring, get_dialogs_and_user, get_dialogs)
from telegram_sendall.celery import app as celery_app
from .models import (SendMessageTask, DeadlineMessageSettings,
                     Session, ReplyMessageTask)
import logging
logger = logging.getLogger(__name__)

check_period = timedelta(minutes=1, seconds=30)
cache.set('check_period', str({'minutes': 1, 'seconds': 30}))
if os.environ.get('DEBUG') == 'True':
    check_period = timedelta(seconds=45)

celery_app.conf.beat_schedule = {
    'add-every-30-seconds': {
        'task': 'sendall.tasks.check_new_messages',
        'schedule': check_period,
    },
}

LOCK_EXPIRE = 60 * 10


@contextmanager
def memcache_lock(lock_id, oid):
    timeout_at = time.monotonic() + LOCK_EXPIRE - 3
    # logger.info(f"{lock_id=} {oid=}")
    # status = cache.add(lock_id, oid, LOCK_EXPIRE)
    # logger.info(f"status {status}")
    status = cache.get(lock_id)
    if status is None:
        cache.set(lock_id, oid)
    available = status is None
    # logger.info(f"{available=}")
    try:
        yield available
    finally:
        if time.monotonic() < timeout_at and available:
            cache.delete(lock_id)


@celery_app.task(bind=True)
def send_message(self, session, contacts, message, markdown, delay=5):
    try:
        asyncio.run(_send_message(session, contacts, message, markdown, delay))
    except AttributeError:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            _send_message(session, contacts, message, markdown, delay)
        )
        loop.close()
    try:
        current_task = SendMessageTask.objects.get(uuid=str(self.request.id))
        current_task.done = True
        current_task.save()
    except ObjectDoesNotExist:
        pass


@celery_app.task
def check_new_messages():
    def run_task():
        try:
            asyncio.run(_check_new_messages())
        except AttributeError:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                _check_new_messages()
            )
            loop.close()

    lock_id = '{0}-lock'.format('check_new_messages')
    with memcache_lock(lock_id, '1') as acquired:
        if acquired:
            logger.info('Acquired lock on check_new_messages')
            return run_task()
    logger.info('Task check_new_messages is already being executed')


@celery_app.task
def get_dialogs_task(session):
    dialogs, _ = get_dialogs(session)
    return dialogs


def create_or_update_task(session, dialog, start):
    t = ReplyMessageTask.objects.filter(
        dialog_id=dialog['id'], session=session)
    if len(t) == 0:
        ReplyMessageTask.objects.create(
            dialog_id=dialog['id'],
            session=session,
            start_time=start,
        )
    else:
        t[0].start_time = start
        t[0].save()


def in_blacklist(session, dialog):
    blacklist = session.get_blacklist()
    if len(blacklist) > 0:
        return dialog['id'] in list(map(lambda x: x['id'], blacklist))
    return False


def is_worktime():
    return timezone.now().hour >= 8 - 2 and timezone.now().hour <= 20 - 2


def check_for_execution(session, dialogs, deadline_msg_settings):
    reply_notifications = []
    for task in ReplyMessageTask.objects.filter(session=session):
        if (timezone.now().astimezone(pytz.UTC) - task.start_time.astimezone(pytz.UTC)) >= timedelta(minutes=deadline_msg_settings.deadline_time) and is_worktime():
            msgs = deadline_msg_settings.get_messages()
            if len(msgs) == 0:
                break
            message = random.choice(deadline_msg_settings.get_messages())
            try:
                dialog = next(dialog for dialog in dialogs if task.dialog_id == dialog['id'])
            except StopIteration:
                continue
            send_message.delay(
                session.session, [dialog['id']], message, markdown=True)
            task.delete()
            reply_notifications.append(f"Sent reply message to {dialog['name']}, text:\n{message}")
    return reply_notifications


async def _check_new_messages():
    MAX_TRIGGER_MESSAGE_LENGTH = 100
    TRIGGER_MESSAGE_CONTAINS = '(\\d\\d\\d.*[\\w\\s]\\?\\?$)|(^\\d\\d\\d\\?\\?$)'

    for session in Session.objects.all():
        logger.info(f"Session={session}; {session.get_bot_settings()}")
        if not session.get_bot_settings()['active']:
            continue
        deadline_msg_settings, _ = DeadlineMessageSettings.objects.get_or_create(session=session)
        dialogs, client = await get_dialogs_and_user(session)
        names = list(map(lambda x: x['name'], dialogs))[:12]
        logger.info(names)
        i = 0
        for dialog in dialogs:
            if in_blacklist(session, dialog):
                logger.info(f'skipping as in blacklist {dialog}')
                continue
            entity = await client.get_entity(dialog['id'])
            messages = await read_last_messages(client, entity)
            logger.info(f'Checked {entity.first_name if hasattr(entity, "first_name") else entity.title}')
            if len(messages['my']) == 0 and len(messages['not-my']) == 0:
                if i <= 20:
                    i += 1
                    continue
                else:
                    break

            reply_task = ReplyMessageTask.objects.filter(dialog_id=dialog["id"])
            if len(messages['not-my']) > 0 and len(reply_task) > 0:
                reply_task.delete()
                logger.info(f"Session={session}: Denied reply message task to {dialog['name']}")
                await notify_user(session, f"Denied reply message task to {dialog['name']}")
                continue

            has_price, price_msg = check_substring(
                messages['my'], TRIGGER_MESSAGE_CONTAINS)

            if not has_price:
                continue

            logger.info("Gor price message")
            logger.info(f"Dialog {dialog['name']}: {price_msg['text']}")

            if len(messages['not-my']) == 0:
                create_or_update_task(session, dialog, price_msg['date'].astimezone(pytz.UTC))
                logger.info(f"Session={session}: Added reply message task to {dialog['name']}")
                await notify_user(
                    session, f"Added reply message task to {dialog['name']}", dialog['id'])

            for msg in messages['not-my']:
                if msg['date'] < price_msg['date']:
                    create_or_update_task(session, dialog, price_msg['date'].astimezone(pytz.UTC))
                    logger.info(f"Session={session}: Added reply message task to {dialog['name']}")
                    await notify_user(
                        session, f"Added reply message task to {dialog['name']}", dialog['id'])
                    break

        logger.info(f"Current tasks for Session={session}: {list(ReplyMessageTask.objects.filter(session=session))}")
        reply_notifications = check_for_execution(session, dialogs, deadline_msg_settings)
        if len(reply_notifications) > 0:
            logger.info(f"Session={session}: {reply_notifications}")
            await notify_user(session, '\n'.join(reply_notifications))
