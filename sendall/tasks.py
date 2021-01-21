from __future__ import absolute_import, unicode_literals
import celery
from celery import shared_task
import json
from uuid import uuid4
import asyncio
from .utils import _send_message, get_dialogs
import logging
from django.conf import settings
from telegram_sendall.celery import app as celery_app

from .models import SendMessageTask

@celery_app.task(bind=True)
def send_message(self, session, contacts, message, markdown, delay=5):
    try:
        # result = asyncio.run(_send_message(session, contacts, message, markdown, delay))
        asyncio.run(_send_message(session, contacts, message, markdown, delay))
    except AttributeError:
        loop = asyncio.new_event_loop()
        # result = loop.run_until_complete(_send_message(session, contacts, message, markdown, delay))
        loop.run_until_complete(_send_message(session, contacts, message, markdown, delay))
        loop.close()
    current_task = SendMessageTask.objects.get(uuid=str(self.request.id))
    current_task.done = True
    current_task.save()


@celery_app.task
def get_dialogs_task(session):
    dialogs = get_dialogs(session)
    return dialogs

