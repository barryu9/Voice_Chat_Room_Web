FROM node:22-slim

# apt 阿里云镜像 + mediasoup 编译依赖
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# npm 淘宝镜像 + pip 阿里云镜像
RUN npm config set registry https://registry.npmmirror.com
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ENV PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

WORKDIR /app
COPY mediasoup_release/ /tmp/mediasoup_release/

# 解压 mediasoup-worker 预编译二进制
RUN tar xzf /tmp/mediasoup_release/mediasoup-worker-*.tgz -C /tmp/mediasoup_release/ && \
    chmod +x /tmp/mediasoup_release/mediasoup-worker && \
    rm -f /tmp/mediasoup_release/mediasoup-worker-*.tgz

# MEDIASOUP_WORKER_BIN 让 postinstall 跳过下载/编译，也用于运行时
ENV MEDIASOUP_WORKER_BIN=/tmp/mediasoup_release/mediasoup-worker

COPY backend/package*.json ./
RUN npm install --omit=dev --loglevel=verbose

COPY backend/src ./src
COPY backend/.env.production ./.env.production
EXPOSE 3001
EXPOSE 40000-49999/udp
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "src/index.js"]
