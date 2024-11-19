# check=skip=InvalidDefaultArgInFrom

ARG PYTHON_VERSION

FROM --platform=${BUILDPLATFORM} python:${PYTHON_VERSION}-slim AS compile

ARG BUILDPLATFORM
ENV BUILD_PLATFORM=${BUILDPLATFORM}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY ./build/scripts/resolve.sh /usr/local/src/resolve.sh
RUN chmod +x /usr/local/src/resolve.sh

RUN . /usr/local/src/resolve.sh
RUN mv google-cloud-sdk /usr/local/src/gcloud
RUN /usr/local/src/gcloud/install.sh --quiet

FROM --platform=${BUILDPLATFORM} python:${PYTHON_VERSION}-slim AS serve

RUN apt-get update && apt-get install -y openssh-client libglib2.0-0 libgl1-mesa-dev ffmpeg libsm6 libxext6 && rm -rf /var/lib/apt/lists/*

COPY --from=compile /usr/local/src/gcloud /usr/local/src/gcloud
COPY ./platform/broker/requirements.txt /usr/local/src/broker/requirements.txt

ENV PATH="/usr/local/src/gcloud/bin:$PATH"

WORKDIR /usr/local/src/broker

RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt
