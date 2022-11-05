from django.core.management.base import BaseCommand
from sendall.bot import bot

# Название класса обязательно - "Command"
class Command(BaseCommand):
    help = 'Telegram bot'

    def handle(self, *args, **kwargs):
        bot.run_until_disconnected()
