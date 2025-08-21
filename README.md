
# DomeChat — CORE (topic homepage patch)

## What changed
- Restored **topic homepage** with input + trending chips (and a link to Dome Phone).
- Core 1:1 chat logic remains **unchanged** from the stable build.

## Deploy (Railway)
1) Push to GitHub.
2) Railway → New Project → Deploy from GitHub.
3) Optional TURN env vars:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `ICE_TTL_MIN=10`
4) Open `/` for topics, `/chat.html` for chat, `/health` for status.
