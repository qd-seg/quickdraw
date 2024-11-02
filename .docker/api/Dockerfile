FROM python:3.12.7-alpine3.20

COPY src/api /usr/local/src/api
WORKDIR /usr/local/src/api

RUN apk update && \
    apk add --no-cache curl bash gcc libc6-compat && \
    curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz && \
    tar -xf google-cloud-cli-linux-x86_64.tar.gz && \
    ./google-cloud-sdk/install.sh --quiet && \
    rm -f google-cloud-cli-linux-x86_64.tar.gz
ENV PATH="./google-cloud-sdk/bin:$PATH"
RUN gcloud --version

RUN apk add g++
RUN pip install -r requirements.txt
CMD gunicorn -b 0.0.0.0:80 app:app
