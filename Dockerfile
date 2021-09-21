FROM node:12.18-alpine

WORKDIR /home/node/app

COPY package.json yarn.lock ./
RUN yarn install --production

COPY . .
RUN chown -R node:node /home/node/

EXPOSE ${PORT:-8080}

USER node
CMD ["node", "index.js"]