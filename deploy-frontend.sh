#!/bin/bash
# === 语音聊天室 - 前端部署 ===
# 服务器上执行: bash deploy-frontend.sh
# 部署: Nginx 静态文件，绑定 127.0.0.1:8080
# 需要外部反向代理: chat.pokepal.fun → 127.0.0.1:8080

set -e

echo "========================================"
echo "  语音聊天室 - 前端部署"
echo "  域名: chat.pokepal.fun → 127.0.0.1:8080"
echo "========================================"

echo "[1/3] 检查 Docker ..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
fi

echo "[2/3] 构建并启动 ..."
docker compose -f docker/frontend-compose.yml down 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker compose -f docker/frontend-compose.yml build --no-cache
docker compose -f docker/frontend-compose.yml up -d

echo "[3/3] 验证 ..."
sleep 3
curl -s -o /dev/null -w "  Nginx 状态: %{http_code}\n" http://127.0.0.1:8080/ || echo "  等待启动中..."

echo ""
echo "========================================"
echo "  前端部署完成!"
echo "  绑定: 127.0.0.1:8080"
echo "  反代: chat.pokepal.fun → 127.0.0.1:8080"
echo "========================================"
