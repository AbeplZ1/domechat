# DomeChat (Modern, Navy/White)

Modernized DomeChat with navy theme, overlay textbox in video area, WebRTC signaling (Socket.IO), and E2EE text.

## Local run
```bash
npm install
npm start
# open http://localhost:3000
```

## Railway deploy
- Connect repo → set Start Command to `npm start` → Deploy.
- Use the HTTPS Railway URL to allow camera/mic prompts (WebRTC needs secure origin).

## Camera/WebRTC setup
- Browser must allow camera/microphone.
- This app includes STUN servers. For strict networks, add your TURN:
  In `public/chat.html`:
  ```js
  const ICE = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302','stun:global.stun.twilio.com:3478'] },
      { urls: 'turn:YOUR_TURN_HOST:3478', username: 'USER', credential: 'PASS' } // optional
    ]
  };
  ```

## Notes
- Text chat is end-to-end encrypted (ECDH P-256 + AES-GCM). Server relays ciphertext only.
- Terms gate is client-side (localStorage). Clear storage to see it again.
