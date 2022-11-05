from __future__ import absolute_import, unicode_literals
from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
import random
import asyncio
from .utils import _send_message, get_dialogs, read_last_messages, check_substring
from telegram_sendall.celery import app as celery_app
from .models import SendMessageTask, DeadlineMessageSettings, Session, ReplyMessageTask
from .bot import bot, notify_user
import logging
logger = logging.getLogger(__name__)

check_period = timedelta(seconds=20)

celery_app.conf.beat_schedule = {
    'add-every-30-seconds': {
        'task': 'sendall.tasks.check_new_messages',
        'schedule': check_period,
    },
}

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
    for session in Session.objects.all():
        deadline_msg_settings, _ = DeadlineMessageSettings.objects.get_or_create(session=session)
        dialogs = get_dialogs(session.session)
        for dialog in dialogs:
            # Check for blacklist
            blacklist = session.get_blacklist()
            if len(blacklist) > 0:
                if dialog['id'] in list(map(lambda x: x['id'], blacklist)):
                    continue

            messages = read_last_messages(session.session, dialog, check_period)
            logger.info(f"messages {messages}")
            logger.info(f"dialog, {dialog}")
            if len(messages['my']) == 0 and len(messages['not-my']) == 0:
                break
            # Delete reply task if another user sent some msg
            reply_task = ReplyMessageTask.objects.filter(dialog_id=dialog["id"], done=False)
            if len(reply_task) > 0 and len(messages['not-my']) > 0:
                logger.info(f"Session={session}: Denied reply message task to {dialog['name']}")
                bot.notify_user(session, f"Denied reply message task to {dialog['name']}")
                ReplyMessageTask.objects.delete(dialog_id=dialog.id, done=False)
            # Set new reply task if current user sent some trigger_substring
            has_price, price_msg = check_substring(messages['my'], deadline_msg_settings.trigger_substring)
            if has_price:
                if len(messages['not-my']) == 0:
                    ReplyMessageTask.objects.create(
                        dialog_id=dialog['id'],
                        session=session,
                        start_time=price_msg['date'],
                    )
                    logger.info(f"Session={session}: Added reply message task to {dialog['name']}")
                    bot.notify_user(session, f"Added reply message task to {dialog['name']}")

                for msg in messages['not-my']:
                    if msg['date'] < price_msg['date']:
                        ReplyMessageTask.objects.create(
                            dialog_id=dialog['id'],
                            session=session,
                            start_time=price_msg['date'],
                        )
                        logger.info(f"Session={session}: Added reply message task to {dialog['name']}")
                        bot.notify_user(session, f"Added reply message task to {dialog['name']}")
                        break

        # Execute all reply message tasks if time is up
        for task in ReplyMessageTask.objects.filter(session=session, done=False):
            if (timezone.now() - task.start_time) >= timedelta(minutes=deadline_msg_settings.deadline_time):
                message = random.choice(deadline_msg_settings.get_messages())
                try:
                    dialog = next(dialog for dialog in dialogs if task.dialog_id == dialog['id'])
                except StopIteration:
                    return
                send_message.delay(session.session, [dialog['id']], message, markdown=True)
                logger.info(f"Session={session}: Sent reply message to {dialog['name']}, text {message}")
                task.done = True
                task.save()
                notify_user(session, f"Sent reply message to {dialog['name']}, text {message}")


@celery_app.task
def get_dialogs_task(session):
    dialogs = get_dialogs(session)
    return dialogs
