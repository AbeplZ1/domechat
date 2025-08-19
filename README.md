
# DomeChat — ULTRA FINAL

Everything you asked for, consolidated and polished:

- Black Pro theme, centered layouts
- Modern topic pill & trending (TikTok 🔥)
- Always-on self preview; reliable remote autoplay
- Strong permission overlay (explicit user gesture)
- Anti self-match across tabs; shuffled queue; ICE restart
- Text chat works instantly (plaintext fallback), switches to E2EE when ready
- Reactions; report/block (8 unique/24h → 7-day ban); streamer mode
- Dome Phone (rooms + nicknames, mesh cams)
- Twilio TURN via `/ice` (USES env: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET)
- Security headers/CSP; mobile-friendly

## Deploy on Railway
1) Push to GitHub.
2) Railway → New Project → Deploy from GitHub.
3) Env vars:
   - TWILIO_ACCOUNT_SID
   - TWILIO_API_KEY_SID
   - TWILIO_API_KEY_SECRET
   - (optional) ICE_TTL_MIN=10
   - (optional) ICE_SERVERS_JSON='[{"urls":["stun:stun.l.google.com:19302"]}]'
4) Open your Railway URL:
   - `/` — home
   - `/chat.html` — video chat (`?relay=1` to force TURN)
   - `/domephone.html` — Dome Phone
   - `/terms.html`, `/banned.html`

## Notes
- HTTPS is required for camera/mic.
- If camera prompt doesn’t appear, use the lock icon → allow Camera & Microphone, then refresh.
- If local video shows but remote doesn’t, try `?relay=1` to force TURN.
