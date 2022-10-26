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


class SendMessageTask(models.Model):
    uuid = models.CharField(max_length=36)
    master = models.ForeignKey(User, on_delete=models.CASCADE)
    session = models.ForeignKey(Session, on_delete=models.CASCADE)
    eta = models.DateTimeField(null=True)
    contacts = models.TextField()
    message = models.TextField()
    markdown = models.BooleanField()

    done = models.BooleanField(default=False)
