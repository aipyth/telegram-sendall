from django.urls import path, re_path, include
from django.contrib.auth import views as auth_views

from .views import  *


urlpatterns = [
    re_path(r'^$', SessionList.as_view(), name='index'),
    path('sessions/', SessionList.as_view(), name='sessions'),
    path('sessions/<int:pk>/', SessionDetail.as_view(), name='session-detail'),
    path('sessions/<int:pk>/dialogs/', dialogs),
    path('sessions/<int:pk>/sendmessage/', send_message),
    path('sessions/add/', SessionAdd.as_view(), name='add-session'),
    path('login/', auth_views.LoginView.as_view(template_name='sendall/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(template_name='sendall/logout.html'), name='logout'),
    path('signup/', SignUpView.as_view(), name='signup')
]