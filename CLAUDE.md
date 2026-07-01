# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Dev

```bash
# Terminal 1 — backend (nodemon auto-restart)
cd backend && npm run dev

# Terminal 2 — frontend (Vite HMR + HTTPS)
cd frontend && npm run dev
```

- Backend: `http://localhost:3001` (health: `/health`)
- Frontend: `https://localhost:5173` (HTTPS required for mic access)
- No extra `.env` file needed for dev — defaults in `backend/src/config/env.js` and `mongodb-memory-server` auto-start.
- **Windows note**: in PowerShell, use `cmd /c "npm run dev"` if execution policy blocks npm.

## Checks Before Committing

```bash
cd frontend && npx tsc --noEmit          # TypeScript check
cd backend && node --check src/index.js  # Syntax check (repeat for all modified .js)
```

## Architecture

**Project**: Real-time multi-user voice chat room. No registration — device fingerprint (FingerprintJS) + nickname. Users browse a channel lobby, join a room, then click "加入语音" to create a Mediasoup audio producer and appear in the voice grid.

### Backend (`backend/src/`)

```
index.js                   → Express + HTTP server, health endpoint, boot sequence
config/
  env.js                   → env vars with dev defaults, dotenv loading
  db.js                    → Mongoose connect, mongodb-memory-server fallback for dev
socket/
  index.js                 → Socket.io init, routes all events to handlers
  events.js                → EVENTS constant (CLIENT + SERVER event name pairs)
  handlers/
    connection.js           → Login/logout/reconnect lifecycle, Connections Map
    roomHandler.js          → Room join/leave/list/auto-delete
    transportHandler.js     → WebRTC transport creation (send/recv)
    producerHandler.js      → Producer create/close, NEW_PRODUCER broadcast
    consumerHandler.js      → Consumer create/pause/resume
    adminHandler.js         → Admin CRUD, bans, kicks, mutes, settings
    userChannelHandler.js   → User-created channel CRUD
mediasoup/
  mediasoupManager.js       → Single worker, router per room, WebRTC transports
  roomManager.js            → Room class: producers/consumers/transports/users Maps, VC states
  audioObserver.js          → AudioLevelObserver per room, broadcasts ACTIVE_SPEAKER
  consumerManager.js        → Consumer creation helpers
models/
  Channel.js                → Channel schema (name, maxUsers, password, type, audioBitrate, …)
  Ban.js                    → Ban schema (deviceId, reason, expiresAt)
  SiteSettings.js           → Site-wide settings schema
services/
  channelService.js         → Channel CRUD, announcements, site config
  configService.js          → Global feature flag defaults (config:multi_login, etc.)
  adminService.js           → Admin socket tracking
  banService.js / kickService.js / muteService.js
```

Key backend patterns:
- **Request-ACK**: admin writes emit ACK to sender + broadcast `room:info-updated` to room. Frontend shows toast ONLY on ACK — never on broadcast.
- **Room lifecycle**: Rooms are created lazily on first join (not pre-created). User-created rooms auto-delete after inactivity.
- **Reconnect**: 5s "fast" window (voice state preserved server-side), 60s grace period with `USER_RECONNECTING`/`USER_RECONNECTED` broadcast.
- **Speaker detection**: Server-side `AudioLevelObserver` (-55dB fixed threshold) — self and remote use the same signal.

### Frontend (`frontend/src/`)

