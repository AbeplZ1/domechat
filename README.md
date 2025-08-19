
# DomeChat — Audio & Permission Fix

- Brave-friendly camera/mic prompt with diagnostics (`public/js/media-permissions.js`)
- Audio capture uses echoCancellation, noiseSuppression, autoGainControl
- Mic meter shows live/quiet status (quick sanity check)
- Remote video starts muted with "Tap to unmute" to satisfy autoplay policies
- Tracks added for **both audio & video** and toggles are wired

## Deploy
1) Push to GitHub → Railway.
2) Environment (optional TURN via Twilio): TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET
3) Open `/chat.html` and test on two devices.
