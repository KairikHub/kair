FROM node:lts

WORKDIR /app

ENV CI=1

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm link

ENTRYPOINT ["npm", "run", "kair", "--"]
