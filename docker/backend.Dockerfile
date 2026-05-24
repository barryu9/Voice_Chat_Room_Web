FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm config set registry https://registry.npmmirror.com
WORKDIR /app
COPY backend/package*.json ./

# mediasoup worker 预编译二进制走官方源，其余走镜像
RUN npm config set '@aspect-build:registry' https://registry.npmjs.org
RUN npm install --production && npm cache clean --force
COPY backend/src ./src
COPY backend/.env.production ./.env.production
EXPOSE 3001
EXPOSE 40000-49999/udp
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "src/index.js"]
