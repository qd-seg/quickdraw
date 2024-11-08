# check=skip=InvalidDefaultArgInFrom

ARG PYTHON_VERSION

FROM python:${PYTHON_VERSION}-slim AS compile

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/local/src
RUN curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz
RUN tar -xf google-cloud-cli-linux-x86_64.tar.gz
RUN mv google-cloud-sdk /usr/local/src/gcloud
RUN rm -f google-cloud-cli-linux-x86_64.tar.gz

RUN /usr/local/src/gcloud/install.sh --quiet

FROM python:${PYTHON_VERSION}-slim AS serve

RUN apt-get update && apt-get install -y openssh-client libglib2.0-0 libgl1-mesa-dev ffmpeg libsm6 libxext6 && rm -rf /var/lib/apt/lists/*

COPY --from=compile /usr/local/src/gcloud /usr/local/src/gcloud
COPY ./platform/broker/requirements.txt /usr/local/src/broker/requirements.txt

ENV PATH="/usr/local/src/gcloud/bin:$PATH"

WORKDIR /usr/local/src/broker

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt