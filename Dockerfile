FROM node:12.13-alpine
MAINTAINER Rogier Slag <rogier.slag@gmail.com>

EXPOSE 3000

ENV YARN_CACHE_FOLDER=/dev/shm/yarn_cache
ENV NODE_ENV=production
RUN addgroup -S usert && adduser -S usert -G usert
RUN mkdir -p /home/usert/.pm2/
RUN chown -R usert.usert /home/usert
RUN yarn global add pm2

RUN mkdir /service

ADD yarn.lock /service/
ADD package.json /service/
RUN cd /service && yarn install --frozen-lockfile
ADD src/*.js /service/

USER usert
WORKDIR /service
CMD ["/usr/local/bin/pm2-docker", "start", "index.js", "--instances=1"]
