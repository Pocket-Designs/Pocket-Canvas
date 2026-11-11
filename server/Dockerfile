# Pocket-Canvas Server, with the browser version of Pocket-Canvas built in.
# Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
#
# Build from the top folder of the Pocket-Canvas repository (docker-compose.yml does this for you):
#   docker build -f server/Dockerfile -t pocket-canvas-server .

# 1. the browser version (the same screens as the desktop app)
FROM node:22-alpine AS web
WORKDIR /src
COPY package.json ./
COPY src ./src
COPY web ./web
COPY scripts/build-web.js ./scripts/
RUN node scripts/build-web.js /out

# 2. the server
FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY server/pocket-canvas-server.js ./
COPY lib/link-preview.js ./lib/
COPY --from=web /out ./public
ENV PORT=8787 DATA_DIR=/data NODE_ENV=production
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "pocket-canvas-server.js"]
