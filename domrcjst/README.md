# Domrcjst (DomeChat)

Anonymous chat with retro black/white theme, WebRTC video, and end‑to‑end encrypted text.

## Features
- First‑visit **Terms & Agreement** gate (stored in localStorage)
- Topic input and fast random pairing
- WebRTC video (peer‑to‑peer); DTLS‑SRTP encrypted
- **E2EE text** via ECDH (P‑256) + AES‑GCM with a simple SAS code to verify keys
- Ring‑light overlay toggle, ASCII retro background
- Mini‑games modal with **Rock‑Paper‑Scissors**
- “follow **domechat.live** on TikTok” badge (bottom‑left)

## Prereqs
- Node.js 16+
- (Optional) Your `Moldie.ttf` font. Put it at `public/assets/fonts/Moldie.ttf`

## Run locally
```bash
npm install
npm start
# open http://localhost:3000 in two tabs to test
```
> Tip: Browser will prompt for camera/microphone. Allow it.

## Deploy from GitHub to Railway
1. Create a new GitHub repo and push this folder:
   ```bash
   git init
   git add .
   git commit -m "domrcjst initial"
   git branch -M main
   git remote add origin https://github.com/<you>/domrcjst.git
   git push -u origin main
   ```
2. Go to https://railway.app → **New Project → Deploy from GitHub** → choose your repo.
3. Railway auto-detects Node. Set Start Command to:
   ```
   npm start
   ```
4. Deploy. Open the generated HTTPS URL (HTTPS is required for WebRTC).

### TURN server (recommended for reliability)
This app uses public **STUN** servers. For users behind strict NAT, add a **TURN** server:
- Get TURN credentials from a provider or run **coturn**.
- In `public/chat.html`, add to the `ICE` config:
  ```js
  const ICE = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: 'turn:YOUR_TURN_HOST:3478', username: 'USER', credential: 'PASS' }
    ]
  };
  ```

## Security Notes
- Text is encrypted E2E in the browser. The server relays only ciphertext and public keys.
- SAS (short auth string) appears after connection; partners can compare codes out‑of‑band.
- CSP headers are enabled in `server.js`.

## Customize
- Replace the “follow” text or move it in `styles.css` (#leftTop .small-text).
- Replace logo text in `index.html`.
- Add more mini games inside `#gameModal` using the existing Socket.IO wiring.

## Troubleshooting
- **No video?** Ensure you’re on HTTPS and granted camera/mic permissions.
- **Can’t connect?** Add a TURN server. Some networks block P2P.
- **Terms page loops?** Clear site data or ensure `localStorage` works (private browsing can block it).
