from nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY config/proxy/nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]