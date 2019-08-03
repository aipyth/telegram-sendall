from __future__ import absolute_import, unicode_literals

from celery import shared_task

import asyncio
from .utils import _send_message

@shared_task
def send_message(session, contacts, message, markdown, delay=5):
    try:
        result = asyncio.run(_send_message(session, contacts, message, markdown, delay))
    except AttributeError:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(_send_message(session, contacts, message, markdown, delay))
        loop.close()
    # return result