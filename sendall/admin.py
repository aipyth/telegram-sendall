from django.contrib import admin

from .models import TelegramUser, Session, ContactsList, SendMessageTask

admin.site.register(TelegramUser)
admin.site.register(Session)
admin.site.register(ContactsList)
admin.site.register(SendMessageTask)
