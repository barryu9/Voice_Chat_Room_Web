# Voice Chat Room

[中文](./README.md)

A lightweight real-time voice chat room with no account registration. Users enter with a nickname, browse channels, and only appear in the room grid after they actually join voice. The project focuses on stable voice transport, practical microphone processing, theme-aware UI, and simple administration for small groups.

## Features

- No registration: users are identified by FingerprintJS, with a local random ID fallback.
- Channel lobby: supports system channels and user-created channels with capacity limits, passwords, announcements, and admin configuration.
- Real-time voice: Mediasoup SFU transport; users appear in the room grid only after joining voice.
- Microphone processing: RNNoise denoise, browser echo cancellation, custom AGC, manual gain, peak limiting, voice threshold, and mute.
- Vocal clarity: Tone.js shares the existing AudioContext; the current enhancer keeps an 80Hz high-pass filter to reduce low-end rumble.
- Voice changer: applied at the end of the local chain, right before sending to the server, so the final processed voice is transformed.
- Sound effects: preference modal supports toggling and previewing notification sounds.
- Per-user output volume: users can adjust master output and individual remote users.
- Speaking state: server-side AudioLevelObserver drives speaking status for every user, including yourself.
- Appearance system: appearance style and primary color are independent. Built-in appearances include Night, Sunlight, Doodle, Blackout, Neon, Paper, Sea Salt, and Comic.
- Theme-aware UI: buttons, alerts, switches, sliders, speaking glows, and current-appearance indicators adapt to the selected theme.
- Admin panel: channel management, announcements, bans, kicks, and site settings.
- Deployment ready: Docker Compose, Nginx, and MongoDB configuration included.

## Tech Stack

**Frontend**

- React 18 + TypeScript + Vite
- TailwindCSS
- Zustand
- Socket.io-client
- mediasoup-client
- Tone.js

**Backend**

- Node.js + Express
- Socket.io
- Mediasoup 3.x
- Mongoose
- mongodb-memory-server fallback for local development

**Deployment**

- Docker + Docker Compose
- MongoDB
- Nginx

## Quick Start

### 1. Clone

```bash
git clone <your-repo-url>
cd voice-chat-room
```

### 2. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Run development servers

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Default URLs:

- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/health`
- Frontend: `https://localhost:5173`

> Browsers usually require HTTPS or localhost for microphone access. The Vite HTTPS setup helps LAN testing request microphone permission correctly.

## Audio Pipeline

The server does not modify user audio. It only forwards media and observes audio levels for speaking status. Microphone processing happens locally in the browser.

```text
Microphone input
  -> RNNoise denoise
  -> Vocal clarity 80Hz high-pass
  -> Custom AGC
  -> Manual gain / mute
  -> Peak limiter
  -> Voice threshold / noise gate
  -> Voice changer
  -> Mediasoup Producer
```

Current audio decisions:

- Browser-native `echoCancellation` is toggleable in microphone settings and defaults to on.
- Browser-native `noiseSuppression` is forced off to avoid mixing it with RNNoise.
- Browser-native `autoGainControl` is forced off; the app uses its own AGC.
- Custom AGC defaults to on, targets about `-24dB`, and uses a `0.5x ~ 5.0x` gain range.
- Peak limiting can be enabled manually; it is automatically active whenever AGC is on.
- Manual microphone gain is applied after AGC as a user fine-tuning step.
- The voice changer is the final stage before sending audio to the server.

Remote audio playback uses native `<audio>` elements instead of Web Audio for better cross-browser reliability.

## Speaking State

The backend uses Mediasoup `AudioLevelObserver` to detect active speakers and broadcasts that state to room clients. The frontend no longer uses a separate local-only rule for your own card, so what you see matches what other users see.

When a user is speaking, the card shows:

- Avatar ripple
- Theme-aware card glow
- Green speaker icon next to the nickname

The card no longer scales while speaking.

## Appearance And Preferences

Both the login page and the channel page use the preference modal for appearance, primary color, and sound settings. Appearance controls the visual style, while primary color controls the accent color.

Built-in appearances:

- Night
- Sunlight
- Doodle
- Blackout
- Neon
- Paper
- Sea Salt
- Comic

Built-in primary colors:

- Red, yellow, blue, green, cyan, purple, pink, orange
- Custom color for dark appearances
- Custom color for light appearances

## Admin Panel

Admins can:

- Create, edit, and delete channels
- Configure capacity, passwords, and feature switches
- Publish and manage announcements
- Kick users
- Ban users
- Update site settings

Admin operations use a request-ACK pattern: the frontend waits for the backend acknowledgement before showing success feedback.

## Production Deployment

Docker Compose deployment is included:

```bash
git pull
bash deploy.sh
```

Production layout:

```text
Internet
  -> Your reverse proxy / TLS
  -> Nginx container
     -> frontend static files
     -> backend 127.0.0.1:3001
        -> Mediasoup RTP UDP 40000-49999
        -> MongoDB
```

Notes:

- The backend image uses `node:22-slim`; do not switch it to alpine because Mediasoup has poor compatibility with musl.
- Backend binds to `127.0.0.1:3001` by default.
- Nginx binds to `127.0.0.1:8080` by default.
- UDP `40000-49999` must be open for WebRTC RTP.
- Frontend and backend WebSocket/API domains must be configured correctly in environment variables.

## Project Structure

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

## Common Checks

Frontend type check:

```bash
cd frontend
npx tsc --noEmit
```

Frontend production build:

```bash
cd frontend
npx vite build
```

Backend syntax check example:

```bash
cd backend
node --check src/server.js
```

## License

MIT
