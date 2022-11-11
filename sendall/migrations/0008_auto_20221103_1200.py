# Generated by Django 2.2.3 on 2022-11-03 12:00

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sendall', '0007_sendmessagetask'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='user_blacklist',
            field=models.TextField(default='[]'),
        ),
        migrations.CreateModel(
            name='ReplyMessageTask',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField()),
                ('markdown', models.BooleanField()),
                ('done', models.BooleanField(default=False)),
                ('master', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='sendall.Session')),
            ],
        ),
        migrations.CreateModel(
            name='DeadlineMessageSettings',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('messages', models.TextField(default='[]')),
                ('deadline_time', models.IntegerField(default=15)),
                ('trigger_substring', models.TextField(default='\\d\\d\\d\\d+')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='sendall.Session')),
            ],
        ),
    ]