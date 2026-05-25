#!/bin/bash
# === 语音聊天室 - 全栈部署 ===
# 在后端服务器上执行: bash deploy.sh
# 部署: MongoDB + Mediasoup 后端 + Nginx 前端
# 需要 deploy.conf 配置文件

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/deploy.conf"
NGINX_TEMPLATE="$SCRIPT_DIR/docker/nginx/default.conf.template"
NGINX_CONF="$SCRIPT_DIR/docker/nginx/default.conf"

if [ ! -f "$CONFIG" ]; then
    echo "ERROR: 找不到 deploy.conf"
    echo "  cp deploy.conf.example deploy.conf"
    exit 1
fi

source "$CONFIG"

if [ -z "$PUBLIC_IP_BACKEND" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "ERROR: deploy.conf 中 PUBLIC_IP_BACKEND 和 ADMIN_PASSWORD 不能为空"
    exit 1
fi

# ---- 生成 nginx 配置 ----
BACKEND_PORT="${BACKEND_PORT:-3001}"
sed "s/BACKEND_PORT_PLACEHOLDER/${BACKEND_PORT}/g" "$NGINX_TEMPLATE" > "$NGINX_CONF"

# ---- 生成 docker/.env ----
cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP_BACKEND
ADMIN_PASSWORD=$ADMIN_PASSWORD
CORS_ORIGIN=${CORS_ORIGIN:-https://$DOMAIN_FRONTEND}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB_NAME=${MONGO_DB_NAME:-voice-chat-prod}
BACKEND_PORT=${BACKEND_PORT}
BACKEND_HOST=${BACKEND_HOST:-0.0.0.0}
NGINX_PORT=${NGINX_PORT:-8080}
RTC_MIN_PORT=${RTC_MIN_PORT:-40000}
RTC_MAX_PORT=${RTC_MAX_PORT:-49999}
MEDIASOUP_LISTEN_IP=${MEDIASOUP_LISTEN_IP:-0.0.0.0}
EOF

# ---- 生成前端生产配置 ----
cat > frontend/.env.production << EOF
VITE_SOCKET_URL=https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}
VITE_API_URL=https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}/api
EOF

NGINX_PORT="${NGINX_PORT:-8080}"
BACKEND_PORT="${BACKEND_PORT:-3001}"

echo "========================================"
echo "  语音聊天室 - 全栈部署"
echo "  前端:  https://${DOMAIN_FRONTEND:-$PUBLIC_IP_FRONTEND}"
echo "  后端:  https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}"
echo "  端口:  前端 8080:$NGINX_PORT | 后端 $BACKEND_PORT | Mongo $MONGO_PORT"
echo "  版本:  v2026.05.25.2"
echo "========================================"

echo "[1/5] 检查 Docker..."
if ! command -v docker &> /dev/null; then curl -fsSL https://get.docker.com | bash; fi
echo "  Docker $(docker --version 2>&1 | head -1) ✓"

echo "[2/5] 防火墙..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow ${BACKEND_PORT}/tcp 2>/dev/null || true
ufw allow ${RTC_MIN_PORT:-40000}:${RTC_MAX_PORT:-49999}/udp 2>/dev/null || true
iptables -I INPUT -p udp --dport ${RTC_MIN_PORT:-40000}:${RTC_MAX_PORT:-49999} -j ACCEPT 2>/dev/null || true
echo "  TCP: 22, ${BACKEND_PORT} | UDP: ${RTC_MIN_PORT:-40000}-${RTC_MAX_PORT:-49999} ✓"

echo "[3/5] 拉取基础镜像..."
docker pull mongo:7.0 &
docker pull nginx:stable-alpine &
docker pull node:22-slim &
wait
echo "  基础镜像就绪 ✓"

echo "[4/5] 构建并启动..."
docker compose -f docker/docker-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d
echo "  容器已启动 ✓"

echo "[5/5] 验证..."
sleep 5
echo -n "  后端: "
curl -s http://127.0.0.1:${BACKEND_PORT}/health 2>/dev/null || echo 'unreachable'
echo -n "  前端: "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:${NGINX_PORT}/ 2>/dev/null || echo "000"
docker compose -f docker/docker-compose.yml ps

echo ""
echo "========================================"
echo "  部署完成!"
echo "========================================"
