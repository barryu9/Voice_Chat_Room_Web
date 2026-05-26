#!/bin/bash
# === 语音聊天室 - 后端部署 ===
# 在后端服务器上执行: bash deploy-backend.sh
# 部署: MongoDB + Mediasoup 后端

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/deploy.conf"

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

cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP_BACKEND
ADMIN_PASSWORD=$ADMIN_PASSWORD
CORS_ORIGIN=${CORS_ORIGIN:-https://$DOMAIN_FRONTEND}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB_NAME=${MONGO_DB_NAME:-voice-chat-prod}
BACKEND_PORT=${BACKEND_PORT:-3001}
BACKEND_HOST=${BACKEND_HOST:-0.0.0.0}
RTC_MIN_PORT=${RTC_MIN_PORT:-40000}
RTC_MAX_PORT=${RTC_MAX_PORT:-49999}
MEDIASOUP_LISTEN_IP=${MEDIASOUP_LISTEN_IP:-0.0.0.0}
EOF

BLOCKED_WORDS_FILE="$SCRIPT_DIR/backend/src/utils/blockedWords.js"
BLOCKED_WORDS_EXAMPLE="$SCRIPT_DIR/backend/src/utils/blockedWords.example.js"
if [ ! -f "$BLOCKED_WORDS_FILE" ] && [ -f "$BLOCKED_WORDS_EXAMPLE" ]; then
  cp "$BLOCKED_WORDS_EXAMPLE" "$BLOCKED_WORDS_FILE"
  echo "  ⚠ 已从示例文件创建 blockedWords.js（词库为空，可按需编辑）"
fi

BACKEND_PORT="${BACKEND_PORT:-3001}"

echo "========================================"
echo "  语音聊天室 - 后端部署"
echo "  域名:  https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}"
echo "  端口:  $BACKEND_PORT"
echo "  版本:  v2026.05.27.1"
echo "========================================"

echo "[1/4] 检查 Docker..."
if ! command -v docker &> /dev/null; then curl -fsSL https://get.docker.com | bash; fi
echo "  Docker $(docker --version 2>&1 | head -1) ✓"

echo "[2/4] 防火墙..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow ${BACKEND_PORT}/tcp 2>/dev/null || true
ufw allow ${RTC_MIN_PORT:-40000}:${RTC_MAX_PORT:-49999}/udp 2>/dev/null || true
iptables -I INPUT -p udp --dport ${RTC_MIN_PORT:-40000}:${RTC_MAX_PORT:-49999} -j ACCEPT 2>/dev/null || true
echo "  TCP: 22, ${BACKEND_PORT} | UDP: ${RTC_MIN_PORT:-40000}-${RTC_MAX_PORT:-49999} ✓"

echo "[3/4] 构建并启动..."
docker pull mongo:7.0 2>/dev/null || true
docker compose -f docker/docker-compose.yml down 2>/dev/null || true
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d mongo backend
echo "  后端容器已启动 ✓"

echo "[4/4] 验证..."
sleep 5
echo -n "  后端: "
curl -s http://127.0.0.1:${BACKEND_PORT}/health 2>/dev/null || echo 'unreachable'

echo ""
echo "========================================"
echo "  后端部署完成!"
echo "========================================"
