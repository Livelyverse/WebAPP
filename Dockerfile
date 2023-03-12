###################
# BUILD FOR PRODUCTION
###################
FROM node:latest As build

WORKDIR /usr/src/app

COPY node_modules ./node_modules
COPY dist ./dist

USER node

###################
# PRODUCTION
###################
FROM node:latest As production

COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/dist/resources/config.yml ./configs/config.yml
COPY --chown=node:node --from=build /usr/src/app/dist/resources/publicKey.pem ./configs/publicKey.pem
COPY --chown=node:node --from=build /usr/src/app/dist/resources/privateKey.pem ./configs/privateKey.pem

CMD [ "node", "dist/main.js" ]