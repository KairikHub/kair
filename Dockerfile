FROM node:lts

WORKDIR /app

ENV CI=1
ENV COREPACK_ENABLE_STRICT=0

RUN corepack enable \
  && corepack prepare pnpm@10.23.0 --activate

COPY package.json package-lock.json* ./
RUN npm install

COPY vendor/openclaw/package.json vendor/openclaw/pnpm-lock.yaml vendor/openclaw/pnpm-workspace.yaml vendor/openclaw/.npmrc ./vendor/openclaw/
RUN cd /app/vendor/openclaw && pnpm install

COPY vendor/openclaw ./vendor/openclaw
RUN pnpm -C /app/vendor/openclaw build

COPY . .
RUN npm link

ENTRYPOINT ["npm", "run", "kairik", "--"]
