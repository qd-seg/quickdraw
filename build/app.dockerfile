FROM node:22.9.0-slim AS pull

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

RUN apt-get update && apt-get install -y git

RUN git clone https://github.com/OHIF/Viewers.git ./
RUN git checkout 43f54aa49c388dbeb2f01e19244210a4f3bda6c5

FROM node:22.9.0-slim AS link

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

COPY --from=pull /usr/local/src/app ./

RUN yarn config set workspaces-experimental true
RUN yarn install --frozen-lockfile --silent

FROM node:22.9.0-slim AS pack

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

RUN apt-get update && apt-get install -y build-essential python3

COPY --from=link /usr/local/src/app ./
COPY ./config/app.config.js /usr/local/src/app/platform/app/public/config/default.js
COPY ./src/app /usr/local/src/

RUN yarn run cli link-extension /usr/local/src/extensions/model-management-panel
RUN yarn run build

FROM nginx:1.27-alpine3.20 as serve

COPY ./config/app.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=pack /usr/local/src/app/platform/app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]