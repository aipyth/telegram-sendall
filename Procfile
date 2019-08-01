release: python manage.py migrate
web: gunicorn telegram_sendall.wsgi
worker: celery worker --app=telegram_sendall.celery.app -l debug