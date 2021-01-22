import asyncio
import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.urls import reverse
from telethon import TelegramClient
from telethon.errors import (FloodWaitError, PasswordHashInvalidError,
                             PhoneCodeExpiredError, PhoneNumberInvalidError,
                             SessionPasswordNeededError)
from telethon.sessions import StringSession
from telethon.tl.types import PeerUser

logger = logging.getLogger(__name__)


async def _send_code_request(phone):
    client = TelegramClient(StringSession(), settings.API_ID, settings.API_HASH)
    await client.connect()
    # await client.start()
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
    # if not res.phone_registered:
    #     return {
    #         'state': 'error',
    #         'session': client.session.save(),
    #         'reason': '',
    #         'errors': ['This phone number is not registered']
    #     }
    session = client.session.save()
    cache.set(phone, res.phone_code_hash)
    return {
        'state': 'ok',
        'session': session
    }


def send_code_request(session, phone):
    try:
        result = asyncio.run(_send_code_request(phone))
    except AttributeError:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(_send_code_request(phone))
        loop.close()

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
    except PasswordHashInvalidError:
        return {
            'state': 'error',
            'session': client.session.save(),
            'reason': '',
            'errors': ['The password you entered is invalid']
        }
    except PhoneCodeExpiredError:
        return {
            'state': 'error',
            'session': client.session.save(),
            'reason': '',
            'errors': ['The confirmation code has expired']
        }
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
    try:
        result = asyncio.run(_sign_in(session.session, phone, code, password))
    except AttributeError:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(_sign_in(session.session, phone, code, password))
        loop.close()

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
    if not await client.is_user_authorized():
        return [{'not_logged': True}]

    chats = []
    async for dialog in client.iter_dialogs(limit=None, ignore_pinned=False):
        # if dialog.is_user:
        #     chats.append(dialog)
        if not dialog.is_channel:
            chats.append(dialog)

    return chats


def get_dialogs(session):
    try:
        dialogs = asyncio.run(_get_dialogs(session))
    except AttributeError:
        loop = asyncio.new_event_loop()
        dialogs = loop.run_until_complete(_get_dialogs(session))
        loop.close()

    if isinstance(dialogs[0], dict):
        return dialogs

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


def length_strip(string, block_size=4096):
    if len(string) > block_size:
        return (string[:block_size], *length_strip(string[block_size:], block_size))
    return (string,)


def cut_message(msg, block_size=4096):
    output = ['']
    index = 0
    msgs = msg.split('\n')
    for m in msgs:
        if len(m) >= block_size:
            cutted_m_s = length_strip(m, block_size=block_size)
            for cutted_m in cutted_m_s:
                if len(output[index]) + len(cutted_m) <= block_size - 1:
                    output[index] += cutted_m
                else:
                    index += 1
                    output.append(cutted_m)
        elif (len(output[index]) + len(m)) > block_size:
            index += 1
            output.append(m)
        else:
            output[index] += m
        output[index] += '\n'
    if '' in output:
        output.remove('')
    return output


def pre_serialize_tasks(tasks):
        pre_serialize_task = lambda task: {
            'uuid': task.uuid,
            'session': {
                'id': task.session.id,
                'username': task.session.username,
                'name': task.session.name,
                'phone': task.session.phone,
            },
            'eta': task.eta,
            'contacts': eval(task.contacts),
            'message': task.message,
            'markdown': task.markdown,
            'done': task.done,
        }
        return list(map(pre_serialize_task, tasks))


async def _send_message(session, contacts, message, markdown, delay=5):
    client = TelegramClient(StringSession(session), settings.API_ID, settings.API_HASH)
    await client.connect()
    client.parse_mode = 'md' if markdown else None
    await client.get_dialogs()

    messages = cut_message(message)
    for contact in contacts:
        try:
            entity = await client.get_entity(PeerUser(contact))
            for msg in messages:
                await client.send_message(entity, message=msg)
                time.sleep(delay)
        except BaseException as e:
            logger.error(e)
        except:
            pass

    return JsonResponse({'state': 'ok'})
