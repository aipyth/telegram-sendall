from __future__ import absolute_import, unicode_literals
from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
import random
import asyncio
import time
from contextlib import contextmanager
from django.core.cache import cache
from .utils import _send_message, _get_dialogs, _read_last_messages, check_substring, get_client, serialize_dialogs, get_dialogs
from telegram_sendall.celery import app as celery_app
from .models import SendMessageTask, DeadlineMessageSettings, Session, ReplyMessageTask
from .bot import notify_user
import logging
logger = logging.getLogger(__name__)

check_period = timedelta(seconds=200)
LOCK_EXPIRE = 60 * 10

celery_app.conf.beat_schedule = {
    'add-every-30-seconds': {
        'task': 'sendall.tasks.check_new_messages',
        'schedule': check_period,
    },
}

@contextmanager
def memcache_lock(lock_id, oid):
    timeout_at = time.monotonic() + LOCK_EXPIRE - 3
    status = cache.add(lock_id, oid, LOCK_EXPIRE)
    try:
        yield status
    finally:
        if time.monotonic() < timeout_at and status:
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

async def _check_new_messages():
    logger.debug(f"All sessions: {Session.objects.all()}")
    for session in Session.objects.all():
        logger.debug(f"Bot settings: {session.get_bot_settings()} for session {session}")
        if not session.get_bot_settings()['active']:
            continue
        deadline_msg_settings, _ = DeadlineMessageSettings.objects.get_or_create(session=session)
        dialogs, client = await _get_dialogs(session.session)
        if type(dialogs[0]) is dict:
            if 'not_logged' in dialogs[0]:
                continue
        dialogs = serialize_dialogs(dialogs)
        for dialog in dialogs:
            # Check for blacklist
            blacklist = session.get_blacklist()
            if len(blacklist) > 0:
                if dialog['id'] in list(map(lambda x: x['id'], blacklist)):
                    continue
            entity = await client.get_entity(dialog['id'])
            messages = await _read_last_messages(client, entity, check_period)
            if len(messages['my']) == 0 and len(messages['not-my']) == 0:
                break
            # Delete reply task if another user sent some msg
            reply_task = ReplyMessageTask.objects.filter(dialog_id=dialog["id"])
            if len(reply_task) > 0 and len(messages['not-my']) > 0:
                logger.info(f"Session={session}: Denied reply message task to {dialog['name']}")
                await notify_user(session, f"Denied reply message task to {dialog['name']}")
                reply_task.delete()
            # Set new reply task if current user sent some trigger_substring
            has_price, price_msg = check_substring(messages['my'], deadline_msg_settings.trigger_substring)
            if len(price_msg):
                has_price = False
            if has_price:
                logger.debug("HAS PRICE MESSAGE!")
                if len(messages['not-my']) == 0:
                    t = ReplyMessageTask.objects.filter(dialog_id=dialog['id'], session=session)
                    if len(t) == 0:
                        ReplyMessageTask.objects.create(
                            dialog_id=dialog['id'],
                            session=session,
                            start_time=price_msg['date'],
                        )
                    else:
                        t[0].start_time = price_msg['date']
                        t[0].save()
                    logger.info(f"Session={session}: Added reply message task to {dialog['name']}")
                    await notify_user(session, f"Added reply message task to {dialog['name']}", dialog['id'])

                for msg in messages['not-my']:
                    if msg['date'] < price_msg['date']:
                        t = ReplyMessageTask.objects.filter(dialog_id=dialog['id'], session=session)
                        if len(t) == 0:
                            ReplyMessageTask.objects.create(
                                dialog_id=dialog['id'],
                                session=session,
                                start_time=price_msg['date'],
                            )
                        else:
                            t[0].start_time = price_msg['date']
                            t[0].save()
                        logger.info(f"Session={session}: Added reply message task to {dialog['name']}")
                        await notify_user(session, f"Added reply message task to {dialog['name']}", dialog['id'])
                        break

        # Execute all reply message tasks if time is up
        logger.info(ReplyMessageTask.objects.filter(session=session))
        logger.info(f"Current hours: {timezone.now().hour + 2}")

        def is_worktime():
            return timezone.now().hour >= 8 - 2 and timezone.now().hour <= 20 - 2

        for task in ReplyMessageTask.objects.filter(session=session):
            if (timezone.now() - task.start_time) >= timedelta(minutes=deadline_msg_settings.deadline_time) and is_worktime():
                msgs = deadline_msg_settings.get_messages()
                logger.info(msgs)
                if len(msgs) == 0:
                    break
                message = random.choice(deadline_msg_settings.get_messages())
                try:
                    dialog = next(dialog for dialog in dialogs if task.dialog_id == dialog['id'])
                except StopIteration:
                    return
                send_message.delay(session.session, [dialog['id']], message, markdown=True)
                logger.info(f"Session={session}: Sent reply message to {dialog['name']}, text {message}")
                task.delete()
                await notify_user(session, f"Sent reply message to {dialog['name']}, text:\n{message}")

@celery_app.task
def check_new_messages():
    try:
        asyncio.run(_check_new_messages())
    except AttributeError:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            _check_new_messages()
        )
        loop.close()

@celery_app.task
def get_dialogs_task(session):
    dialogs, _ = get_dialogs(session)
    return dialogs
