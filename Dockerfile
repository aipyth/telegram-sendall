FROM python:3.9

WORKDIR /app

COPY Pipfile .
COPY Pipfile.lock .

RUN pip install pipenv && pipenv install --system
# RUN pipenv lock --requirements > requirements.txt
# RUN pip install -r requirements.txt

COPY . /app/

# RUN chmod a+x ./docker-entrypoint.sh
# RUN chmod a+x ./manage.py

EXPOSE 8000

RUN python manage.py collectstatic --noinput
# RUN python manage.py compress

# CMD python manage.py migrate && python manage.py runserver 0.0.0.0:8000
CMD sh ./docker-entrypoint.sh
# CMD ["gunicorn", "telegram_sendall.wsgi", ":8000"]
