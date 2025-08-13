
# DomeChat (Final Twilio TURN build)

This is the complete DomeChat bundle:
- Random video chat with topics
- E2EE text chat (ECDH+AES-GCM)
- Typing indicator, auto-next after disconnect
- Report (nudity) + Block; 8 unique reports/24h → 7-day soft ban (friendly countdown)
- Streamer mode
- Terms gate (first visit)
- Trending topics API (with TikTok 🔥)
- Dome Phone (room codes + nicknames mesh video)
- Twilio TURN via `/ice` (time-limited credentials), STUN fallback
- Mobile-first navy/white UI
- Security headers/CSP

## Deploy on Railway
1. Create a **new GitHub repo** and upload these files (the folder contents, not the zip file itself).
2. Railway → **New Project → Deploy from GitHub** → select the repo.
3. Add environment variables in Railway → **Settings → Variables**:
   - `TWILIO_ACCOUNT_SID` = your AC... SID
   - `TWILIO_API_KEY_SID` = your SK... SID
   - `TWILIO_API_KEY_SECRET` = the secret from Twilio
   - (optional) `ICE_TTL_MIN` = `10`
   - (optional) `ICE_SERVERS_JSON` = `[{"urls":["stun:stun.l.google.com:19302"]}]`
4. Redeploy. Open your URL over **HTTPS**.

## Local test (optional)
```bash
npm install
npm start
# visit http://localhost:3000
```

## Routes
- `/` — Home with trending chips + topic entry
- `/chat.html` — Video chat
- `/domephone.html` — Dome Phone lobby/cams
- `/terms.html` — Terms gate (first run)
- `/banned.html` — Soft-ban message (auto redirected)

## Notes
- Browsers require HTTPS (or `localhost`) for camera/mic.
- If ICE logs show `failed`, your network is strict; Twilio TURN should relay.
- You can later add ads or payments without touching RTC code.
