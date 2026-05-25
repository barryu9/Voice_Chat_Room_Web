#!/bin/bash
# === 语音聊天室 - 前端部署 ===
# 在前端服务器上执行: bash deploy-frontend.sh
# 部署: Nginx 静态文件，绑定 127.0.0.1:8080
# 需要 deploy.conf 配置文件

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/deploy.conf"

if [ ! -f "$CONFIG" ]; then
    echo "ERROR: 找不到 deploy.conf"
    echo "  请复制 deploy.conf.example 并填写实际值:"
    echo "  cp deploy.conf.example deploy.conf"
    exit 1
fi

source "$CONFIG"

if [ -z "$DOMAIN_BACKEND" ] && [ -z "$PUBLIC_IP_BACKEND" ]; then
    echo "ERROR: deploy.conf 中的 DOMAIN_BACKEND 或 PUBLIC_IP_BACKEND 不能为空"
    exit 1
fi

BACKEND_URL="https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}"

cat > frontend/.env.production << EOF
VITE_SOCKET_URL=$BACKEND_URL
VITE_API_URL=$BACKEND_URL/api
EOF

echo "========================================"
echo "  语音聊天室 - 前端部署"
echo "  前端:  https://${DOMAIN_FRONTEND:-$PUBLIC_IP_FRONTEND}"
echo "  后端:  $BACKEND_URL"
echo "  版本:  v2026.05.25.2"
echo "========================================"

echo "[1/3] 检查 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
fi
echo "  Docker $(docker --version 2>&1 | head -1) ✓"

echo "[2/3] 构建并启动 Nginx..."
docker compose -f docker/frontend-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/frontend-compose.yml build --no-cache
docker compose -f docker/frontend-compose.yml up -d
echo "  前端容器已启动 ✓"

echo "[3/3] 验证..."
sleep 3
echo -n "  前端: "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/ 2>/dev/null || echo "000"

echo ""
echo "========================================"
echo "  前端部署完成!"
echo "========================================"
