
# DomeChat — Railway-ready

## Deploy
1) Push this repo to GitHub.
2) Railway → New Project → Deploy from GitHub.
3) Make sure `package.json` has `"start": "node server.js"` (it does).
4) (Optional, recommended) Add ENV variables for TURN via Twilio:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `ICE_TTL_MIN` (default 10)

## Use
- Home: `/`
- 1:1 chat: `/chat.html`
- Dome Phone: `/domephone.html`
- If NAT is strict, append `?relay=1` to chat URL to prefer TURN.

## Notes
- App listens on `process.env.PORT` (Railway-provided) with fallback to 3000 for local dev.
- Static assets are served from `/public`. Socket.IO is on the same origin.
- `/ice` returns Twilio ICE servers when ENV is set, else Google STUN fallback.
