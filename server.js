// server.js - DomeChat 'Next' behavior and pairing improvements
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(self)');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' wss: https:; frame-ancestors 'none'");
  next();
});

app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, methods: ['GET','POST'] } });

// topic -> array of socket ids waiting
const queues = {};
const q = t => (queues[t] ??= []);

function removeFromQueue(topic, id){
  const arr = q(topic);
  const i = arr.indexOf(id);
  if (i !== -1) arr.splice(i,1);
}

function cleanQueue(topic){
  const arr = q(topic);
  const alive = arr.filter(id => io.sockets.sockets.get(id));
  queues[topic] = alive;
}

function tryPair(topic){
  cleanQueue(topic);
  const arr = q(topic);
  // find two distinct sockets to pair
  if (arr.length >= 2) {
    const a = arr.shift();
    // pick random b
    const idx = Math.floor(Math.random() * arr.length);
    const b = arr.splice(idx,1)[0];
    const sa = io.sockets.sockets.get(a);
    const sb = io.sockets.sockets.get(b);
    if (sa && sb && sa.connected && sb.connected && !sa.partner && !sb.partner) {
      sa.partner = sb.id; sb.partner = sa.id;
      sa.emit('partnerFound');
      sb.emit('partnerFound');
      return true;
    }
  }
  return false;
}

io.on('connection', (socket)=>{
  socket.topic = "";

  socket.on('setTopic', (t='') => {
    socket.topic = String(t).slice(0,64);
    // break current link if any
    if (socket.partner) {
      const p = io.sockets.sockets.get(socket.partner);
      if (p) { p.partner = null; p.emit('partnerDisconnected'); }
      socket.partner = null;
    }
    // enqueue and attempt pair
    removeFromQueue(socket.topic, socket.id);
    q(socket.topic).push(socket.id);
    if (!tryPair(socket.topic)) {
      socket.emit('waiting', 'Waiting for a partner...');
    }
  });

  // "next" -> both users rejoin queue and get immediately re-paired if only two are present
  socket.on('next', () => {
    const topic = socket.topic || "";
    // sever link on both sides
    if (socket.partner) {
      const p = io.sockets.sockets.get(socket.partner);
      if (p) {
        p.partner = null;
        p.emit('partnerDisconnected');
        removeFromQueue(topic, p.id);
        q(topic).push(p.id);
      }
      socket.partner = null;
    }
    removeFromQueue(topic, socket.id);
    q(topic).push(socket.id);
    // immediately try to pair any two in this topic (works great when only 2 users total)
    if (!tryPair(topic)) {
      socket.emit('waiting','Waiting for a partner...');
    }
  });

  // signaling and E2EE relays
  socket.on('signal', (d)=>{ if (socket.partner) io.to(socket.partner).emit('signal', d); });
  socket.on('ecdh-public', (pub)=>{ if (socket.partner) io.to(socket.partner).emit('ecdh-public', pub); });
  socket.on('enc-message', (payload)=>{ if (socket.partner) io.to(socket.partner).emit('enc-message', payload); });
  socket.on('typing', ()=>{ if (socket.partner) io.to(socket.partner).emit('partnerTyping'); });

  socket.on('disconnectPartner', () => {
    if (socket.partner) {
      io.to(socket.partner).emit('forceDisconnect');
      const p = io.sockets.sockets.get(socket.partner);
      if (p) p.partner = null;
      socket.partner = null;
    }
  });

  socket.on('disconnect', () => {
    if (socket.partner) {
      const p = io.sockets.sockets.get(socket.partner);
      if (p) { p.partner = null; p.emit('partnerDisconnected'); }
    } else if (socket.topic) {
      removeFromQueue(socket.topic, socket.id);
    }
  });
});

setInterval(()=>{
  for (const t of Object.keys(queues)) cleanQueue(t);
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('DomeChat NEXT running on :' + PORT));
