FROM node:24.20.0-alpine

EXPOSE 3000

ENV NODE_ENV=production
RUN addgroup -S usert && adduser -S usert -G usert
RUN mkdir /service && chown usert:usert /service

USER usert
WORKDIR /service

COPY --chown=usert:usert yarn.lock package.json ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --chown=usert:usert src ./src

CMD ["node", "src/index.js"]
