
FROM node:22.9.0-slim AS link

RUN mkdir -p /usr/local/src/dashboard
WORKDIR /usr/local/src/dashboard

COPY src/dashboard .

RUN yarn install --frozen-lockfile --silent

FROM node:22.9.0-slim AS pack

RUN mkdir -p /usr/local/src/dashboard
WORKDIR /usr/local/src/dashboard

COPY --from=link /usr/local/src/dashboard .

RUN yarn run build

FROM nginx:1.27-alpine3.20 AS serve

COPY .docker/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=pack /usr/local/src/dashboard/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]