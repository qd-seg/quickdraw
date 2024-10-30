
FROM node:22.9.0-slim AS link

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

COPY lib/app .

RUN yarn config set workspaces-experimental true
RUN yarn install --frozen-lockfile --silent

FROM node:22.9.0-slim AS pack

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

RUN apt-get update && apt-get install -y build-essential python3

COPY --from=link /usr/local/src/app .
COPY .docker/app/default.js /usr/local/src/app/platform/app/public/config/default.js
COPY src/app /usr/local/src/

RUN yarn run cli link-extension /usr/local/src/extensions/upload-core
RUN yarn run cli link-mode /usr/local/src/modes/radiology-ai
RUN yarn run build

FROM nginx:1.27-alpine3.20 AS serve

COPY .docker/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=pack /usr/local/src/app/platform/app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]