#!/bin/bash
# === 语音聊天室 - 后端部署 ===
# 在服务器上执行: bash deploy-backend.sh
# 部署: MongoDB + Mediasoup 后端 (不含前端 Nginx)
#
# 外部反向代理: talk.pokepal.fun → 0.0.0.0:3001

set -e

PUBLIC_IP="38.95.75.238"
ADMIN_PASSWORD="barry422"
DOMAIN_BACKEND="talk.pokepal.fun"

# ============================================================
# 创建 .env
# ============================================================
cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

echo "========================================"
echo "  语音聊天室 - 后端部署"
echo "  域名:  https://$DOMAIN_BACKEND"
echo "  IP:    $PUBLIC_IP"
echo "  版本:  v2026.05.25.1"
echo "========================================"

# ============================================================
# [1/4] 安装 Docker
# ============================================================
echo "[1/4] 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    echo "  Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | bash
fi
if ! command -v docker &> /dev/null; then
    echo "  ERROR: Docker 安装失败"
    exit 1
fi
echo "  Docker $(docker --version) ✓"

# ============================================================
# [2/4] 防火墙
# ============================================================
echo "[2/4] 配置防火墙..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 3001/tcp 2>/dev/null || true
ufw allow 40000:49999/udp 2>/dev/null || true
iptables -I INPUT -p udp --dport 40000:49999 -j ACCEPT 2>/dev/null || true
echo "  TCP: 22, 3001 | UDP: 40000-49999 ✓"

# ============================================================
# [3/4] 拉取镜像 + 构建
# ============================================================
echo "[3/4] 构建并启动容器..."
docker pull mongo:7.0 2>/dev/null || true
docker compose -f docker/docker-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d mongo backend
echo "  后端容器已启动 ✓"

# ============================================================
# [4/4] 验证
# ============================================================
echo "[4/4] 验证服务状态..."
sleep 5

echo -n "  后端 (3001): "
HEALTH=$(curl -s http://127.0.0.1:3001/health 2>/dev/null || echo '{"status":"unreachable"}')
echo "$HEALTH"

echo ""
echo "========================================"
echo "  后端部署完成!"
echo "  反代: $DOMAIN_BACKEND → 0.0.0.0:3001"
echo "  WebRTC UDP: $PUBLIC_IP:40000-49999"
echo ""
echo "  常用命令:"
echo "    docker compose -f docker/docker-compose.yml logs -f backend"
echo "    docker compose -f docker/docker-compose.yml restart backend"
echo "========================================"
