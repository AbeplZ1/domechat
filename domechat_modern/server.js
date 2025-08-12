// server.js - DomeChat modern
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

const waiting = {};
const q = (t='') => (waiting[t] ??= []);
function pair(sock, topic=''){
  const arr = q(topic);
  while (arr.length && !io.sockets.sockets.get(arr[0])) arr.shift();
  if (arr.length){
    const otherId = arr.shift();
    const other = io.sockets.sockets.get(otherId);
    if (other && other.connected){
      sock.partner = other.id; other.partner = sock.id;
      sock.emit('partnerFound'); other.emit('partnerFound');
    } else { pair(sock, topic); }
  } else {
    arr.push(sock.id);
    sock.emit('waiting','Waiting for a partner...');
  }
}

function limiter(limit, windowMs){
  const hits = new Map();
  return id => {
    const now = Date.now();
    const list = hits.get(id) || [];
    const recent = list.filter(t=> now - t < windowMs);
    recent.push(now);
    hits.set(id, recent);
    return recent.length <= limit;
  };
}
const allow = limiter(30, 5000);

io.on('connection', (socket)=>{
  let topic='';
  socket.on('setTopic', t=>{ topic=(t||'').slice(0,64); pair(socket, topic); });

  socket.on('signal', d=>{ if(!allow(socket.id)) return; if(socket.partner) io.to(socket.partner).emit('signal', d); });
  socket.on('ecdh-public', p=>{ if(!allow(socket.id)) return; if(socket.partner) io.to(socket.partner).emit('ecdh-public', p); });
  socket.on('enc-message', payload=>{
    if(!allow(socket.id)) return;
    try{ if(JSON.stringify(payload).length>8000) return; }catch{}
    if(socket.partner) io.to(socket.partner).emit('enc-message', payload);
  });
  socket.on('typing', ()=>{ if(!allow(socket.id)) return; if(socket.partner) io.to(socket.partner).emit('partnerTyping'); });
  socket.on('reaction', e=>{ if(!allow(socket.id)) return; if(socket.partner) io.to(socket.partner).emit('reaction', e); });

  socket.on('rpsMove', move=>{
    if(!allow(socket.id)) return;
    socket.rpsMove = move;
    if(socket.partner){
      const p = io.sockets.sockets.get(socket.partner);
      if(p && p.rpsMove){
        const a=socket.rpsMove, b=p.rpsMove;
        const decide=(x,y)=> x===y?'tie':((x==='rock'&&y==='scissors')||(x==='scissors'&&y==='paper')||(x==='paper'&&y==='rock'))?'you':'partner';
        const w = decide(a,b);
        socket.emit('rpsRoundResult',{winner:w,yourMove:a,partnerMove:b});
        p.emit('rpsRoundResult',{winner:w==='you'?'partner':w==='partner'?'you':'tie',yourMove:b,partnerMove:a});
        delete socket.rpsMove; delete p.rpsMove;
      }
    }
  });

  socket.on('overlayText', txt=>{ if(socket.partner) io.to(socket.partner).emit('overlayText', txt); });

  socket.on('disconnectPartner', ()=>{
    if(socket.partner){
      io.to(socket.partner).emit('forceDisconnect');
      const p = io.sockets.sockets.get(socket.partner);
      if(p) p.partner = null;
      socket.partner = null;
    }
  });

  socket.on('disconnect', ()=>{
    if(!socket.partner){
      const arr = q(topic); const i = arr.indexOf(socket.id); if(i!==-1) arr.splice(i,1);
    } else {
      const p = io.sockets.sockets.get(socket.partner);
      if(p){ p.partner = null; p.emit('partnerDisconnected'); pair(p, topic); }
    }
  });
});

setInterval(()=>{
  for (const [t, arr] of Object.entries(waiting)){
    waiting[t] = arr.filter(id => io.sockets.sockets.get(id));
  }
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('DomeChat (modern) running on :' + PORT));
