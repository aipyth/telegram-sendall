import asyncio
from telethon import TelegramClient, events
# from telethon.sessions import StringSession
from django.core.exceptions import ObjectDoesNotExist
# from telethon.tl.types import PeerChat
from .models import Session, DeadlineMessageSettings
from django.conf import settings
import logging
logger = logging.getLogger(__name__)
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
bot = TelegramClient(None, settings.API_ID, settings.API_HASH).start(bot_token=settings.BOT_TOKEN)

async def _notify_user(session, msg):
    return
    # session_settings = session.get_bot_settings()
    # logger.info(session_settings['active'])
    # if session_settings['active'] and not session_settings['silent']:
    #     client = TelegramClient(StringSession(session.session), settings.API_ID, settings.API_HASH)
    #     await client.connect()
    #     user = await client.get_me()
    #     logger.info("BEFORE MESSAGE SENT")
    #     res = await bot.send_message(user, message=msg)
    #     logger.info(res)
    #     logger.info('MESSAGE SENT')

def notify_user(session, msg):
    try:
        asyncio.run(_notify_user(session, msg))
    except AttributeError:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_notify_user(session, msg))
        loop.close()

@bot.on(events.NewMessage(pattern="/start"))
async def start(event):
    sender = await event.get_sender()
    try:
        s = Session.objects.get(name=sender.first_name + ' ' + sender.last_name)
        s.set_bot_settings({'active': True, 'silent': False})
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
        s = Session.objects.get(name=sender.first_name + ' ' + sender.last_name)
        s.set_bot_settings({'active': False, 'silent': False})
        text = "Message replying service stopped"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/silent"))
async def silent(event):
    sender = await event.get_sender()
    try:
        s = Session.objects.get(name=sender.first_name + ' ' + sender.last_name)
        s.set_bot_settings({'active': True, 'silent': True})
        text = "Now bot won't notify you about new tasks"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/list_messages"))
async def messages(event):
    sender = await event.get_sender()
    try:
        s = Session.objects.get(name=sender.first_name + ' ' + sender.last_name)
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
        s = Session.objects.get(name=sender.first_name + ' ' + sender.last_name)
        d = DeadlineMessageSettings.objects.get(session=s)
        messages = d.get_messages()
        messages.append(splitted_text[1])
        logger.info(messages)
        d.set_messages(messages)
        d.save()
        text = f"Successfully added new reply message: __{splitted_text[1]}__"
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
        s = Session.objects.get(name=sender.first_name + ' ' + sender.last_name)
        d = DeadlineMessageSettings.objects.get(session=s)
        d.deadline_time = time
        d.save()
        text = f"Successfully changed deadline time to {time} hours"
    except ObjectDoesNotExist:
        text = "This session isn't yet logged in Telegram Sendall!"
    await bot.send_message(sender, text)
