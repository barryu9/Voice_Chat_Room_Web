# 语音聊天室 - 后端部署指南

版本: **v2026.05.25.2**

## 服务器信息

| 项目 | 值 |
|---|---|
| IP | **120.76.229.15** |
| 域名 | **talk.pokepal.fun** |
| 服务端口 | 3001 (TCP) |
| WebRTC UDP | 40000-49999 |

## 容器组成

| 容器 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| vc-mongo | mongo:7.0 | 127.0.0.1:27017 | 数据库 |
| vc-backend | node:22-slim (自建) | 0.0.0.0:3001 | Mediasoup 信令 + Socket.io |

## 云安全组需开放

| 端口 | 协议 | 用途 |
|---|---|---|
| 22 | TCP | SSH |
| 443 | TCP | HTTPS |
| 3001 | TCP | 后端 API + WebSocket |
| 40000-49999 | UDP | WebRTC RTP 媒体流 |

## 部署

```bash
# 初次
git clone https://gitee.com/barrix/voice-chat-room.git
cd voice-chat-room
bash deploy-backend.sh

# 更新
git pull
bash deploy-backend.sh
```

### 脚本做了什么

1. 检查/安装 Docker
2. 配置防火墙 (UFW + iptables): TCP 22,3001 + UDP 40000-49999
3. 生成 `docker/.env` (PUBLIC_IP, ADMIN_PASSWORD)
4. 拉取 mongo:7.0 基础镜像
5. 构建后端 Docker 镜像并启动 mongo + backend 容器
6. 健康检查

## 验证

```bash
# 健康检查
curl http://127.0.0.1:3001/health
# → {"status":"ok","uptime":123,"rooms":3}

# 容器状态
docker compose -f docker/docker-compose.yml ps

# 后端日志
docker compose -f docker/docker-compose.yml logs -f backend
```

## 反向代理

外部 Nginx 需要代理 `talk.pokepal.fun` → `127.0.0.1:3001`:

```nginx
server {
    listen 443 ssl http2;
    server_name talk.pokepal.fun;

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

## 常用操作

```bash
# 查看后端日志
docker logs -f vc-backend

# 重启后端
docker compose -f docker/docker-compose.yml restart backend

# 进入后端容器
docker exec -it vc-backend sh

# 查看 MongoDB 数据
docker exec -it vc-mongo mongosh voice-chat-prod --eval "db.channels.find().pretty()"

# 清理 Docker 缓存
docker builder prune -af
docker system prune -f
```

## 环境变量

部署脚本自动生成 `docker/.env`:

| 变量 | 值 |
|---|---|
| `NODE_ENV` | production |
| `PORT` | 3001 |
| `HOST` | 0.0.0.0 |
| `MONGODB_URI` | mongodb://127.0.0.1:27017/voice-chat-prod |
| `MEDIASOUP_LISTEN_IP` | 0.0.0.0 |
| `MEDIASOUP_ANNOUNCED_IP` | 120.76.229.15 |
| `MEDIASOUP_RTC_MIN_PORT` | 40000 |
| `MEDIASOUP_RTC_MAX_PORT` | 49999 |
| `ADMIN_PASSWORD` | barry422 |
| `CORS_ORIGIN` | https://chat.pokepal.fun |

## 数据持久化

MongoDB 数据存储在 Docker Volume `mongo-data`:

```bash
# 查看 volume
docker volume ls | grep mongo-data

# 备份数据库
docker exec vc-mongo mongodump --db voice-chat-prod --out /data/backup
docker cp vc-mongo:/data/backup ./mongo-backup/
```
