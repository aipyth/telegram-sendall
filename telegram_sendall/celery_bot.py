# from __future__ import absolute_import, unicode_literals
# import os
# from celery.signals import worker_ready
#
# from celery import Celery
# from telethon import TelegramClient
# from django.conf import settings
# app = Celery('telegram_sendall_bot')
#
# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'telegram_sendall.settings')
#
# app.config_from_object('django.conf:settings', namespace='CELERY')
#
# bot = TelegramClient('bot', settings.API_ID, settings.API_HASH).start(bot_token=settings.BOT_TOKEN)
