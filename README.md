
# DomeChat — Full Railway Build (Final)

## Deploy on Railway
1. Push to GitHub.
2. Railway → New Project → Deploy from GitHub.
3. Ensure `package.json` has `"start": "node server.js"` (done).
4. Optional (recommended) env vars for TURN via Twilio:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `ICE_TTL_MIN=10`
5. Visit:
   - `/` (Home)
   - `/chat.html` (1:1 chat)
   - `/domephone.html` (multi-cam rooms)
6. Health check: `/health` returns `{ ok: true }`.

## Notes
- App listens on `process.env.PORT` (Railway) with local fallback to `3000`.
- `/ice` returns ICE servers (Twilio when configured, else Google STUN).
- Camera/mic flow uses a generic prompt first to unlock device labels, then allows switching devices. Unique IDs avoid conflicts.
- Reports: 8 unique reports in 24h => 7-day soft ban (nudity).
- Dome Phone does N:N mesh; new joiner sends offers to existing peers.
