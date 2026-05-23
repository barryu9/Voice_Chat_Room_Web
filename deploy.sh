#!/bin/bash
# === 语音聊天室 - 一键部署脚本 ===
# 使用: bash deploy.sh <公网IP> <管理员密码> <域名或IP>
# 示例: bash deploy.sh 1.2.3.4 mypassword voice.example.com
# 最小: bash deploy.sh 1.2.3.4 mypassword 1.2.3.4

set -e

if [ $# -lt 3 ]; then
    echo "用法: bash deploy.sh <公网IP> <管理员密码> <域名或IP>"
    echo "示例: bash deploy.sh 1.2.3.4 mypassword 1.2.3.4"
    exit 1
fi

PUBLIC_IP=$1
ADMIN_PASSWORD=$2
DOMAIN=$3

echo "========================================"
echo "  语音聊天室 Docker 部署"
echo "========================================"
echo "  IP:       $PUBLIC_IP"
echo "  Domain:   $DOMAIN"
echo "  Admin:    ****"
echo "========================================"

# 写入 .env 供 docker-compose 读取
cat > docker/.env << EOF
PUBLIC_IP=$PUBLIC_IP
ADMIN_PASSWORD=$ADMIN_PASSWORD
DOMAIN=$DOMAIN
EOF

echo "[1/3] 清理旧容器 ..."
docker compose -f docker/docker-compose.yml down 2>/dev/null || true

echo "[2/3] 构建镜像 ..."
docker compose -f docker/docker-compose.yml build --no-cache

echo "[3/3] 启动服务 ..."
docker compose -f docker/docker-compose.yml up -d

echo ""
echo "========================================"
echo "  部署完成!"
echo "  访问地址: http://$DOMAIN"
echo "========================================"
echo ""
echo "  ⚠ 请确保云服务器防火墙已开放以下端口:"
echo "    TCP: 80, 443, 3001"
echo "    UDP: 40000-49999 (Mediasoup RTP)"
echo ""
echo "  ⚠ 如需 HTTPS:"
echo "    1. 将 SSL 证书放入 docker/nginx/ssl/fullchain.pem 和 privkey.pem"
echo "    2. 取消 docker/nginx/default.conf 中 HTTPS server 块的注释"
echo "    3. 重启 nginx: docker compose -f docker/docker-compose.yml restart nginx"
echo ""
