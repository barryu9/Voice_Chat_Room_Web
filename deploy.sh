#!/bin/bash
# === 语音聊天室 - Docker 部署脚本 ===
# 在服务器上执行: bash deploy.sh

set -e

PUBLIC_IP="38.95.75.238"
ADMIN_PASSWORD="barry422"

echo "========================================"
echo "  语音聊天室 Docker 部署"
echo "  前端: https://chat.pokepal.fun"
echo "  后端: https://talk.pokepal.fun"
echo "  IP:   $PUBLIC_IP"
echo "========================================"

cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

echo "[1/4] 检查 Docker ..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
fi

echo "[2/4] 防火墙 ..."
ufw allow 40000:49999/udp 2>/dev/null || true
iptables -I INPUT -p udp --dport 40000:49999 -j ACCEPT 2>/dev/null || true

echo "[3/4] 构建并启动 ..."
docker compose -f docker/docker-compose.yml down 2>/dev/null || true
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d

echo "[4/4] 验证 ..."
sleep 5
curl -s http://127.0.0.1:3001/health || echo "等待就绪中..."
curl -s -o /dev/null -w "前端状态: %{http_code}\n" http://127.0.0.1:8080 || true

echo ""
echo "========================================"
echo "  部署完成!"
echo ""
echo "  反向代理配置:"
echo "    chat.pokepal.fun → http://127.0.0.1:8080    (前端静态 + WebSocket代理)"
echo "    talk.pokepal.fun → http://127.0.0.1:3001    (后端 API + Socket.io)"
echo ""
echo "  UDP: 40000-49999 (WebRTC RTP)"
echo "========================================"
