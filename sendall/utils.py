import asyncio
import time

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.urls import reverse
from telethon import TelegramClient
from telethon.errors import (FloodWaitError, PhoneNumberInvalidError,
                             SessionPasswordNeededError)
from telethon.sessions import StringSession
from telethon.tl.types import PeerUser

import logging
logger = logging.getLogger(__name__)

async def _send_code_request(phone):
    client = TelegramClient(StringSession(), settings.API_ID, settings.API_HASH)
    await client.connect()
    try:
        res = await client.send_code_request(phone)
    except PhoneNumberInvalidError:
        return {
            'state': 'error',
            'session': client.session.save(),
            'reason': '',
            'errors': ['The phone number is invalid.'],
        }
    except FloodWaitError as e:
        return {
            'state': 'error',
            'session': client.session.save(),
            'reason': '',
            'errors': [str(e).split('(')[0]],
        }
    if not res.phone_registered:
        return {
            'state': 'error',
            'session': client.session.save(),
            'reason': '',
            'errors': ['This phone number is not registered']
        }
    session = client.session.save()
    cache.set(phone, res.phone_code_hash)
    return {
        'state': 'ok',
        'session': session
    }


def send_code_request(session, phone):
    result = asyncio.run(_send_code_request(phone))

    session.update_session(result.pop('session'))
    return JsonResponse(result)


async def _sign_in(session, phone, code, password=None):
    client = TelegramClient(StringSession(session), settings.API_ID, settings.API_HASH)
    await client.connect()
    phone_code_hash = cache.get(phone)
    if not phone_code_hash:
        return {
            'state': 'error',
            'session': client.session.save(),
            'reason': 'code-retry',
            'errors': ['New code request needed'],
        }
    try:
        if code and password:
            account = await client.sign_in(phone, password=password)
        else:
            account = await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
    except SessionPasswordNeededError:
        return {
            'state': 'error',
            'session': client.session.save(),
            'reason': 'Needed password.',
            'errors': [],
        }
    except FloodWaitError as e:
        return {
            'state': 'error',
            'session': client.session.save(),
            'reason': '',
            'errors': [str(e).split('(')[0]],
        }
    session = client.session.save()
    client.disconnect()
    return {
        'state': 'ok',
        'account': account,
        'session': session,
        'redirect': reverse('sessions'),
    }

def sign_in(session, phone, code, password=None):
    result = asyncio.run(_sign_in(session.session, phone, code, password))
    print(phone, code, password)
    session.update_session(result.pop('session'))
    if result['state'] == 'ok':
        account = result.pop('account')
        # check if `account` is the right object when we pass code without password when 2fa active
        # ^^ already done! ^^
        session.name = str_no_none(account.first_name) + ' ' + str_no_none(account.last_name)
        session.username = str_no_none(account.username)
        session.set_active()
    return JsonResponse(result)


async def _get_dialogs(session):
    client = TelegramClient(StringSession(session), settings.API_ID, settings.API_HASH)
    await client.connect()
    chats = []
    async for dialog in client.iter_dialogs(limit=None, ignore_pinned=False):
        if dialog.is_user:
            chats.append(dialog)
        
    return chats


def get_dialogs(session):
    dialogs = asyncio.run(_get_dialogs(session.session))
    serialized_dialogs = serialize_dialogs(dialogs)
    return serialized_dialogs

def serialize_dialogs(dialogs):
    return [
        {
            'id': dialog.id,
            'name': dialog.name,
            'unread': dialog.unread_count,
            'message': dialog.message.message,
        } for dialog in dialogs
    ]

def str_no_none(obj):
    if obj == None:
        return ''
    return str(obj)

async def _send_message(session, contacts, message, markdown, delay=5):
    client = TelegramClient(StringSession(session), settings.API_ID, settings.API_HASH)
    await client.connect()
    client.parse_mode = 'md' if markdown else None
    await client.get_dialogs()
    for contact in contacts:
        entity = await client.get_entity(PeerUser(contact))
        await client.send_message(entity, message=message)
        time.sleep(delay)

    return JsonResponse({'state': 'ok'})

def send_message(session, contacts, message, markdown):
    logger.debug("Sending messages")
    result = asyncio.run(_send_message(session.session, contacts, message, markdown))
    return result
