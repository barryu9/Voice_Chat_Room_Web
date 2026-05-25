#!/bin/bash
# === 语音聊天室 - 前端部署（前端服务器）===
# 在前端服务器 (38.95.75.238) 上执行: bash deploy-frontend.sh
# 部署: Nginx 静态文件 (独立运行)，绑定 127.0.0.1:8080
# 后端运行在 120.76.229.15:3001 (talk.pokepal.fun)
#
# 外部反向代理: chat.pokepal.fun → 127.0.0.1:8080
# Socket.io 代理需要支持 WebSocket 升级

set -e

BACKEND_URL="https://talk.pokepal.fun"

echo "========================================"
echo "  语音聊天室 - 前端部署"
echo "  前端:  https://chat.pokepal.fun"
echo "  服务器: 38.95.75.238"
echo "  后端:  $BACKEND_URL (120.76.229.15)"
echo "  版本:  v2026.05.25.1"
echo "========================================"

# ============================================================
# [1/3] 安装 Docker
# ============================================================
echo "[1/3] 检查 Docker 环境..."
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
# [2/3] 构建并启动
# ============================================================
echo "[2/3] 构建并启动 Nginx 容器..."
docker compose -f docker/frontend-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/frontend-compose.yml build --no-cache
docker compose -f docker/frontend-compose.yml up -d
echo "  Nginx 容器已启动 ✓"

# ============================================================
# [3/3] 验证
# ============================================================
echo "[3/3] 验证服务状态..."
sleep 3

echo -n "  前端 (8080): "
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/ 2>/dev/null || echo "000")
echo "HTTP $FRONTEND_CODE"

echo ""
echo "========================================"
echo "  前端部署完成!"
echo "  绑定: 127.0.0.1:8080"
echo ""
echo "  外部反向代理:"
echo "    chat.pokepal.fun → http://127.0.0.1:8080"
echo ""
echo "  Nginx 需要代理 WebSocket /socket.io/ 到 $BACKEND_URL"
echo "  详情参见 DEPLOY.md"
echo ""
echo "  常用命令:"
echo "    docker compose -f docker/frontend-compose.yml logs -f"
echo "    bash deploy-frontend.sh   # 更新部署"
echo "========================================"
