FROM node:22-slim

# wget 仅供健康检查用
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# .npmrc 混合源：普通包走镜像，@aspect-build 预编译 worker 走官方源
RUN echo "registry=https://registry.npmmirror.com" > .npmrc && \
    echo "@aspect-build:registry=https://registry.npmjs.org" >> .npmrc

COPY backend/package*.json ./
RUN npm install --omit=dev --loglevel=verbose && npm cache clean --force

COPY backend/src ./src
COPY backend/.env.production ./.env.production
EXPOSE 3001
EXPOSE 40000-49999/udp

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "src/index.js"]
