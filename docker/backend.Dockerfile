FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm config set registry https://registry.npmmirror.com
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production --ignore-scripts && npm cache clean --force

# 通过 ghproxy 下载预编译 worker（免编译）
RUN KERNEL_VER=$(uname -r | cut -d. -f1) && \
    URL="https://ghproxy.com/https://github.com/versatica/mediasoup/releases/download/3.19.22/mediasoup-worker-3.19.22-linux-x64-kernel${KERNEL_VER}.tgz" && \
    echo "Downloading worker: $URL" && \
    wget -q --show-progress --timeout=60 --tries=3 "$URL" -O /tmp/worker.tgz && \
    file /tmp/worker.tgz && \
    mkdir -p /app/node_modules/mediasoup/worker/prebuild && \
    tar -xzf /tmp/worker.tgz -C /app/node_modules/mediasoup/worker/prebuild/ && \
    rm /tmp/worker.tgz && \
    chmod +x /app/node_modules/mediasoup/worker/prebuild/mediasoup-worker && \
    file /app/node_modules/mediasoup/worker/prebuild/mediasoup-worker

ENV MEDIASOUP_WORKER_BIN=/app/node_modules/mediasoup/worker/prebuild/mediasoup-worker
COPY backend/src ./src
COPY backend/.env.production ./.env.production
EXPOSE 3001
EXPOSE 40000-49999/udp
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "src/index.js"]
