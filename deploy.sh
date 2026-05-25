#!/bin/bash
# === 语音聊天室 - 全栈部署 ===
# 在后端服务器上执行: bash deploy.sh
# 部署: MongoDB + Mediasoup 后端 + Nginx 前端
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

if [ -z "$PUBLIC_IP_BACKEND" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "ERROR: deploy.conf 中的 PUBLIC_IP_BACKEND 和 ADMIN_PASSWORD 不能为空"
    exit 1
fi

# 写入 docker/.env
cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP_BACKEND
ADMIN_PASSWORD=$ADMIN_PASSWORD
CORS_ORIGIN=${CORS_ORIGIN:-https://$DOMAIN_FRONTEND}
EOF

# 写入前端生产配置
cat > frontend/.env.production << EOF
VITE_SOCKET_URL=https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}
VITE_API_URL=https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}/api
EOF

echo "========================================"
echo "  语音聊天室 - 全栈部署"
echo "  后端:   https://${DOMAIN_BACKEND:-$PUBLIC_IP_BACKEND}"
echo "  前端:   https://${DOMAIN_FRONTEND:-$PUBLIC_IP_FRONTEND}"
echo "  版本:   v2026.05.25.2"
echo "========================================"

echo "[1/5] 检查 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
fi
echo "  Docker $(docker --version 2>&1 | head -1) ✓"

echo "[2/5] 防火墙..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 3001/tcp 2>/dev/null || true
ufw allow 40000:49999/udp 2>/dev/null || true
iptables -I INPUT -p udp --dport 40000:49999 -j ACCEPT 2>/dev/null || true
echo "  TCP: 22, 3001 | UDP: 40000-49999 ✓"

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
curl -s http://127.0.0.1:3001/health 2>/dev/null || echo '{"status":"unreachable"}'
echo -n "  前端: "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/ 2>/dev/null || echo "000"
docker compose -f docker/docker-compose.yml ps

echo ""
echo "========================================"
echo "  部署完成!"
echo "========================================"
