#!/bin/bash
# === 语音聊天室 - 前端部署 ===
# 在前端服务器上执行: bash deploy-frontend.sh
# 部署: Nginx 静态文件

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/deploy.conf"

if [ ! -f "$CONFIG" ]; then
    echo "ERROR: 找不到 deploy.conf"
    echo "  cp deploy.conf.example deploy.conf"
    exit 1
fi

source "$CONFIG"

if [ -z "$DOMAIN_BACKEND" ] && [ -z "$PUBLIC_IP_BACKEND" ]; then
    echo "ERROR: deploy.conf 中 DOMAIN_BACKEND 或 PUBLIC_IP_BACKEND 不能为空"
    exit 1
fi

BACKEND_URL="https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}"
NGINX_PORT="${NGINX_PORT:-8080}"

# 使用变量写入 .env (frontend-compose.yml 不读取 .env, 这里仅为 frontend build)
cat > docker/.env << EOF
NGINX_PORT=${NGINX_PORT}
EOF

cat > frontend/.env.production << EOF
VITE_SOCKET_URL=$BACKEND_URL
VITE_API_URL=$BACKEND_URL/api
EOF

# 屏蔽词库 — 如果不存在则从示例文件复制
BLOCKED_WORDS_FILE="$SCRIPT_DIR/frontend/src/utils/blockedWords.ts"
BLOCKED_WORDS_EXAMPLE="$SCRIPT_DIR/frontend/src/utils/blockedWords.example.ts"
if [ ! -f "$BLOCKED_WORDS_FILE" ] && [ -f "$BLOCKED_WORDS_EXAMPLE" ]; then
  cp "$BLOCKED_WORDS_EXAMPLE" "$BLOCKED_WORDS_FILE"
  echo "  ⚠ 已从示例文件创建 blockedWords.ts（词库为空，可按需编辑）"
fi

echo "========================================"
echo "  语音聊天室 - 前端部署"
echo "  前端:  https://${DOMAIN_FRONTEND:-$PUBLIC_IP_FRONTEND}"
echo "  后端:  $BACKEND_URL"
echo "  端口:  $NGINX_PORT"
echo "  版本:  v2026.05.26.1"
echo "========================================"

echo "[1/3] 检查 Docker..."
if ! command -v docker &> /dev/null; then curl -fsSL https://get.docker.com | bash; fi
echo "  Docker $(docker --version 2>&1 | head -1) ✓"

echo "[2/3] 构建并启动 Nginx..."
docker compose -f docker/frontend-compose.yml down 2>/dev/null || true
docker compose -f docker/frontend-compose.yml build
docker compose -f docker/frontend-compose.yml up -d
echo "  前端容器已启动 ✓"

echo "[3/3] 验证..."
sleep 3
echo -n "  前端: "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:${NGINX_PORT}/ 2>/dev/null || echo "000"

echo ""
echo "========================================"
echo "  前端部署完成!"
echo "========================================"
