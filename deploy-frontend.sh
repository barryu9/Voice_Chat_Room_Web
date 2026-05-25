#!/bin/bash
# === 语音聊天室 - 前端部署 ===
# 在服务器上执行: bash deploy-frontend.sh
# 部署: Nginx 静态文件 (独立运行)，绑定 127.0.0.1:8080
#
# 需要外部反向代理: chat.pokepal.fun → 127.0.0.1:8080
# Socket.io 代理需要支持 WebSocket 升级

set -e

DOMAIN_FRONTEND="chat.pokepal.fun"
BACKEND_URL="https://talk.pokepal.fun"

echo "========================================"
echo "  语音聊天室 - 前端部署"
echo "  前端:  https://$DOMAIN_FRONTEND"
echo "  后端:  $BACKEND_URL"
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
# [2/4] 确保后端可达
# ============================================================
echo "[2/4] 检查后端连通性..."
echo -n "  后端 (3001): "
HEALTH=$(curl -s http://127.0.0.1:3001/health 2>/dev/null || echo 'unreachable')
echo "$HEALTH"
if [ "$HEALTH" = "unreachable" ]; then
    echo "  警告: 本地后端未运行。"
    echo "  前端需要连接到 $BACKEND_URL。"
    echo "  如果后端在其他服务器，请确保 frontend/.env.production 中的 VITE_SOCKET_URL 正确。"
fi

# ============================================================
# [3/4] 构建并启动
# ============================================================
echo "[3/4] 构建并启动 Nginx 容器..."
docker compose -f docker/frontend-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/frontend-compose.yml build --no-cache
docker compose -f docker/frontend-compose.yml up -d
echo "  Nginx 容器已启动 ✓"

# ============================================================
# [4/4] 验证
# ============================================================
echo "[4/4] 验证服务状态..."
sleep 3

echo -n "  前端 (8080): "
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/ 2>/dev/null || echo "000")
echo "HTTP $FRONTEND_CODE"

echo ""
echo "========================================"
echo "  前端部署完成!"
echo "  绑定: 127.0.0.1:8080"
echo ""
echo "  反向代理配置:"
echo "    $DOMAIN_FRONTEND → http://127.0.0.1:8080"
echo ""
echo "  Nginx location /socket.io/ 需要代理 WebSocket 到后端"
echo "  详情参见 DEPLOY.md"
echo ""
echo "  常用命令:"
echo "    docker compose -f docker/frontend-compose.yml logs -f"
echo "    bash deploy-frontend.sh   # 更新部署"
echo "========================================"
