#!/bin/bash
# === 语音聊天室 - 一键部署脚本 ===
# 在服务器上执行: bash deploy.sh

set -e

# ============================================================
# 填写你的配置
# ============================================================
PUBLIC_IP="38.95.75.238"
DOMAIN="chat.pokepal.fun"
ADMIN_PASSWORD="barry422"

echo "========================================"
echo "  语音聊天室 Docker 部署"
echo "  IP:        $PUBLIC_IP"
echo "  Domain:    $DOMAIN"
echo "========================================"

# 写入 .env 供 docker-compose 读取
cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP
ADMIN_PASSWORD=$ADMIN_PASSWORD
DOMAIN=$DOMAIN
EOF

echo "[1/4] 检查 Docker ..."
if ! command -v docker &> /dev/null; then
    echo "安装 Docker ..."
    curl -fsSL https://get.docker.com | bash
fi
if ! docker compose version &> /dev/null; then
    echo "请安装 Docker Compose v2"
    exit 1
fi

echo "[2/4] 配置防火墙 ..."
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw allow 40000:49999/udp 2>/dev/null || true
iptables -I INPUT -p udp --dport 40000:49999 -j ACCEPT 2>/dev/null || true

echo "[3/4] 构建并启动 ..."
docker compose -f docker/docker-compose.yml down 2>/dev/null || true
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d

echo "[4/4] 等待服务就绪 ..."
sleep 5
curl -s http://127.0.0.1:3001/health || echo "Backend 尚未就绪，请检查日志: docker logs vc-backend"

echo ""
echo "========================================"
echo "  部署完成!"
echo ""
echo "  内部端口:"
echo "    Nginx (静态+代理): http://127.0.0.1:8080"
echo "    Backend (直接):    http://127.0.0.1:3001"
echo ""
echo "  配置你的反向代理:"
echo "    将 chat.pokepal.fun 反向代理到 http://127.0.0.1:8080"
echo "    或者直接代理到 http://127.0.0.1:3001"
echo ""
echo "  UDP 端口 (RTP): 40000-49999"
echo "========================================"
echo ""
echo "  查看日志: docker compose -f docker/docker-compose.yml logs -f"
echo ""
