FROM node:slim AS pull

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

COPY lib/app/package.json lib/app/yarn.lock lib/app/preinstall.js .

COPY lib/app/extensions extensions
COPY lib/app/modes modes
COPY lib/app/platform platform

FROM node:slim AS pack

RUN apt-get update && apt-get install -y build-essential python3

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

COPY --from=pull /usr/local/src/app .

RUN yarn config set workspaces-experimental true
RUN yarn install --frozen-lockfile --silent

COPY lib/app .

RUN yarn install --frozen-lockfile --silent

ENV PATH /usr/local/src/app/node_modules/.bin:$PATH
ENV QUICK_BUILD true

RUN yarn run build

FROM nginx:alpine as serve

RUN rm /etc/nginx/conf.d/default.conf
COPY config/app/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=pack /usr/local/src/app/platform/app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]