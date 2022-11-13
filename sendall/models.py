from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist

import logging
logger = logging.getLogger(__name__)


class DefaultManager(models.Manager):
    def get_or_create(self, *args, **kwargs):
        try:
            return self.get(*args, **kwargs)
        except ObjectDoesNotExist:
            return self.create(*args, **kwargs)

    def get_or_none(self, *args, **kwargs):
        try:
            logger.info('self_get', self.get(*args, **kwargs))
            return self.get(*args, **kwargs)
        except ObjectDoesNotExist:
            return None


class TelegramUser(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    objects = DefaultManager

    def __str__(self):
        return "{}".format(self.user.username)


class Session(models.Model):
    session = models.TextField(blank=True)
    user = models.ForeignKey(
        TelegramUser,
        on_delete=models.CASCADE,
        related_name='sessions',
    )
    username = models.CharField(max_length=200, blank=True, null=True)
    name = models.CharField(max_length=500, blank=True)
    phone = models.CharField(max_length=13, blank=True)
    active = models.BooleanField(default=False)
    bot_settings = models.TextField(default="{'active': False, 'silent': False}")
    user_blacklist = models.TextField(default="[]")

    objects = DefaultManager

    def __str__(self):
        if self.username:
            return "{} ({})".format(self.name, self.username)
        else:
            return "{}".format(self.name)

    def update_session(self, session):
        logger.debug("Session update {}".format(session))
        self.session = session
        self.save()
        logger.debug("Updated!")

    def set_active(self):
        logger.debug("Session set True")
        self.active = True
        self.save()
        logger.debug("updated")

    def get_blacklist(self):
        return eval(self.user_blacklist)

    def set_blacklist(self, list):
        self.user_blacklist = str(list)
        self.save()

    def get_bot_settings(self):
        return eval(self.bot_settings)

    def set_bot_settings(self, settings):
        self.bot_settings = str(settings)
        self.save()

class ContactsList(models.Model):
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='contacts_lists',
    )
    name = models.TextField(blank=True, default='Contacts List')
    contacts_list = models.TextField(default='[]')

    def get_list(self):
        return eval(self.contacts_list)


class DeadlineMessageSettings(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE)
    messages = models.TextField(default='[]')
    deadline_time = models.IntegerField(default=15)
    trigger_substring = models.TextField(default="\\d\\d\\d+")

    objects = DefaultManager

    def get_messages(self):
        return eval(self.messages)

    def set_messages(self, list):
        self.messages = str(list)
        logger.info(self.messages)
        self.save()


class ReplyMessageTask(models.Model):
    dialog_id = models.IntegerField(default=0)
    session = models.ForeignKey(Session, on_delete=models.CASCADE)
    start_time = models.DateTimeField(null=True)
    objects = DefaultManager


class SendMessageTask(models.Model):
    uuid = models.CharField(max_length=36)
    master = models.ForeignKey(User, on_delete=models.CASCADE)
    session = models.ForeignKey(Session, on_delete=models.CASCADE)
    eta = models.DateTimeField(null=True)
    contacts = models.TextField()
    message = models.TextField()
    markdown = models.BooleanField()
    done = models.BooleanField(default=False)
