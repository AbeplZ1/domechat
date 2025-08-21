
# DomeChat — full build (video chat reverted)

- Restores the earlier, simpler 1:1 media flow:
  - Tries `getUserMedia` on page load.
  - Also has a big **Enable Camera & Mic** button.
  - Manual SDP offer for reliability.
- Keeps topic homepage + trending chips.
- Includes Dome Phone (create/join/public) with prompt→draw→guess→results flow.

## Deploy (Railway)
1) Push to GitHub.
2) Railway → New Project → Deploy from GitHub.
3) Optional TURN env (for strict NATs):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `ICE_TTL_MIN=10`
4) Open `/` (topics), `/chat.html` (1:1), `/domephone.html` (game), `/health` (status).
