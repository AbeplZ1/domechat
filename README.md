
# DomeChat — Ultra Compat (Full Fix)

**What’s in here**
- Stronger camera permission overlay + diagnostics text
- Remote video autoplay fix (starts muted with “Tap to unmute”)
- Plaintext text chat fallback (works instantly), auto-upgrades to E2EE if keys are ready
- Hardened signaling (drain pending ICE, restart ICE on failure)
- Removed `Permissions-Policy` header (avoids rare camera/mic blocking)
- Twilio TURN via `/ice` with fallback to STUN
- Dome Phone lobby (room codes + nicknames)
- Health check at `/healthz`

**Deploy on Railway**
1. Push repo → Railway → Deploy from GitHub
2. ENV (recommended):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - (optional) `ICE_TTL_MIN=10`
   - (optional) `ICE_SERVERS_JSON='[{"urls":["stun:stun.l.google.com:19302"]}]'`
3. Open `/chat.html` (use `?relay=1` to force TURN if needed), `/domephone.html`

**Troubleshooting**
- If the **permission prompt** doesn’t appear, use the browser’s **lock icon** to allow Camera & Microphone, then click the button again.
- If **you see yourself but not your partner**, try `?relay=1` to force TURN.
- Mobile Safari: first play may be muted; tap the **Unmute** banner at the top of the remote video.
