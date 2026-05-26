# Project: voice-chat-room

## Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Zustand + mediasoup-client + Socket.io-client
- **Backend**: Node.js + Express + Socket.io + Mediasoup 3.x + Mongoose (+ mongodb-memory-server for dev)
- **Deploy**: Docker + Docker Compose (mongo + backend + nginx)

## Quick Dev
```bash
# Terminal 1 - backend (nodemon auto-restart)
cd backend && npm run dev

# Terminal 2 - frontend (Vite HMR)
cd frontend && npm run dev
```
- Backend: `http://localhost:3001` (health: `/health`)
- Frontend: `https://localhost:5173` or `https://192.168.31.14:5173` (LAN)

## Production URLs
- Frontend: `https://chat.pokepal.fun`
- Backend API/WS: `https://talk.pokepal.fun`
- Server IP: `38.95.75.238`
- RTP ports: UDP 40000-49999

## Deploy
```bash
git pull && bash deploy.sh
```
- Backend: `node:20-slim` (NOT alpine — mediasoup incompatible with musl)
- Backend binds `127.0.0.1:3001`, nginx binds `127.0.0.1:8080`
- User's own reverse proxy in front of both

## Key Design Decisions
- **No registration**: deviceId via FingerprintJS (fallback to localStorage random ID)
- **Voice-only room grid**: users appear ONLY after clicking "加入语音" (creating a producer)
- **Speaker indicator**: only shows when audio level > noise gate threshold (`mediaStore.noiseGateThreshold`, default -60dB)
- **Remote audio playback**: native `<audio>` elements (NOT Web Audio API) — more reliable across browsers
- **Voice disconnect**: emits `producer:close` via Socket.io to reliably trigger `USER_LEFT` broadcast
- **DB**: MongoDB for persistent config (channels, bans, settings); Node.js Map for volatile WebRTC state
- **Dev MongoDB**: mongodb-memory-server auto-starts when no MONGODB_URI set

## Architecture Flow
```
login → room:join (no USER_JOINED yet)
  → click "加入语音" → create Producer
    → broadcast USER_JOINED + NEW_PRODUCER
    → other clients consume and play via <audio>
  → click "断开语音" → emit producer:close
    → broadcast USER_LEFT (if last producer)
    → user removed from grid
```

## Common Issues Fixed
- dotenv path: `__dirname` is in `src/config/` → need `../..` to reach backend root
- `store.producer` was storing Transport, not Producer → fixed to capture `transport.produce()` return value
- Stop order: close transport BEFORE producer, otherwise `transportclose` doesn't fire
- AudioContext resume must be awaited
- Windows npm: must use `cmd /c "npm ..."` in PowerShell due to execution policy
- `npx tsc --noEmit` for TS check, `npx vite build` for production build

## Rules for Admin Panel Settings
- **All settings must show current values as defaults** — never show empty/placeholder values when editing
- **Every save action must give user feedback** — use `showToast('xxx已更新', 'success')` after each emit
- Settings must be re-fetched from server after save to ensure consistency (`admin:config-getall`)
- Use `useEffect` to sync UI state with current values when the panel opens
