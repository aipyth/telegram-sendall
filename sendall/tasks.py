from __future__ import absolute_import, unicode_literals

from celery import shared_task
import json
from uuid import uuid4
import asyncio
from .utils import _send_message, get_dialogs
from .models import ScheduledDialogsTask


@shared_task
def send_message(session, contacts, message, markdown, delay=5):
    try:
        result = asyncio.run(_send_message(session, contacts, message, markdown, delay))
    except AttributeError:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(_send_message(session, contacts, message, markdown, delay))
        loop.close()
    # return result


@shared_task
def get_dialogs(session, unic):
    task = ScheduledDialogsTask.get(uuid=unic)
    dialogs = get_dialogs(session)
    task.result = json.dumps(dialogs)
    task.ready = True
    task.save()