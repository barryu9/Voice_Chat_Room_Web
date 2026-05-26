# 语音聊天室 - 部署指南

版本: **v2026.05.26.1**

## 架构

```
┌─────────────────────┐     ┌─────────────────────┐
│  前端服务器          │     │  后端服务器          │
│  <前端IP>            │     │  <后端IP>            │
│                     │     │                     │
│  Nginx (Docker)     │     │  Mediasoup (Docker)  │
│  127.0.0.1:8080     │◄───►│  0.0.0.0:3001        │
│                     │     │  MongoDB (Docker)    │
│  <前端域名>          │     │  <后端域名>          │
└─────────────────────┘     └─────────────────────┘
        WebRTC UDP: 40000-49999
```

## 快速开始

| 场景 | 在哪台服务器 | 命令 |
|---|---|---|
| 全栈部署 | 后端服务器 | `bash deploy.sh` |
| 仅后端 | 后端服务器 | `bash deploy-backend.sh` |
| 仅前端 | 前端服务器 | `bash deploy-frontend.sh` |

## 前置条件

- 复制 `deploy.conf.example` 为 `deploy.conf` 并填写实际值
- 服务器已安装 Git，能访问 Gitee
- 云服务器安全组已开放以下端口:

| 端口 | 协议 | 用途 | 服务器 |
|---|---|---|---|
| 22 | TCP | SSH | 两台 |
| 443 | TCP | HTTPS | 两台 |
| 3001 | TCP | 后端 API | 后端 |
| 8080 | TCP | 前端静态 | 前端 |
| 40000-49999 | UDP | WebRTC 媒体 | 后端 |

## 初次部署

### 1. 拉取代码

```bash
git clone https://gitee.com/barrix/voice-chat-room.git
cd voice-chat-room
cp deploy.conf.example deploy.conf
# 编辑 deploy.conf 填入实际的 IP、域名、密码
```

### 2. 上传屏蔽词库（可选）

```bash
cp frontend/src/utils/blockedWords.example.ts frontend/src/utils/blockedWords.ts
cp backend/src/utils/blockedWords.example.js backend/src/utils/blockedWords.js
# 编辑词库文件填入需要屏蔽的词汇
```

### 3. 运行部署脚本

```bash
# 全栈 (后端服务器)
bash deploy.sh

# 或仅后端 (后端服务器)
bash deploy-backend.sh

# 或仅前端 (前端服务器)
bash deploy-frontend.sh
```

### 4. 验证

```bash
# 后端健康检查
curl http://127.0.0.1:3001/health

# 前端状态
curl -I http://127.0.0.1:8080

# 容器状态
docker compose -f docker/docker-compose.yml ps
```

## 更新部署

```bash
cd voice-chat-room
git pull
bash deploy.sh
```

## 反向代理配置

### 前端 Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name <前端域名>;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
```

### 后端 Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name <后端域名>;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }
}
```

## 故障排查

```bash
# 查看日志
docker compose -f docker/docker-compose.yml logs -f

# 查看单个服务
docker compose -f docker/docker-compose.yml logs -f backend

# 重启服务
docker compose -f docker/docker-compose.yml restart

# 进入容器
docker exec -it vc-backend sh

# 查看端口监听
netstat -tlnp | grep -E "3001|8080|27017"

# 查看磁盘空间
df -h
docker system df
```

## 离线部署

如果服务器无法访问 Gitee:

```bash
# 本地打包
tar --exclude=node_modules --exclude=dist --exclude=.git -czf vc.tar.gz .
scp vc.tar.gz root@<服务器IP>:/root/

# 服务器解压
mkdir -p voice-chat-room && cd voice-chat-room
tar -xzf ../vc.tar.gz
```

## 环境变量

部署脚本自动从 `deploy.conf` 生成 `docker/.env`:

| 变量 | 说明 |
|---|---|
| `PUBLIC_IP` | 服务器公网 IP (WebRTC 信令) |
| `ADMIN_PASSWORD` | 管理面板密码 |
| `MONGODB_URI` | MongoDB 连接串 |
| `CORS_ORIGIN` | 前端域名 (HTTPS) |
