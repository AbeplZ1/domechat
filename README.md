
# DomeChat NEXT
- 'Next' pairs both users back into the queue and re-connects quickly (with two users, you'll keep re-matching)
- No mini-games or overlay box; bottom-right TikTok badge; full-screen ring light
- E2EE text; WebRTC signaling via Socket.IO
- Ads/premium scaffold added (ad bar hidden if `?premium=1` or localStorage flag set)

## Run
npm install
npm start

## Deploy (Railway)
Connect repo and set Start Command to `npm start`.

## Premium toggle (placeholder)
- Add `?premium=1` to the URL or set `localStorage.setItem('domechatPremium','1')` to hide the ad bar.
