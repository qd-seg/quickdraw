# check=skip=InvalidDefaultArgInFrom

ARG ALPINE_VERSION
ARG NGINX_VERSION

FROM --platform=${BUILDPLATFORM} viewer AS pack

COPY ./build/configuration/viewer/default.js /usr/local/src/viewer/platform/app/public/config/default.js
COPY ./platform/viewer/extensions/predict-provisioner /usr/local/src/extensions/predict-provisioner
COPY ./platform/viewer/modes/radiology-ai /usr/local/src/modes/radiology-ai

WORKDIR /usr/local/src/viewer

RUN yarn build

FROM --platform=${BUILDPLATFORM} nginx:${NGINX_VERSION}-alpine${ALPINE_VERSION} AS serve

COPY --from=pack /usr/local/src/viewer/platform/app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
