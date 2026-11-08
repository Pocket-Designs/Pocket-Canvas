FROM node:22-alpine
ENV NODE_ENV=production PC_DATA_DIR=/data PC_PORT=8443
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY src ./src
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8443/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
