from __future__ import absolute_import, unicode_literals
import celery
from celery import shared_task
import json
from uuid import uuid4
import asyncio
from .utils import _send_message, get_dialogs


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
def get_dialogs_task(session):
    dialogs = get_dialogs(session)
    return dialogs