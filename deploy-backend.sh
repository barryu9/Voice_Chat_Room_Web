#!/bin/bash
# === 语音聊天室 - 后端部署 ===
# 服务器上执行: bash deploy-backend.sh
# 部署: MongoDB + Mediasoup 后端 + Nginx，绑定 0.0.0.0:3001
# 与 deploy.sh 使用同一份 docker-compose.yml

set -e

PUBLIC_IP="120.76.229.15"
ADMIN_PASSWORD="barry422"

echo "========================================"
echo "  语音聊天室 - 后端部署"
echo "  域名: talk.pokepal.fun → 0.0.0.0:3001"
echo "  IP:   $PUBLIC_IP"
echo "========================================"

cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

echo "[1/4] 配置 Docker Hub 镜像加速 ..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DOCKEREOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
DOCKEREOF
systemctl restart docker 2>/dev/null || service docker restart 2>/dev/null || true
echo "  镜像加速已配置"

echo "[2/4] 检查 Docker ..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
fi

echo "[3/4] 防火墙 (UFW) ..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 3001/tcp 2>/dev/null || true
ufw allow 40000:49999/udp 2>/dev/null || true

echo "[4/4] 构建并启动 ..."
docker compose -f docker/docker-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d

echo "[5/5] 验证 ..."
sleep 5
HEALTH=$(curl -s http://127.0.0.1:3001/health || echo '{"status":"starting..."}')
echo "  健康检查: $HEALTH"

echo ""
echo "========================================"
echo "  后端部署完成!"
echo "  域名反代: talk.pokepal.fun → 0.0.0.0:3001"
echo "  WebRTC UDP: $PUBLIC_IP:40000-49999"
echo "========================================"
