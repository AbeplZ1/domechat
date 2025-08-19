
# DomeChat — Pro Build (Dark Navy) + Reactions

**Included**
- Pro UI (dark navy), glass panels, chat bubbles, searching overlay
- Emoji reactions overlay (real-time)
- Always-on local preview, autoplay-safe remote
- H.264 on iOS / VP8 elsewhere; ICE restart on failure
- Anti self-match (session guard), shuffled queue
- E2EE text chat (ECDH + AES-GCM)
- Report nudity + Block; 8 unique reports in 24h → 7-day soft ban
- Topics + Trending (with TikTok 🔥)
- Dome Phone (rooms + nicknames, simple mesh)
- Twilio TURN via `/ice` (+ STUN fallback)
- Strict headers/CSP; mobile-first

## Deploy (Railway)
1) Push this folder's contents to a new GitHub repo.
2) Railway → New Project → Deploy from GitHub.
3) Add env vars:
   - TWILIO_ACCOUNT_SID
   - TWILIO_API_KEY_SID
   - TWILIO_API_KEY_SECRET
   - (optional) ICE_TTL_MIN=10
   - (optional) ICE_SERVERS_JSON='[{"urls":["stun:stun.l.google.com:19302"]}]'
4) Redeploy → open the HTTPS URL.

Routes:
- `/` home, trending chips
- `/chat.html` video chat (add `?debug=1` to see ICE logs; `?relay=1` to force TURN)
- `/domephone.html` Dome Phone lobby/cams
- `/terms.html` first-run gate
- `/banned.html` soft-ban page
