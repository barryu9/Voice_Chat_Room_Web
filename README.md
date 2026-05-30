# Voice Chat Room 语音聊天室

[English](./README_EN.md)

一个轻量、无需注册的实时多人语音聊天室。用户输入昵称即可进入频道列表，点击“加入语音”后才会出现在频道成员网格中。项目专注于稳定的语音通话、清晰的麦克风处理、主题化界面，以及适合小团队或朋友临时开麦的管理能力。

## 主要功能

- 无注册登录：基于设备指纹识别用户，失败时自动使用本地随机 ID。
- 频道大厅：支持系统频道和用户自建频道，可设置人数上限、密码、公告和管理配置。
- 实时语音：基于 Mediasoup SFU，语音成员只在真正加入语音后显示。
- 麦克风处理：支持 RNNoise 降噪、浏览器原生回声消除、自研自动增益、手动增益、峰值限制、收声阈值和静音。
- 人声清晰：使用 Tone.js 共享现有 AudioContext，目前保留 80Hz 低切，减少低频轰鸣。
- 变声器：变声效果位于本地处理链路最后、发送到服务端之前，保证效果完整作用于最终语音。
- 提示音系统：偏好设置中可开关并预览提示音。
- 独立音量：支持总音量和单独调节其他用户音量。
- 说话状态：服务端 AudioLevelObserver 统一判断所有用户的说话状态，自己的卡片也使用同一套触发条件。
- 主题系统：外观和主题色分离，支持暗夜、日光、涂鸦、极黑、霓虹、纸张、海盐、漫画，以及红、黄、蓝、绿、青、紫、粉、橙和自定义主题色。
- 主题化 UI：按钮、提示、单选开关、音量条、正在说话光效、当前外观指示器等都会随主题变化。
- 管理面板：支持频道管理、公告、封禁、踢出、站点设置等能力。
- 部署友好：提供 Docker Compose、Nginx 和 MongoDB 配置。

## 技术栈

**前端**

- React 18 + TypeScript + Vite
- TailwindCSS
- Zustand
- Socket.io-client
- mediasoup-client
- Tone.js

**后端**

- Node.js + Express
- Socket.io
- Mediasoup 3.x
- Mongoose
- mongodb-memory-server 开发环境兜底

**部署**

- Docker + Docker Compose
- MongoDB
- Nginx

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd voice-chat-room
```

### 2. 安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. 启动开发环境

终端 1：

```bash
cd backend
npm run dev
```

终端 2：

```bash
cd frontend
npm run dev
```

默认地址：

- 后端：`http://localhost:3001`
- 健康检查：`http://localhost:3001/health`
- 前端：`https://localhost:5173`

> 浏览器采集麦克风通常要求 HTTPS 或 localhost。开发环境的 Vite HTTPS 配置是为了让局域网调试也能正常申请麦克风权限。

## 音频链路

本项目不在服务端修改用户音频。服务端负责转发和说话状态观测，所有麦克风处理都发生在本地浏览器中。

```text
麦克风输入
  -> RNNoise 降噪
  -> 人声清晰 80Hz 低切
  -> 自研 AGC 自动增益
  -> 手动增益 / 静音
  -> 峰值限制
  -> 收声阈值 / 噪声门
  -> 变声器
  -> Mediasoup Producer
```

当前关键策略：

- 浏览器原生 `echoCancellation` 可在麦克风设置中开关，默认开启。
- 浏览器原生 `noiseSuppression` 固定关闭，避免和 RNNoise 混用。
- 浏览器原生 `autoGainControl` 固定关闭，使用项目内自研 AGC。
- 自研 AGC 默认开启，目标电平约为 `-24dB`，增益范围为 `0.5x ~ 5.0x`。
- 峰值限制可单独开启；当自动增益开启时，峰值限制会自动生效。
- 手动麦克风增益作为 AGC 之后的微调。
- 变声器位于链路末尾，确保降噪、增益和限制后的声音再进入变声处理。

远端播放使用原生 `<audio>` 元素，不接入 Web Audio 图，以提高跨浏览器稳定性。

## 说话状态

后端通过 Mediasoup `AudioLevelObserver` 判断正在说话的用户，并广播给房间内客户端。前端不再用本地音量单独判断自己的说话状态，因此自己看到的状态和其他人看到的状态保持一致。

用户卡片在说话时会显示：

- 头像外扩散波纹
- 主题化卡片光效
- 昵称旁的绿色扬声器图标

卡片本身不会再因为说话而放大。

## 外观与偏好设置

登录页和频道页都使用偏好设置弹窗管理外观、主题色和提示音。外观决定整体视觉风格，主题色决定主色调，两者互相独立。

可用外观：

- 暗夜
- 日光
- 涂鸦
- 极黑
- 霓虹
- 纸张
- 海盐
- 漫画

可用主题色：

- 红、黄、蓝、绿、青、紫、粉、橙
- 自定义深色主题色
- 自定义浅色主题色

## 管理能力

管理员可以在管理面板中处理：

- 创建、编辑、删除频道
- 配置频道人数、密码和功能开关
- 发布和管理公告
- 踢出用户
- 封禁用户
- 修改站点设置

管理操作采用请求-确认模式：前端等待后端 ACK 后再显示成功提示，避免误报保存成功。

## 生产部署

项目提供 Docker Compose 部署方式：

```bash
git pull
bash deploy.sh
```

生产结构：

```text
Internet
  -> Your reverse proxy / TLS
  -> Nginx container
     -> frontend static files
     -> backend 127.0.0.1:3001
        -> Mediasoup RTP UDP 40000-49999
        -> MongoDB
```

注意事项：

- 后端镜像使用 `node:22-slim`，不要改成 alpine，Mediasoup 与 musl 兼容性较差。
- 后端默认绑定 `127.0.0.1:3001`。
- Nginx 默认绑定 `127.0.0.1:8080`。
- 需要开放 UDP `40000-49999` 给 WebRTC RTP 使用。
- 前端域名和后端 WebSocket/API 域名需要在环境变量中正确配置。

## 项目结构

```text
voice-chat-room/
  backend/
    src/
      config/
      handlers/
      mediasoup/
      models/
      services/
      utils/
  frontend/
    src/
      components/
      hooks/
      services/
      stores/
      types/
      utils/
  docker-compose.yml
  deploy.sh
```

## 常用检查

前端类型检查：

```bash
cd frontend
npx tsc --noEmit
```

前端生产构建：

```bash
cd frontend
npx vite build
```

后端单文件语法检查示例：

```bash
cd backend
node --check src/server.js
```

## 许可证

MIT
