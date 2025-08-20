
# DomeChat — ALL FIXES (Railway)

## Deploy
1) Push this folder to GitHub.
2) Railway → New Project → Deploy from GitHub.
3) Optional (recommended) env vars for TURN via Twilio:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `ICE_TTL_MIN=10`
4) Open:
   - `/` (Home)
   - `/chat.html` (1:1)
   - `/domephone.html` (rooms)
   - `/health` (OK check)

## Notes
- Auto camera/mic prompt on page load.
- Forced offer when a partner is found (more reliable across Safari/Brave/iOS).
- Use `?relay=1` on `/chat.html` if you’ve set Twilio env vars and want to force TURN.
- Reports: 8 unique in 24h → 7-day soft ban.
