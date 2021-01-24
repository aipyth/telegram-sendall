from django.urls import path, re_path, include
from django.contrib.auth import views as auth_views

from .views import *


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
    path('sessions/<int:pk>/tasks/', get_tasks),
    path('sessions/add/', SessionAdd.as_view(), name='add-session'),
    path('login/', auth_views.LoginView.as_view(template_name='sendall/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(template_name='sendall/logout.html'), name='logout'),
    path('signup/', SignUpView.as_view(), name='signup')
]
