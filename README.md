# DomeChat (Core + Dome Phone)

Deploy-ready Node/Express + Socket.IO app.

## Deploy on Railway
1) Create a new GitHub repo and upload these files.
2) In Railway: New Project → Deploy from GitHub → select repo → Deploy.
3) Railway auto-detects `npm start` (port 3000).

## Local (optional)
```bash
npm install
npm start
# visit http://localhost:3000
```

### Features
- Topics + Trending (TikTok 🔥)
- WebRTC chat (STUN), perfect negotiation + ICE buffering
- Auto-Next after disconnect (~2.5s)
- Report (nudity) + Block; 8 unique reports/24h → 7-day soft ban (friendly page)
- Streamer Mode (blurs chat UI)
- Terms gate on first visit
- Dome Phone (room codes + nicknames, optional 4-camera mesh signaling)
