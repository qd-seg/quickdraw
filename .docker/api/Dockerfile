FROM python:3.14-rc-alpine3.20

COPY src/api /usr/local/src/api
WORKDIR /usr/local/src/api

RUN pip install -r requirements.txt
CMD gunicorn -b 0.0.0.0:80 app:app
