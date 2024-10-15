FROM node:slim AS pull

RUN apt-get update && apt-get install -y git

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

RUN git clone https://github.com/OHIF/Viewers.git .
RUN git checkout ${APP_COMMIT}

FROM node:slim AS pack

RUN apt-get update && apt-get install -y build-essential python3

RUN mkdir -p /usr/local/src/app
WORKDIR /usr/local/src/app

COPY --from=pull /usr/local/src/app/package.json /usr/local/src/app/yarn.lock /usr/local/src/app/preinstall.js .

COPY --from=pull /usr/local/src/app/extensions extensions
COPY --from=pull /usr/local/src/app/modes modes
COPY --from=pull /usr/local/src/app/platform platform

RUN yarn config set workspaces-experimental true
RUN yarn install --frozen-lockfile --silent

COPY --from=pull /usr/local/src/app .

RUN yarn install --frozen-lockfile --silent

ENV PATH /usr/local/src/app/node_modules/.bin:$PATH
ENV QUICK_BUILD true

RUN yarn run build

FROM nginx:alpine as serve

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=pack /usr/local/src/app/platform/app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]