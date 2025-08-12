# DomeChat (Trending Topics)

- Home page shows **dynamic trending topics** based on what users are actually using.
- Click a chip to jump straight into that topic.
- Full-screen bright ring light, navy/white modern theme.
- Improved 'Next' (quick re-pair), no self-pair.
- E2EE text; WebRTC signaling via Socket.IO.

## How trending works
- Server tracks active users per topic and maintains a decaying score.
- `/trending` endpoint returns the top topics; homepage refreshes this every 10s.
- If empty, a fallback list is shown.

## Run
npm install
npm start

## Deploy (Railway)
Connect repo and set Start Command to `npm start`.
