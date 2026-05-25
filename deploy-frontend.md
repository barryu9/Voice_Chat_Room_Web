# 语音聊天室 - 前端部署指南

版本: **v2026.05.25.2**

## 服务器信息

| 项目 | 值 |
|---|---|
| IP | **38.95.75.238** |
| 域名 | **chat.pokepal.fun** |
| 服务端口 | 8080 (TCP) |
| 后端地址 | https://talk.pokepal.fun (120.76.229.15) |

## 容器组成

| 容器 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| vc-nginx | nginx:stable-alpine (自建) | 127.0.0.1:8080 | 前端静态文件 + WebSocket 代理 |

## 云安全组需开放

| 端口 | 协议 | 用途 |
|---|---|---|
| 22 | TCP | SSH |
| 443 | TCP | HTTPS |

## 部署

```bash
# 初次
git clone https://gitee.com/barrix/voice-chat-room.git
cd voice-chat-room
bash deploy-frontend.sh

# 更新
git pull
bash deploy-frontend.sh
```

### 脚本做了什么

1. 检查/安装 Docker
2. 检查后端连通性（本地 3001 端口）
3. 构建前端 Docker 镜像（Vite build → Nginx）
4. 启动 Nginx 容器
5. 状态验证

## 验证

```bash
# HTTP 状态
curl -I http://127.0.0.1:8080
# → HTTP/1.1 200 OK

# 容器状态
docker compose -f docker/frontend-compose.yml ps

# Nginx 日志
docker logs -f vc-nginx
```

## 反向代理

外部 Nginx 需要代理 `chat.pokepal.fun` → `127.0.0.1:8080`:

```nginx
server {
    listen 443 ssl http2;
    server_name chat.pokepal.fun;

    # SSL 证书配置...

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

> **注意**: 前端 Nginx 容器的 `default.conf` 已经将 `/socket.io/` 代理到后端 `host.docker.internal:3001`。外部反向代理只需将 `/socket.io/` 一并透传即可。

## 前端连接后端

生产环境配置在 `frontend/.env.production`:

```env
VITE_SOCKET_URL=https://talk.pokepal.fun
VITE_API_URL=https://talk.pokepal.fun/api
```

如果后端地址变更，修改此文件后重新部署。

## 常用操作

```bash
# 查看 Nginx 日志
docker logs -f vc-nginx

# 进入 Nginx 容器
docker exec -it vc-nginx sh

# 重启 Nginx
docker compose -f docker/frontend-compose.yml restart

# 重新构建部署
bash deploy-frontend.sh
```
