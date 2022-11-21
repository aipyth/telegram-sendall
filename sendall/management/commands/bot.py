import asyncio
from django.core.management.base import BaseCommand
from sendall.bot import bot


class Command(BaseCommand):
    help = 'Telegram bot'

    def handle(self, *args, **kwargs):
        # loop = asyncio.new_event_loop()
        # asyncio.set_event_loop(loop)
        asyncio.run(bot.run_until_disconnected())
