# check=skip=InvalidDefaultArgInFrom

ARG ALPINE_VERSION
ARG PYTHON_VERSION

FROM python:${PYTHON_VERSION}-alpine${ALPINE_VERSION} AS compile

RUN apk update
RUN apk add --no-cache curl bash gcc libc6-compat

RUN mkdir -p /usr/local/src
RUN curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz
RUN tar -xf google-cloud-cli-linux-x86_64.tar.gz
RUN mv google-cloud-sdk /usr/local/src/gcloud
RUN rm -f google-cloud-cli-linux-x86_64.tar.gz

RUN /usr/local/src/gcloud/install.sh

FROM python:${PYTHON_VERSION}-alpine${ALPINE_VERSION} AS serve

RUN apk update
RUN apk add --no-cache g++

COPY --from=compile /usr/local/src/gcloud /usr/local/src/gcloud
COPY ./platform/broker/requirements.txt /usr/local/src/broker/requirements.txt

ENV PATH="/usr/local/src/gcloud/sdk/bin:$PATH"

WORKDIR /usr/local/src/broker

RUN pip install -r requirements.txt