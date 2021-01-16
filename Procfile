release: python manage.py migrate
web: gunicorn telegram_sendall.wsgi /var/log/django_sendall.log
worker: celery worker --app=telegram_sendall.celery.app --without-heartbeat -l debug
