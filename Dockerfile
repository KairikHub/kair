FROM node:lts

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm link

ENTRYPOINT ["npm", "run", "kairik", "--"]
