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

CMD [ "node", "dist/main.js" ]