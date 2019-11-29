FROM node:12.13
MAINTAINER Rogier Slag <rogier.slag@gmail.com>

EXPOSE 3000

RUN groupadd -r luser && useradd -r -g luser luser
RUN mkdir -p /home/luser/.pm2/
RUN chown -R luser.luser /home/luser
RUN yarn global add pm2

RUN mkdir /service

ADD yarn.lock /service/
ADD package.json /service/
RUN cd /service && yarn install --pure-lockfile
ADD src/*.js /service/

USER luser
WORKDIR /service
CMD ["/usr/local/bin/pm2-docker", "start", "index.js", "--instances=1"]
