
# DomeChat (core) + Dome Phone (public lobby game)

## What this includes
- **Untouched DomeChat 1:1 video/text** (auto camera prompt, forced-offer, reports, trending, /ice).
- **Dome Phone** with Create/Join/Public Lobby and **Gartic Phone–style** flow (Prompt → Draw → Guess → repeat → Results).
- Favicon (black background, "DomeChat" text).

## Deploy on Railway
1) Push to GitHub → New Project → Deploy from GitHub.
2) Optional TURN (recommended for reliability):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `ICE_TTL_MIN=10`
3) Open:
   - `/chat.html`  (1:1 DomeChat core)
   - `/domephone.html` (Dome Phone game)
   - `/health`     (OK check)

## Notes
- Forced-offer improves cross-browser reliability (Safari/Brave/iOS).
- Game timers: 50s prompt, 60s draw, 45s guess (edit in server.js).
- Results show each story as a card sequence (text + drawings).
