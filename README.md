
# DomeChat — FINAL (Black Pro + Reactions + Dome Phone)

**Included**
- Black Pro theme, centered layouts, modern topic pill
- Camera permission overlay fixed (user-gesture `getUserMedia()`)
- Always-on local preview; reliable remote autoplay
- Codec smart-pick (H.264 on iOS, VP8 elsewhere); ICE restart on failure
- Anti self-match (session guard), shuffled queue
- E2EE text chat (ECDH + AES-GCM)
- Report/Block; 8 unique reports in 24h ⇒ 7-day soft ban (banned screen)
- Trending topics (ensures TikTok 🔥 chip)
- **Dome Phone** (rooms + nicknames, simple mesh cam grid)
- Twilio TURN via `/ice` with caching + STUN fallback
- Strict security headers/CSP; mobile friendly

## Deploy on Railway
1. Push this folder's contents to a GitHub repo.
2. Railway → New Project → Deploy from GitHub.
3. Add ENV VARS:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - *(optional)* `ICE_TTL_MIN=10`
   - *(optional)* `ICE_SERVERS_JSON='[{"urls":["stun:stun.l.google.com:19302"]}]'`
4. Open the Railway URL (HTTPS).
   - `/` — home
   - `/chat.html` — video chat (`?debug=1` to log ICE, `?relay=1` to force TURN)
   - `/domephone.html` — Dome Phone
   - `/terms.html`, `/banned.html`

> Tip: If camera prompt doesn’t appear, click the **Enable** button; if still blocked, use the lock icon in the browser bar to allow Camera & Microphone.
