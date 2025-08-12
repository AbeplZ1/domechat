// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET","POST"] }
});

// Basic security headers & CSP (tuned for Socket.IO/WSS and media blobs)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "media-src 'self' blob:; " +
    "connect-src 'self' wss: https:; " +
    "frame-ancestors 'none'"
  );
  next();
});

app.use(express.static('public'));

// Pairing queues by topic
const waiting = {}; // topic -> [socketId]
const getQueue = (topic='') => (waiting[topic] ??= []);

function pair(socket, topic='') {
  const q = getQueue(topic);
  // drop stale ids
  while (q.length && !io.sockets.sockets.get(q[0])) q.shift();

  if (q.length) {
    const otherId = q.shift();
    const other = io.sockets.sockets.get(otherId);
    if (other) {
      socket.partner = otherId;
      other.partner = socket.id;
      socket.emit('partnerFound');
      other.emit('partnerFound');
    } else {
      pair(socket, topic);
    }
  } else {
    q.push(socket.id);
    socket.emit('waiting', 'Waiting for a partner...');
  }
}

// very simple per-socket rate limiter
function makeLimiter(limit, windowMs) {
  const hits = new Map();
  return (id) => {
    const now = Date.now();
    const arr = hits.get(id) || [];
    const recent = arr.filter(t => now - t < windowMs);
    recent.push(now);
    hits.set(id, recent);
    return recent.length <= limit;
  };
}
const allow = makeLimiter(30, 5000); // 30 events / 5s

io.on('connection', (socket) => {
  let topic = '';

  socket.on('setTopic', (t) => {
    topic = (t || '').trim();
    pair(socket, topic);
  });

  // Relay signaling (SDP/ICE) between partners
  socket.on('signal', (data) => {
    if (!allow(socket.id)) return;
    if (socket.partner) io.to(socket.partner).emit('signal', data);
  });

  // ECDH pubkey relay (for E2EE text)
  socket.on('ecdh-public', (pub) => {
    if (!allow(socket.id)) return;
    if (socket.partner) io.to(socket.partner).emit('ecdh-public', pub);
  });

  // Encrypted text message relay
  socket.on('enc-message', (payload) => {
    if (!allow(socket.id)) return;
    try {
      const size = JSON.stringify(payload).length;
      if (size > 8000) return;
    } catch {}
    if (socket.partner) io.to(socket.partner).emit('enc-message', payload);
  });

  socket.on('typing', () => {
    if (!allow(socket.id)) return;
    if (socket.partner) io.to(socket.partner).emit('partnerTyping');
  });

  socket.on('reaction', (emoji) => {
    if (!allow(socket.id)) return;
    if (socket.partner) io.to(socket.partner).emit('reaction', emoji);
  });

  // Mini-game: Rock-Paper-Scissors
  socket.on('rpsMove', (move) => {
    if (!allow(socket.id)) return;
    socket.rpsMove = move;
    if (socket.partner) {
      const p = io.sockets.sockets.get(socket.partner);
      if (p && p.rpsMove) {
        const a = socket.rpsMove, b = p.rpsMove;
        const decide = (x,y)=> x===y?'tie':
          (x==='rock'&&y==='scissors')||
          (x==='scissors'&&y==='paper')||
          (x==='paper'&&y==='rock') ? 'you':'partner';
        const w = decide(a,b);
        socket.emit('rpsRoundResult', { winner:w, yourMove:a, partnerMove:b });
        io.to(socket.partner).emit('rpsRoundResult', {
          winner: w==='you'?'partner':w==='partner'?'you':'tie',
          yourMove:b, partnerMove:a
        });
        delete socket.rpsMove; delete p.rpsMove;
      }
    }
  });

  socket.on('disconnectPartner', () => {
    if (socket.partner) {
      io.to(socket.partner).emit('forceDisconnect');
      const p = io.sockets.sockets.get(socket.partner);
      if (p) p.partner = null;
      socket.partner = null;
    }
  });

  socket.on('disconnect', () => {
    if (!socket.partner) {
      const q = getQueue(topic);
      const i = q.indexOf(socket.id);
      if (i !== -1) q.splice(i,1);
    } else {
      const p = io.sockets.sockets.get(socket.partner);
      if (p) {
        p.partner = null;
        p.emit('partnerDisconnected');
        pair(p, topic);
      }
    }
  });
});

// periodic sweep for stale waiting IDs
setInterval(() => {
  for (const [t, q] of Object.entries(waiting)) {
    waiting[t] = q.filter(id => io.sockets.sockets.get(id));
  }
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on ' + PORT));
