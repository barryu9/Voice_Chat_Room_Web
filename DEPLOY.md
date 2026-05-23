## 部署步骤（在服务器上执行）

### 1. 拉取代码
```bash
git clone https://gitee.com/barrix/voice-chat-room.git
cd voice-chat-room
```

### 2. 一键部署
```bash
bash deploy.sh
```

### 3. 验证
```bash
# 检查是否启动
docker compose -f docker/docker-compose.yml ps

# 测试后端
curl http://127.0.0.1:3001/health
# 应返回 {"status":"ok",...}

# 测试前端
curl http://127.0.0.1:8080
# 应返回 HTML
```

### 4. 配置你的反向代理

你需要代理到 `http://127.0.0.1:8080`（nginx 容器），或者直接代理到 `http://127.0.0.1:3001`（后端）。

**Nginx 示例配置：**
```nginx
server {
    listen 443 ssl http2;
    server_name chat.pokepal.fun;
    # ... 你的 SSL 证书配置 ...

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

### 5. 防火墙

确保云服务器安全组已开放：
| 端口 | 协议 | 用途 |
|------|------|------|
| 443 | TCP | HTTPS |
| 40000-49999 | UDP | WebRTC 流媒体 |

---

### 如果服务器无法访问 GitHub/Gitee

可以把整个项目目录打包上传：
```bash
# 在本地
cd D:\my_projects\voice-chat-room
tar --exclude=node_modules --exclude=dist -czf vc.tar.gz .

# scp 到服务器
scp -r vc.tar.gz root@38.95.75.238:/root/

# 在服务器上
mkdir -p voice-chat-room && cd voice-chat-room
tar -xzf ../vc.tar.gz
```
