import json
import logging
import datetime

from django.conf import settings
from django.contrib.auth import authenticate, login
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.generic import DetailView, ListView, View

# import celery

from . import utils
from .forms import SessionAddForm, SignUpForm
from .models import Session, TelegramUser, ContactsList
from uuid import uuid4
from . import tasks
from celery.result import AsyncResult

from telegram_sendall.celery import app


if settings.DEBUG:
    logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class SignUpView(View):
    form_class = SignUpForm
    template_name = 'sendall/sign_up.html'

    def get(self, request, *args, **kwargs):
        form = self.form_class()
        return render(request, self.template_name, {'form': form})

    def post(self, request, *args, **kwargs):
        form = self.form_class(request.POST)
        if form.is_valid():
            form.save()
            username = form.cleaned_data.get('username')
            raw_password = form.cleaned_data.get('password1')
            user = authenticate(username=username, password=raw_password)
            t = TelegramUser.objects.create(user=user)
            login(request, user)
            return redirect('index')
        else:
            return render(request, self.template_name, {'form': form})


class SessionList(LoginRequiredMixin, ListView):
    template = 'sendall/sessions_list.html'
    queryset = Session.objects.all()
    context_object_name = 'sessions'

    def get_queryset(self):
        objects = Session.objects.filter(user__user=self.request.user, active=True)
        return objects


class SessionDetail(DetailView):
    template = 'sendall/session_detail.html'
    queryset = Session.objects.all()


class SessionAdd(LoginRequiredMixin, View):
    template = 'sendall/session_add.html'
    form_class = SessionAddForm

    def get(self, request, *args, **kwargs):
        form = self.form_class()
        return render(request, self.template, {'form': form})

    def post(self, request, *args, **kwargs):
        data = json.loads(request.body.decode('utf-8'))
        form = self.form_class(data)
        if form.is_valid():
            phone = form.cleaned_data.get('phone')
            code = form.cleaned_data.get('code')
            password = form.cleaned_data.get('password')

            session, created = Session.objects.get_or_create(phone=phone, user=request.user.telegramuser)

            if code and password:
                return utils.sign_in(session, phone, code, password)

            elif code:
                return utils.sign_in(session, phone, code)

            elif phone:
                return utils.send_code_request(session, phone)
                

        return JsonResponse({'state': 'undefined'})


def dialogs(request, pk, *args, **kwargs):
    session = get_object_or_404(Session, pk=pk, user=request.user.telegramuser)
    if request.method == 'GET':
        logger.debug("Get_dialogs request from {} | {}".format(session, request.user))
        task = tasks.get_dialogs_task.delay(session.session)
        task_id = task.task_id
        return JsonResponse({'uuidkey': task_id})
    elif request.method == 'POST':
        data = json.loads(request.body.decode('utf-8'))
        task_id = data.get('uuidkey')
        if task_id:
            task = AsyncResult(id=task_id)
            if task.state == 'SUCCESS':
                logger.debug("Sending active dialogs {} to {}".format(session, request.user))
                dialogs = task.get()
                if dialogs[0].get('not_logged'):
                    session.delete()
                    return JsonResponse({'dialogs': [], 'state': 'not_logged'})
                return JsonResponse({'dialogs': dialogs})
            logger.debug("Task {} not ready".format(task_id))
            return JsonResponse({'uuidkey': task_id})
        return HttpResponseForbidden()

def send_message(request, pk, *args, **kwargs):
    if request.method == 'POST':
        data = json.loads(request.body.decode('utf-8'))
        session = get_object_or_404(Session, id=pk, user=request.user.telegramuser)
        
        if not session:
            return HttpResponseForbidden()
        if not data.get('contacts'):
            return JsonResponse({'state': 'error', 'errors': ['No contacts selected']})
        logger.debug("Sending message from {} to {}".format(session, data.get('contacts')))
        contacts = list(set(data.get('contacts')))
        if data.get('datetime'):
            try:
                exec_time = datetime.datetime.strptime(data.get('datetime'), "%Y-%m-%dT%H:%M:%S.%f%z")
            except ValueError:
                return JsonResponse({'state': 'error', 'errors': ['Invalid date and time format']})
            tasks.send_message.apply_async((session.session, contacts, data.get('message'), data.get('markdown')), eta=exec_time)
        else:
            tasks.send_message.delay(session.session, contacts, data.get('message'), data.get('markdown'))
        # return utils.send_message(session, contacts, data.get('message'), data.get('markdown'))

        return JsonResponse({'state': 'ok'})
    return HttpResponseForbidden()

