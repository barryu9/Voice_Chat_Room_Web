#!/bin/bash
# === 语音聊天室 - 全栈部署（后端服务器）===
# 在后端服务器 (120.76.229.15) 上执行: bash deploy.sh
# 部署: MongoDB + Mediasoup 后端 + Nginx 前端
# 版本: v2026.05.25.2

set -e

PUBLIC_IP="120.76.229.15"
ADMIN_PASSWORD="barry422"

cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

echo "========================================"
echo "  语音聊天室 - 全栈部署"
echo "  后端:   https://talk.pokepal.fun"
echo "  服务器: $PUBLIC_IP"
echo "  版本:   v2026.05.25.2"
echo "========================================"

# ============================================================
# [1/5] Docker
# ============================================================
echo "[1/5] 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
fi
docker --version > /dev/null || { echo "  ERROR: Docker 安装失败"; exit 1; }
echo "  Docker $(docker --version 2>&1 | head -1) ✓"

# ============================================================
# [2/5] 防火墙
# ============================================================
echo "[2/5] 配置防火墙..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 3001/tcp 2>/dev/null || true
ufw allow 40000:49999/udp 2>/dev/null || true
iptables -I INPUT -p udp --dport 40000:49999 -j ACCEPT 2>/dev/null || true
echo "  TCP: 22, 3001 | UDP: 40000-49999 ✓"

# ============================================================
# [3/5] 拉取基础镜像
# ============================================================
echo "[3/5] 拉取基础镜像..."
docker pull mongo:7.0 &
docker pull nginx:stable-alpine &
docker pull node:22-slim &
wait
echo "  基础镜像就绪 ✓"

# ============================================================
# [4/5] 构建并启动
# ============================================================
echo "[4/5] 构建并启动容器..."
docker compose -f docker/docker-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d
echo "  容器已启动 ✓"

# ============================================================
# [5/5] 验证
# ============================================================
echo "[5/5] 验证服务状态..."
sleep 5

echo -n "  后端 (3001): "
HEALTH=$(curl -s http://127.0.0.1:3001/health 2>/dev/null || echo '{"status":"unreachable"}')
echo "$HEALTH"

echo -n "  前端 (8080): "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/ 2>/dev/null || echo "000"

echo ""
echo "  容器状态:"
docker compose -f docker/docker-compose.yml ps

echo ""
echo "========================================"
echo "  全栈部署完成!"
echo ""
echo "  外部反向代理:"
echo "    chat.pokepal.fun → http://38.95.75.238:8080   (前端)"
echo "    talk.pokepal.fun → http://120.76.229.15:3001  (后端)"
echo ""
echo "  WebRTC UDP: $PUBLIC_IP:40000-49999"
echo ""
echo "  常用命令:"
echo "    docker compose -f docker/docker-compose.yml logs -f"
echo "    docker compose -f docker/docker-compose.yml restart"
echo "    bash deploy.sh   # 更新部署"
echo "========================================"
