from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User



class SignUpForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')


class SessionAddForm(forms.Form):
    phone = forms.CharField(label='Phone', widget=forms.TextInput)
    code = forms.CharField(label='Code', required=False)
    password = forms.CharField(label='Password', required=False, widget=forms.PasswordInput)

class ChangePasswordForm(forms.Form):
    current_password = forms.CharField(label='Current password', widget=forms.PasswordInput)
    new_password = forms.CharField(label='New password', widget=forms.PasswordInput)
    new_password_repeat = forms.CharField(label='Repeat new password', widget=forms.PasswordInput)
