FROM node:22-slim
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ wget \
    && rm -rf /var/lib/apt/lists/*
ENV PIP_BREAK_SYSTEM_PACKAGES=1
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production && npm cache clean --force
COPY backend/src ./src
COPY backend/.env.production ./.env.production
EXPOSE 3001
EXPOSE 40000-49999/udp
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "src/index.js"]
