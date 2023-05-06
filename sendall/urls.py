from django.urls import path, re_path
from django.contrib.auth import views as auth_views

from .views import (SessionList, SessionDetail, SessionAdd, ChangePasswordView,
                    SignUpView, dialogs, send_message, get_contacts_list, add_contacts_list,
                    edit_contacts_list, delete_contacts_list, get_tasks, get_app_id_hash,
                    create_session, deadline_message_settings, deadline_message_text,
                    deadline_message_time, user_blacklist, dump_contacts_lists, load_contacts_lists)


urlpatterns = [
    re_path(r'^$', SessionList.as_view(), name='index'),
    path('sessions/', SessionList.as_view(), name='sessions'),
    path('sessions/<int:pk>/', SessionDetail.as_view(), name='session-detail'),
    path('sessions/<int:pk>/dialogs/', dialogs),
    path('sessions/<int:pk>/send-message/', send_message),
    path('sessions/<int:pk>/get-contacts-lists/', get_contacts_list),
    path('sessions/<int:pk>/add-contacts-list/', add_contacts_list),
    path('sessions/<int:pk>/edit-contacts-list/', edit_contacts_list),
    path('sessions/<int:pk>/delete-contacts-list/', delete_contacts_list),
    path('sessions/<int:pk>/dump-contacts-lists/', dump_contacts_lists),
    path('sessions/<int:pk>/load-contacts-lists/', load_contacts_lists),
    path('sessions/<int:pk>/deadline_message_settings/', deadline_message_settings),
    path('sessions/<int:pk>/add_deadline_message_text/', deadline_message_text),
    path('sessions/<int:pk>/add_deadline_message_time/', deadline_message_time),
    path('sessions/<int:pk>/user_blacklist/', user_blacklist),
    path('sessions/<int:pk>/tasks/', get_tasks),
    path('sessions/add/', SessionAdd.as_view(), name='add-session'),
    path('get_app_id_and_hash/', get_app_id_hash),
    path('create_session/', create_session),
    path('change_password/', ChangePasswordView.as_view(), name='change_password'),
    path('login/', auth_views.LoginView.as_view(template_name='sendall/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(template_name='sendall/logout.html'), name='logout'),
    path('signup/', SignUpView.as_view(), name='signup')
]
