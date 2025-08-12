// server.js - DomeChat (trending + pairing)
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

// queues by topic
const queues = {};
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
      sa.emit('partnerFound'); sb.emit('partnerFound');
      return true;
    }
  }
  return false;
}

// trending metrics
const topicStats = new Map(); // topic -> {count, score, updated}
function bump(topic, delta){
  if (!topic) return;
  const s = topicStats.get(topic) || {count:0, score:0, updated:Date.now()};
  s.count = Math.max(0, s.count + delta);
  s.score += Math.max(0, delta);
  s.updated = Date.now();
  topicStats.set(topic, s);
}
function decay(){
  const now = Date.now();
  for (const [t, s] of topicStats){
    const dt = (now - s.updated)/60000;
    s.score *= Math.exp(-0.2*dt);
    s.updated = now;
    if (s.count<=0 && s.score<0.1) topicStats.delete(t);
  }
}
app.get('/trending',(req,res)=>{
  decay();
  const items = [...topicStats.entries()].map(([topic, s])=>({topic, count:s.count}))
    .sort((a,b)=> (b.count - a.count) || (b.topic.localeCompare(a.topic)))
    .slice(0,12);
  const fallback = [
    {topic:'TikTok', count:0},
    {topic:'Random', count:0},
    {topic:'Gaming', count:0},
    {topic:'Music', count:0},
    {topic:'Sports', count:0},
    {topic:'Memes', count:0},
    {topic:'Movies', count:0},
    {topic:'Tech', count:0}
  ];
  res.json(items.length? items : fallback);
});

io.on('connection', (socket)=>{
  socket.topic = "";

  socket.on('setTopic', (t='')=>{
    const newT = String(t).slice(0,64);
    if (socket.topic && socket.topic !== newT) bump(socket.topic, -1);
    if (!socket.topic || socket.topic !== newT) bump(newT, +1);
    socket.topic = newT;

    if (socket.partner){
      const p = io.sockets.sockets.get(socket.partner);
      if (p){ p.partner = null; p.emit('partnerDisconnected'); }
      socket.partner = null;
    }
    removeFromQ(socket.topic, socket.id);
    q(socket.topic).push(socket.id);
    if (!tryPair(socket.topic)) socket.emit('waiting','Waiting for a partner...');
  });

  socket.on('next', ()=>{
    const t = socket.topic || '';
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
    if (socket.topic) bump(socket.topic, -1);
  });
});

setInterval(()=>{ for(const t of Object.keys(queues)) clean(t); decay(); }, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('DomeChat TR running on :' + PORT));
