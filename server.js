// server.js - DomeChat with dynamic trending topics
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

// Queues & pairing
const queues = {}; // topic -> waiting ids
const q = t => (queues[t] ??= []);
const clean = t => queues[t] = q(t).filter(id => io.sockets.sockets.get(id));
const removeFromQ = (t, id) => { const arr=q(t); const i=arr.indexOf(id); if(i!==-1) arr.splice(i,1); };

function tryPair(t){
  clean(t);
  const arr = q(t);
  if (arr.length >= 2){
    const a = arr.shift();
    const idx = Math.floor(Math.random()*arr.length);
    const b = arr.splice(idx,1)[0];
    const sa = io.sockets.sockets.get(a);
    const sb = io.sockets.sockets.get(b);
    if (sa && sb && sa.connected && sb.connected && !sa.partner && !sb.partner){
      sa.partner = sb.id; sb.partner = sa.id;
      sa.emit('partnerFound');
      sb.emit('partnerFound');
      return true;
    }
  }
  return false;
}

// Trending metrics: live counts + simple decay
const topicStats = new Map(); // topic -> { score, count }
function bumpTopic(topic, deltaCount){
  if (!topic) return;
  const s = topicStats.get(topic) || { score:0, count:0, updated:Date.now() };
  s.count = Math.max(0, s.count + deltaCount);
  s.score += Math.max(0, deltaCount); // bump score on joins
  s.updated = Date.now();
  topicStats.set(topic, s);
}
function decayScores(){
  const now = Date.now();
  for (const [t, s] of topicStats){
    const dt = (now - s.updated)/60000; // minutes
    const decay = Math.exp(-0.2 * dt);  // gentle decay
    s.score = s.score * decay;
    s.updated = now;
    if (s.count <= 0 && s.score < 0.1) topicStats.delete(t);
  }
}
// Serve trending list
app.get('/trending', (req, res) => {
  decayScores();
  const items = [...topicStats.entries()]
    .sort((a,b)=> (b[1].count - a[1].count) || (b[1].score - a[1].score))
    .slice(0, 12)
    .map(([topic, s]) => ({ topic, count: s.count }));
  const fallback = [
    {topic:'Random', count:0},
    {topic:'Gaming', count:0},
    {topic:'Music', count:0},
    {topic:'Sports', count:0},
    {topic:'Memes', count:0},
    {topic:'Movies', count:0},
    {topic:'Tech', count:0},
    {topic:'Art', count:0},
  ];
  res.json(items.length ? items : fallback);
});

io.on('connection', (socket)=>{
  socket.topic = "";

  socket.on('setTopic', (t='') => {
    const newTopic = String(t).slice(0,64);
    // adjust metrics if topic changed
    if (socket.topic && socket.topic !== newTopic) bumpTopic(socket.topic, -1);
    if (!socket.topic || socket.topic !== newTopic) bumpTopic(newTopic, +1);
    socket.topic = newTopic;

    // break current link if any
    if (socket.partner){
      const p = io.sockets.sockets.get(socket.partner);
      if (p){ p.partner = null; p.emit('partnerDisconnected'); }
      socket.partner = null;
    }
    removeFromQ(socket.topic, socket.id);
    q(socket.topic).push(socket.id);
    if (!tryPair(socket.topic)) socket.emit('waiting','Waiting for a partner...');
  });

  socket.on('next', () => {
    const t = socket.topic || "";
    if (socket.partner){
      const p = io.sockets.sockets.get(socket.partner);
      if (p){ p.partner = null; p.emit('partnerDisconnected'); removeFromQ(t,p.id); q(t).push(p.id); }
      socket.partner = null;
    }
    removeFromQ(t, socket.id);
    q(t).push(socket.id);
    if (!tryPair(t)) socket.emit('waiting','Waiting for a partner...');
  });

  // relays
  socket.on('signal', d=>{ if (socket.partner) io.to(socket.partner).emit('signal', d); });
  socket.on('ecdh-public', pub=>{ if (socket.partner) io.to(socket.partner).emit('ecdh-public', pub); });
  socket.on('enc-message', payload=>{ if (socket.partner) io.to(socket.partner).emit('enc-message', payload); });
  socket.on('typing', ()=>{ if (socket.partner) io.to(socket.partner).emit('partnerTyping'); });

  socket.on('disconnectPartner', ()=>{
    if (socket.partner){
      io.to(socket.partner).emit('forceDisconnect');
      const p = io.sockets.sockets.get(socket.partner);
      if (p) p.partner = null;
      socket.partner = null;
    }
  });

  socket.on('disconnect', ()=>{
    if (socket.partner){
      const p = io.sockets.sockets.get(socket.partner);
      if (p){ p.partner = null; p.emit('partnerDisconnected'); }
    }
    if (socket.topic){
      removeFromQ(socket.topic, socket.id);
      bumpTopic(socket.topic, -1);
    }
  });
});

setInterval(()=>{ for (const t of Object.keys(queues)) clean(t); decayScores(); }, 15000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('DomeChat trending running on :' + PORT));
