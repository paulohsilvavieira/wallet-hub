# syntax=docker/dockerfile:1

# =========================================================================
# Stage 1: frontend-build — builda o SPA (Vite) em arquivos estáticos.
# =========================================================================
FROM node:20-alpine AS frontend-build
WORKDIR /app

# Vite embute VITE_* no bundle em build-time — não dá pra trocar depois só
# com env var no container, por isso viram build args aqui (docker-compose.yml
# repassa via `build.args`).
ARG VITE_EXPLORER_URL
ARG VITE_ETH_EXPLORER_URL
ENV VITE_EXPLORER_URL=${VITE_EXPLORER_URL}
ENV VITE_ETH_EXPLORER_URL=${VITE_ETH_EXPLORER_URL}

COPY package.json ./
RUN npm install

COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

# =========================================================================
# Stage 2: server-deps — dependências de produção do backend (módulos
# nativos como better-sqlite3/tiny-secp256k1 precisam de toolchain de build).
# =========================================================================
FROM node:20-alpine AS server-deps
WORKDIR /app/server

RUN apk add --no-cache python3 make g++

COPY server/package.json ./
RUN npm install --omit=dev

# =========================================================================
# Stage 3: runtime — servidor Express servindo a API (BTC + ETH) + os
# estáticos do build.
# =========================================================================
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app && chown app:app /app && mkdir -p /data && chown app:app /data

COPY --from=server-deps --chown=app:app /app/server/node_modules ./server/node_modules
COPY --chown=app:app server/package.json ./server/package.json
COPY --chown=app:app server ./server
COPY --from=frontend-build --chown=app:app /app/dist ./dist

USER app

ENV NODE_ENV=production
ENV DATA_DIR=/data

VOLUME /data

EXPOSE 3005

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
    CMD wget -qO- http://127.0.0.1:3005/ >/dev/null || exit 1

CMD ["node", "server/index.js"]
