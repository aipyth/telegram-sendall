from telethon import TelegramClient, events
from django.conf import settings

bot = TelegramClient('bot', settings.API_ID, settings.API_HASH).start(bot_token=settings.BOT_TOKEN)


async def _notify_user(msg, user):
    await bot.send_message(user, msg)

@bot.on(events.NewMessage(pattern="/start"))
async def start(event):
    sender = await event.get_sender()
    text = "Message replying service has been started. You'll get notifications, when the bot will start task"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/stop"))
async def stop(event):
    sender = await event.get_sender()
    text = "Message replying service stopped"
    await bot.send_message(sender, text)


@bot.on(events.NewMessage(pattern="/silent"))
async def silent(event):
    sender = await event.get_sender()
    text = "Now bot won't notify you about new tasks"
    await bot.send_message(sender, text)