def get_contacts_list(request, pk):
    session = get_object_or_404(Session, pk=pk, user=request.user.telegramuser)
    lists = [{
        'name': l.name,
        'list': l.get_list(),
        'strlist': l.contacts_list,
    } for l in session.contacts_lists.all()]
    logger.debug("Sending contacts lists from {} to {}".format(session, request.user))
    return JsonResponse({'lists': lists})

def add_contacts_list(request, pk):
    if request.method == 'POST':
        session = get_object_or_404(Session, pk=pk, user=request.user.telegramuser)
        data = json.loads(request.body.decode('utf-8'))

        name = data.get('name')
        raw_contacts_list = data.get('list')
        if raw_contacts_list:
            contacts_list = [{
                'id': contact.get('id'),
                'name': contact.get('name'),
            } for contact in raw_contacts_list]
            str_list = str(contacts_list)

            db_contacts_list = session.contacts_lists.filter(contacts_list=str_list)
            if len(db_contacts_list) == 0:
                cl = ContactsList(name=name, contacts_list=str_list, session=session)
                cl.save()
            return JsonResponse({'state': 'ok'})
    return HttpResponseForbidden()

def edit_contacts_list(request, pk):
    if request.method == 'POST':
        session = get_object_or_404(Session, pk=pk, user=request.user.telegramuser)
        data = json.loads(request.body.decode('utf-8'))

        name = data.get('name')
        raw_contacts_list = data.get('list')
        added = data.get('added')
        if raw_contacts_list:
            contacts_list = [{
                'id': contact.get('id'),
                'name': contact.get('name'),
            } for contact in raw_contacts_list]
            # this list contains old dialogs
            str_list = str(contacts_list)

            added_contacts_list = [{
                'id': contact.get('id'),
                'name': contact.get('name'),
            } for contact in added]
            # we need to do this to remove duplicates that might occur
            # and this list has all dialogs, old and new ones
            all_list = [dict(t) for t in {tuple(inner_list_dict.items()) for inner_list_dict in contacts_list + added_contacts_list}]
            all_str_list = str(all_list)


            db_contacts_list = session.contacts_lists.filter(contacts_list=str_list)
            # if len(db_contacts_list) == 1:
            try:
                cl = db_contacts_list[0]
            except IndexError:
                return HttpResponseForbidden()
            cl.name = name
            cl.contacts_list = all_str_list
            cl.save()
            return JsonResponse({'state': 'ok'})
    return HttpResponseForbidden()

def delete_contacts_list(request, pk):
    if request.method == 'POST':
        session = get_object_or_404(Session, pk=pk, user=request.user.telegramuser)
        data = json.loads(request.body.decode('utf-8'))
        
        strlist = data.get('strlist')
        if strlist:
            cl = ContactsList.objects.filter(contacts_list=strlist, session=session)
            if len(cl) == 1:
                cl[0].delete()
                return JsonResponse({'state': 'ok'})

    return HttpResponseForbidden()


def get_tasks(request):
    # logger.info('In get_tasks')
    if request.method == 'GET':
        # logger.info('in if')
        i = app.control.inspect()
        # logger.info(f"got inspect. {i}")
        # logger.info(f"{dir(i)}")
        # logger.info(f"{i.ping()}")
        def parse_shit(args: str):
            needed = str.split(",", 1)
            needed[0] = needed[0].split("'")[1]
            sec = needed[1]
            needed[1] = sec.split('[')[1].split(']')[0].split(", ")
            sec = sec.split(', ', 2)[2][:-1:].rsplit(', ', 1)
            needed.append(sec[0].split("'", 1)[1].rsplit("'", 1)[0])
            needed.append(sec[1])
            object = {"session":needed[0], "ids": needed[1], "message": needed[2], "isMarkdown": needed[3]}
            return object

        scheduled = [{
            'eta': item[1]['eta'],
            'id': item[1]['request']['id']
        } if item[1]['request']['type'] == "sendall.tasks.send_message" else {} for item in i.active().items()]


        return JsonResponse({
            # 'inspect': celery.app.control.inspect(),
            'active': i.active(),
            'scheduled': i.scheduled(),
            'waiting': i.reserved(),
        })
    return HttpResponseForbidden()
