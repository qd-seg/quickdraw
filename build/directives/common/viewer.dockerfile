ARG ALPINE_VERSION
ARG NODE_VERSION

FROM alpine:${ALPINE_VERSION} as pull

ARG VIEWER_VERSION

RUN apk update
RUN apk add --no-cache git

RUN git clone https://github.com/OHIF/Viewers /usr/local/src/viewer

WORKDIR /usr/local/src/viewer

RUN git fetch --all --tags --prune
RUN git checkout v${VIEWER_VERSION}

FROM node:${NODE_VERSION}-slim AS install

COPY --from=pull /usr/local/src/viewer /usr/local/src/viewer
COPY ./platform/viewer/extensions/predict-provisioner/package.json /usr/local/src/extensions/predict-provisioner/package.json
COPY ./platform/viewer/extensions/upload-core/package.json /usr/local/src/extensions/upload-core/package.json
COPY ./platform/viewer/modes/radiology-ai/package.json /usr/local/src/modes/radiology-ai/package.json

WORKDIR /usr/local/src/viewer/
RUN yarn install --silent

RUN yarn run cli link-extension /usr/local/src/extensions/predict-provisioner
RUN yarn run cli link-extension /usr/local/src/extensions/upload-core
RUN yarn run cli link-mode /usr/local/src/modes/radiology-ai

WORKDIR /usr/local/src/extensions/predict-provisioner
RUN yarn install --silent

WORKDIR /usr/local/src/extensions/upload-core
RUN yarn install --silent

WORKDIR /usr/local/src/modes/radiology-ai
RUN yarn install --silent