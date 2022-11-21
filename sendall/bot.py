import asyncio
import requests
import pytz
from datetime import datetime
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from django.core.exceptions import ObjectDoesNotExist
from django.core.cache import cache
# from telethon.tl.types import PeerChat
from .models import Session, ReplyMessageTask, DeadlineMessageSettings
from django.conf import settings
import logging
logger = logging.getLogger(__name__)
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
bot = TelegramClient(None, settings.API_ID, settings.API_HASH).start(bot_token=settings.BOT_TOKEN)

def str_no_none(obj):
    if obj == None:
        return ''
    return str(obj)

async def _get_user(session):
    client = TelegramClient(StringSession(session.session), settings.API_ID, settings.API_HASH)
    await client.connect()
    user = await client.get_me()
    return user.id


async def notify_user(session, msg, dialog_id=0):
    chat_id = await _get_user(session)
    METHOD = 'sendMessage'
    url = "https://api.telegram.org/bot{}/{}".format(settings.BOT_TOKEN, METHOD)
    body = ''
    logger.info("sending")
    if dialog_id != 0:
        body = {
            'chat_id': chat_id,
            'text': msg,
            'reply_markup': {
                'inline_keyboard': [[
                    {
                        'text': "Cancel message", 'callback_data': f"cancel-{dialog_id}"
                    }
                ]]
            }
        }
    else:
        body = {
            'chat_id': chat_id,
            'text': msg,
        }

    requests.post(url, json=body)

@bot.on(events.NewMessage(pattern="/start"))
async def start(event):
    sender = await event.get_sender()
    try:
        s = Session.objects.get(name=str_no_none(sender.first_name) + ' ' + str_no_none(sender.last_name))
        s.set_bot_settings({'active': True, 'silent': False})
        keys = cache.keys(f"{sender.id}-*")
        logger.info(keys)
        for key in keys:
            cache.set(key, datetime.now().astimezone(pytz.UTC).isoformat(), timeout=None)
        text = """
Message replying service has been started. You'll get notifications, when the bot will start task
Bot commands:
- `/stop`: stop service, `/start` if you want to resume
- `/silent`: stop log every task start and end
- `/list_messages`: show list current reply messages
- `/message` <text>: add new reply message
- `/deadline <number>`: set deadline time to reply message
"""
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/stop"))
async def stop(event):
    sender = await event.get_sender()
    try:
        s = Session.objects.get(name=str_no_none(sender.first_name) + ' ' + str_no_none(sender.last_name))
        s.set_bot_settings({'active': False, 'silent': False})
        text = "Message replying service stopped"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/silent"))
async def silent(event):
    sender = await event.get_sender()
    try:
        s = Session.objects.get(name=str_no_none(sender.first_name) + ' ' + str_no_none(sender.last_name))
        s.set_bot_settings({'active': True, 'silent': True})
        text = "Now bot won't notify you about new tasks"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/list_messages"))
async def messages(event):
    sender = await event.get_sender()
    try:
        s = Session.objects.get(name=str_no_none(sender.first_name) + ' ' + str_no_none(sender.last_name))
        d = DeadlineMessageSettings.objects.get(session=s)
        messages = d.get_messages()
        logger.info(f'messages {messages}')
        text = f"Current reply messages pool:{chr(10) + chr(10)}__{(chr(10) + chr(10)).join(messages)}__"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/message"))
async def message(event):
    sender = await event.get_sender()
    splitted_text = event.raw_text.split(' ')
    if len(splitted_text) < 2:
        text = "Error, text of reply message is empty"
        await bot.send_message(sender, text)
        return
    try:
        s = Session.objects.get(name=str_no_none(sender.first_name) + ' ' + str_no_none(sender.last_name))
        d = DeadlineMessageSettings.objects.get(session=s)
        messages = d.get_messages()
        messages.append(' '.join(splitted_text[1:]))
        d.set_messages(messages)
        d.save()
        text = f"Successfully added new reply message: __{' '.join(splitted_text[1:])}__"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/deadline"))
async def deadline(event):
    sender = await event.get_sender()
    splitted_text = event.raw_text.split(' ')
    if len(splitted_text) < 2:
        text = "Error, place a number in hours for deadline time"
        await bot.send_message(sender, text)
        return
    time = 0
    try:
        time = int(splitted_text[1])
    except ValueError:
        text = "Error, place a number in hours for deadline time"
        await bot.send_message(sender, text)
        return
    try:
        s = Session.objects.get(name=str_no_none(sender.first_name) + ' ' + str_no_none(sender.last_name))
        d = DeadlineMessageSettings.objects.get(session=s)
        d.deadline_time = time
        d.save()
        text = f"Successfully changed deadline time to {time} minutes"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage)
async def handleMsg(event):
    if event.fwd_from == None:
        return
    sender = await event.get_sender()
    dialog_id = event.fwd_from.from_id.user_id
    logger.info(dialog_id)
    try:
        s = Session.objects.get(name=str_no_none(sender.first_name) + ' ' + str_no_none(sender.last_name))
        t = ReplyMessageTask.objects.filter(dialog_id=dialog_id, session=s)
        if len(t) == 0:
            ReplyMessageTask.objects.create(
                dialog_id=dialog_id,
                session=s,
                start_time=event.date,
            )
        else:
            t[0].start_time = event.date
            t[0].save()
        await notify_user(s, "Successfully created new reply task", dialog_id)
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
        await bot.send_message(sender, text)


@bot.on(events.CallbackQuery(pattern="cancel"))
async def cancel(event):
    sender = await event.get_sender()
    dialog_id = int(event.data.decode('utf-8').split('-')[1])
    try:
        s = Session.objects.get(name=str_no_none(sender.first_name) + ' ' + str_no_none(sender.last_name))
        try:
            d = ReplyMessageTask.objects.get(session=s, dialog_id=dialog_id)
            d.delete()
        except ObjectDoesNotExist:
            text = "This task is already done or canceled"
            await event.answer()
            await bot.send_message(sender, text)
            return
        text = "You have canceled message"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)
    await event.answer()
