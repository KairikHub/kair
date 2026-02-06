FROM node:lts

WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@9.12.2 --activate

COPY package.json package-lock.json* ./
RUN npm install

COPY vendor/openclaw/package.json vendor/openclaw/pnpm-lock.yaml vendor/openclaw/pnpm-workspace.yaml vendor/openclaw/.npmrc ./vendor/openclaw/
RUN cd /app/vendor/openclaw && pnpm install

COPY vendor/openclaw ./vendor/openclaw
RUN cd /app/vendor/openclaw && pnpm -r build

COPY . .
RUN npm link

ENTRYPOINT ["/app/bin/docker-entrypoint.sh"]
