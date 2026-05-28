# Voice Chat Room

[中文](./README.md)

A **registration-free** real-time multi-user voice chat room with channels, voice changer, noise suppression, and volume controls.

> This project was developed **entirely through** [Opencode](https://opencode.ai) + **DeepSeek V4 Pro**, using vibe coding.
> See [AGENTS.md](./AGENTS.md) for detailed development conventions.

## Features

- **Anonymous Voice Chat** — No registration required; login via FingerprintJS device ID
- **Multi-Channel** — Default lobby + admin/user-created channels with password protection
- **Voice Changer** — 18 built-in presets (male-to-female, female-to-male, loli, robot, etc.) powered by Tone.js
- **Voice Preview** — Record 5 seconds and preview any preset before enabling
- **Mic Test** — One-click recording with playback through the current audio pipeline (gain + voice changer)
- **Real-time Noise Suppression** — AI-based RNNoise WASM, toggleable
- **Noise Gate** — Adjustable threshold (-60 ~ -30dB) to filter ambient noise
- **Per-User Volume** — Independent volume control for each remote user (0.1 ~ 1.0)
- **Speaking Indicator** — Green ring glow + audio bar animations
- **Admin Controls** — Kick, mute, ban, force-unmute
- **Announcements** — Site-wide and room-level announcements
- **Responsive Design** — Desktop and mobile support

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + Zustand |
| Real-time | Socket.io + Mediasoup (WebRTC SFU) |
| Audio Processing | Tone.js (voice changer) + simple-rnnoise-wasm (noise suppression) |
| Backend | Node.js + Express + Mediasoup 3.x |
| Database | MongoDB + Mongoose |
| Deployment | Docker + Docker Compose (Mongo + Backend + Nginx) |

## Quick Start (Development)

```bash
# 1. Backend (nodemon with hot reload)
cd backend && npm run dev

# 2. Frontend (Vite HMR)
cd frontend && npm run dev
```

- Backend: `http://localhost:3001` (health check: `/health`)
- Frontend: `https://localhost:5173` (LAN IP auto-detected)
- Dev MongoDB auto-starts via `mongodb-memory-server` — no manual setup needed

### ⚠️ Browser Security Policy

Except for `localhost` and `127.0.0.1`, modern browsers require **HTTPS/WSS** to access the microphone. Solutions:

1. **Production** — Bind a domain and obtain an SSL/TLS certificate (e.g., Let's Encrypt).
2. **LAN debugging** — Use a self-signed certificate and skip the browser warning (Vite dev server uses a self-signed cert by default).
3. **Chrome-based browsers** — Navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure` and whitelist your LAN or public IP.

> Even with a valid SSL/TLS certificate, IP-only addresses will still trigger a browser security warning — users must manually bypass it.

### Admin Panel

Append `?admin` to the URL (e.g., `https://localhost:5173/?admin`) to reveal the **⚙ Admin** button. Click it, enter the admin password, and access:

- Channel management (create / edit / delete / reorder)
- User management (kick / mute / ban / force-unmute)
- Announcement publishing
- Global settings (site name, voice changer toggle, channel limits, etc.)

## Production Deployment

```bash
# 1. Configure environment
cp deploy.conf.example deploy.conf
# Edit deploy.conf with your public IP and admin password

# 2. One-click deploy (requires Docker)
git pull && bash deploy.sh
```

### Docker Architecture

```
┌─────────────────────────────────────────┐
│  docker compose                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │ MongoDB │  │ Backend  │ │  Nginx  │  │
│  │ :27017  │  │ :3001    │ │ :8080   │  │
│  └──────────┘ └──────────┘ └─────────┘  │
│                     ↑                    │
│              UDP 40000-49999            │
│              (Mediasoup RTP)            │
└─────────────────────────────────────────┘
```

- Backend uses `node:20-slim` (**not** alpine — Mediasoup is incompatible with musl)
- Backend listens on `127.0.0.1:3001`, Nginx on `127.0.0.1:8080`
- Ensure RTP ports (UDP 40000-49999) are open before deployment
- Your own reverse proxy (e.g., Nginx/Caddy) in front of both ports

## Audio Pipeline

```
Mic → Gain → [Voice Changer (Tone.js)] → Analyser → [Noise Supp. (RNNoise)] → Noise Gate → SFU
                                                                                     ↓
Remote Users ← <audio> ← GainNode ← MediaElementSource ← SFU Consumer
```

- Local chain: Gain → Voice Changer → Noise Suppression → Noise Gate → Mediasoup Producer
- Remote audio: Native `<audio>` elements, routed through GainNode for volume control
- Voice preview/test use independent processing chains — no interference with main audio

## Project Structure

```
voice-chat-room/
├── frontend/               # React + TypeScript + Vite
│   └── src/
│       ├── components/     # UI components
│       │   ├── audio/      # Audio controls (voice changer, preview, test, volume)
│       │   ├── admin/      # Admin panel
│       │   ├── lobby/      # Channel lobby
│       │   └── room/       # Voice room (user cards, grid)
│       ├── services/       # Audio service layer (voice changer, noise supp., preview)
│       ├── stores/         # Zustand state management
│       ├── hooks/          # Custom hooks
│       └── utils/          # Constants, presets, helpers
├── backend/                # Node.js + Express + Socket.io
│   └── src/
│       ├── socket/         # Socket event handling
│       │   └── handlers/   # Login, room, admin, producer handlers
│       ├── mediasoup/      # WebRTC SFU (Router, AudioObserver)
│       ├── models/         # Mongoose data models
│       └── services/       # Business logic (channels, config, bans)
└── docker/                 # Docker deployment files
    ├── docker-compose.yml
    ├── backend.Dockerfile
    └── frontend.Dockerfile
```

## License

MIT

---

*Built with ❤️ by vibe coding using [Opencode](https://opencode.ai) + DeepSeek V4 Pro*
