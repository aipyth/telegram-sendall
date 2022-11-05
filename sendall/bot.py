import asyncio
from telethon import TelegramClient, events
# from telethon.sessions import StringSession
from telethon.tl.types import PeerChat
from .models import Session
from django.conf import settings
import logging
logger = logging.getLogger(__name__)
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
bot = TelegramClient(None, settings.API_ID, settings.API_HASH).start(bot_token=settings.BOT_TOKEN)

async def _notify_user(session, msg):
    session_settings = session.get_bot_settings()
    logger.info(session_settings['active'])
    if session_settings['active'] and not session_settings['silent']:
        # client = TelegramClient(StringSession(session.session), settings.API_ID, settings.API_HASH)
        # await client.connect()
        # user = await client.get_me()
        await bot.send_message(PeerChat(731478460), message=msg)
        logger.info('MESSAGE SENT')

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
    s = Session.objects.get_or_none(name=sender.first_name + ' ' + sender.last_name)
    if s == None:
        text = "This session isn't yet logged in Telegram Sendall!"
    else:
        s.set_bot_settings({'active': True, 'silent': False})
        text = """
Message replying service has been started. You'll get notifications, when the bot will start task
Bot commands:
- `/stop`: stop service, `/start` if you want to resume
- `/silent`: stop log every task start and end
- `/message <text>`: add new message to existing reply messages
- `/deadline <number>`: set deadline time to reply message
"""
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/stop"))
async def stop(event):
    sender = await event.get_sender()
    s = Session.objects.get_or_none(name=sender.first_name + ' ' + sender.last_name)
    if s == None:
        text = "This session isn't yet logged in Telegram Sendall!"
    else:
        s.set_bot_settings({'active': False, 'silent': False})
        text = "Message replying service stopped"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/silent"))
async def silent(event):
    sender = await event.get_sender()
    s = Session.objects.get_or_none(name=sender.first_name + ' ' + sender.last_name)
    if s == None:
        text = "This session isn't yet logged in Telegram Sendall!"
    else:
        s.set_bot_settings({'active': True, 'silent': True})
        text = "Now bot won't notify you about new tasks"
    await bot.send_message(sender, text)
