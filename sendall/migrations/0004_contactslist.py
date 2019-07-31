# Generated by Django 2.2.3 on 2019-07-30 20:09

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('sendall', '0003_auto_20190726_1355'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContactsList',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.TextField(blank=True, default='Contacts List')),
                ('contacts_list', models.TextField(default='[]')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contacts_lists', to='sendall.Session')),
            ],
        ),
    ]
