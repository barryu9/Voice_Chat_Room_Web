#!/bin/bash
# === 语音聊天室 - 前端部署 ===
# 在前端服务器 (38.95.75.238) 上执行: bash deploy-frontend.sh
# 部署: Nginx 静态文件，绑定 127.0.0.1:8080
# 后端运行在 120.76.229.15:3001 (talk.pokepal.fun)
# 版本: v2026.05.25.2

set -e

echo "========================================"
echo "  语音聊天室 - 前端部署"
echo "  前端:  https://chat.pokepal.fun"
echo "  服务器: 38.95.75.238"
echo "  后端:  https://talk.pokepal.fun (120.76.229.15)"
echo "  版本:  v2026.05.25.2"
echo "========================================"

echo "[1/3] 检查 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
fi
echo "  Docker $(docker --version 2>&1 | head -1) ✓"

echo "[2/3] 构建并启动 Nginx..."
docker compose -f docker/frontend-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/frontend-compose.yml build --no-cache
docker compose -f docker/frontend-compose.yml up -d
echo "  前端容器已启动 ✓"

echo "[3/3] 验证..."
sleep 3
echo -n "  前端 (8080): "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/ 2>/dev/null || echo "000"

echo ""
echo "========================================"
echo "  前端部署完成!"
echo "  chat.pokepal.fun → 127.0.0.1:8080"
echo "========================================"