```
App.tsx                    → Root: auto-login from cookie, loading screen, route Lobby vs RoomPanel
components/
  lobby/                   → Lobby, ChannelCard, NicknameModal, ChannelPasswordModal, CreateUserChannelModal, EditUserChannelModal
  room/                    → RoomPanel, UserGrid, UserCard, SpeakingIndicator
  audio/                   → AudioControls (mic popover), MicController, VoiceChangerControls, DeviceSelector, RemoteVolume, VoicePreviewModal
  admin/                   → AdminPanel (tabs: channels/announcement/bans/settings), AdminLogin, BanList
  common/                  → Toast, SettingsPanel, ThemeSwitcher, StepperInput, TechBackground, Announcement
services/                  → Module-level singletons (NOT classes), no React imports
  audioService.ts          → Local audio graph (mic→RNNoise→vocalEnhancer→AGC→gain→gate→VC→destination), remote <audio> elements
  socketService.ts         → ALL socket.io event handlers + connection management
  mediasoupService.ts      → Device, transports, producer creation, consumer subscribing
  voiceChangerService.ts   → Tone.js effect chain (pitch/distortion/filter/reverb)
  rnnoiseService.ts        → RNNoise WASM loader and node management
  voiceSessionService.ts   → Join/leave voice flow orchestration
  soundService.ts          → Sound effect playback (join/leave/notification sounds)
  vocalEnhancerService.ts  → Tone.js-based 80Hz low-cut filter
stores/                    → Zustand stores (userStore, roomStore, mediaStore, adminStore, voiceChangerStore, soundStore)
hooks/                     → React <-> service bridge layer (useAudioGraph, useDevices, useMediasoup, useSocket, useTheme, useDeviceId, useLatency, useInstallPrompt)
utils/
  constants.ts             → EVENTS, Channel type, AUDIO_QUALITY_TIERS
  voicePresets.ts          → Voice changer preset definitions
  helpers.ts / cookies.ts / hash.ts
```

Key frontend patterns:
- **Component ← Hook ← Service ← Store** — Components never call services directly. Hooks bridge React state and the service layer.
- **Audio graph**: All routing goes through `reconnectAudioGraph()` in `audioService.ts`. Nodes are disconnected and reconnected in order on any toggle — never directly connect/disconnect outside this function.
- **Remote playback**: Native `<audio>` elements (NOT Web Audio API) for cross-browser stability.
- **Theme**: Two independent dimensions — appearance (暗夜/日光/涂鸦/极黑/霓虹/纸张/海盐/漫画) and primary color (红/黄/蓝/绿/青/紫/粉/橙 + custom). CSS variables drive it via Tailwind `primary-*` tokens.
- **localStorage keys**: All prefixed with `vc_` (e.g., `vc_gain`, `vc_muted`, `vc_voice_changer`).

### Audio Pipeline (Browser-side)

```
Mic → RNNoise → VocalEnhancer (80Hz low-cut) → AGC → Manual Gain → Peak Limiter → Noise Gate → Voice Changer → Mediasoup Producer
```

- Browser native `noiseSuppression` and `autoGainControl` are **always off** (RNNoise + custom AGC instead).
- Voice Changer is the **last** stage before the producer — it processes the fully conditioned signal.
- Adding a new audio effect: create a service, add branch in `reconnectAudioGraph()`, lazy-init on first use, disconnect (don't destroy) when toggled off.

### Deployment

```bash
git pull && bash deploy.sh          # full-stack (backend server)
bash deploy-backend.sh              # backend only
bash deploy-frontend.sh             # frontend only
```

- Docker Compose: mongo + backend (`node:22-slim`, NOT alpine) + nginx
- Backend uses `network_mode: host` for UDP RTP on ports 40000-49999
- Config via `deploy.conf` → generates `docker/.env`

## What's Where

- Detailed coding conventions, UI patterns, toast rules, feature toggle checklist, store patterns → [AGENTS.md](AGENTS.md)
- Deployment guide, Nginx config, troubleshooting → [DEPLOY.md](DEPLOY.md)
- Frontend event constants and `Channel` type → [frontend/src/utils/constants.ts](frontend/src/utils/constants.ts)
- Backend event constants → [backend/src/socket/events.js](backend/src/socket/events.js)
- Backend env/config defaults → [backend/src/config/env.js](backend/src/config/env.js)
- Docker setup → [docker/docker-compose.yml](docker/docker-compose.yml)
