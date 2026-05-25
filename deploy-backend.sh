#!/bin/bash
# === 语音聊天室 - 后端部署 ===
# 在后端服务器 (120.76.229.15) 上执行: bash deploy-backend.sh
# 部署: MongoDB + Mediasoup 后端 (不含前端)
# 版本: v2026.05.25.2

set -e

PUBLIC_IP="120.76.229.15"
ADMIN_PASSWORD="barry422"

cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

echo "========================================"
echo "  语音聊天室 - 后端部署"
echo "  域名:  https://talk.pokepal.fun"
echo "  服务器: $PUBLIC_IP"
echo "  版本:  v2026.05.25.2"
echo "========================================"

echo "[1/4] 检查 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
fi
echo "  Docker $(docker --version 2>&1 | head -1) ✓"

echo "[2/4] 防火墙..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 3001/tcp 2>/dev/null || true
ufw allow 40000:49999/udp 2>/dev/null || true
iptables -I INPUT -p udp --dport 40000:49999 -j ACCEPT 2>/dev/null || true
echo "  TCP: 22, 3001 | UDP: 40000-49999 ✓"

echo "[3/4] 构建并启动容器..."
docker pull mongo:7.0 2>/dev/null || true
docker compose -f docker/docker-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d mongo backend
echo "  后端容器已启动 ✓"

echo "[4/4] 验证..."
sleep 5
HEALTH=$(curl -s http://127.0.0.1:3001/health 2>/dev/null || echo '{"status":"unreachable"}')
echo "  后端: $HEALTH"

echo ""
echo "========================================"
echo "  后端部署完成!"
echo "  talk.pokepal.fun → $PUBLIC_IP:3001"
echo "  WebRTC UDP: $PUBLIC_IP:40000-49999"
echo "========================================"
