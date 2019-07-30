import json
import logging

from django.conf import settings
from django.contrib.auth import authenticate, login
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.generic import DetailView, ListView, View

from . import utils
from .forms import SessionAddForm, SignUpForm
from .models import Session, TelegramUser

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

            session , created= Session.objects.get_or_create(phone=phone, user=request.user.telegramuser)

            if code and password:
                return utils.sign_in(session, phone, code, password)

            elif code:
                return utils.sign_in(session, phone, code)

            elif phone:
                return utils.send_code_request(session, phone)
                

        return JsonResponse({'state': 'undefined'})


def dialogs(request, pk, *args, **kwargs):
    session = get_object_or_404(Session, pk=pk, user=request.user.telegramuser)
    logger.debug("Sending active dialogs {} to {}".format(session, request.user))
    return JsonResponse({'dialogs': utils.get_dialogs(session)})

def send_message(request, pk, *args, **kwargs):
    if request.method == 'POST':
        data = json.loads(request.body.decode('utf-8'))
        session = get_object_or_404(Session, id=pk, user=request.user.telegramuser)
        
        if not session:
            return HttpResponseForbidden()
        if not data.get('contacts'):
            return JsonResponse({'state': 'error', 'errors': ['No contacts selected']})
        logger.debug("Sending message from {} to {}".format(session, data.get('contacts')))
        return utils.send_message(session, data.get('contacts'), data.get('message'), data.get('markdown'))
    return HttpResponseForbidden()
