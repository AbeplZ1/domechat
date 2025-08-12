# DomeChat (Perfect Negotiation Build)
- Fixes freeze/black-video cases with the WebRTC "perfect negotiation" pattern (polite/impolite roles)
- Always-on local preview on chat page; inline preview on homepage (no box)
- Autoplay and playsinline set; remote video forced to play() on metadata
- Dynamic trending topics with TikTok 🔥
- No ring light, no save-chat

## Run
npm install
npm start

## Deploy (Railway)
Set Start Command to `npm start`.

## TURN note
For mobile/cellular or strict NATs, add TURN to ICE in chat.html for reliability.
