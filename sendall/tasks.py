from __future__ import absolute_import, unicode_literals
import celery
from celery import shared_task
import json
from uuid import uuid4
import asyncio
from .utils import _send_message, get_dialogs
import logging
from django.conf import settings

from .models import SendMessageTask

if settings.DEBUG:
    logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@shared_task
def send_message(session, contacts, message, markdown, delay=5):
    try:
        # result = asyncio.run(_send_message(session, contacts, message, markdown, delay))
        asyncio.run(_send_message(session, contacts, message, markdown, delay))
    except AttributeError:
        loop = asyncio.new_event_loop()
        # result = loop.run_until_complete(_send_message(session, contacts, message, markdown, delay))
        loop.run_until_complete(_send_message(session, contacts, message, markdown, delay))
        loop.close()
    logger.debug(f"uuid = {send_message.request.id}")
    current_task = SendMessageTask.objects.filter(uuid=str(send_message.request.id))
    current_task.done = True
    current_task.save()


@shared_task
def get_dialogs_task(session):
    logger.debug(f"uuid = {get_dialogs_task.request.id}")
    dialogs = get_dialogs(session)
    return dialogs

