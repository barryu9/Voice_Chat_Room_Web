FROM node:22-slim

# apt 阿里云镜像 + 编译依赖
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-setuptools make g++ \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# npm 淘宝镜像 + pip 允许系统级安装
RUN npm config set registry https://registry.npmmirror.com
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ENV PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev --loglevel=error && npm cache clean --force

COPY backend/src ./src
COPY backend/.env.production ./.env.production
EXPOSE 3001
EXPOSE 40000-49999/udp
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "src/index.js"]
