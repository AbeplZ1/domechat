
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
app.use((_,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(self)');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' wss: https:; frame-ancestors 'none'");
  next();
});
app.use(express.json());
app.use(express.static('public'));

// Twilio TURN tokens at /ice
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID || '';
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET || '';
const ICE_TTL_MIN = parseInt(process.env.ICE_TTL_MIN || '10', 10);
const DEFAULT_ICE = [{ urls: ['stun:stun.l.google.com:19302'] }];
let cachedIce = null;
let cachedAt = 0;

async function fetchTwilioIce() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) return null;
  const auth = Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Tokens.json`;
  const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Basic ${auth}` } });
  if (!res.ok) throw new Error('Twilio token fetch failed: ' + res.status + ' ' + (await res.text()));
  const data = await res.json();
  return Array.isArray(data.ice_servers) ? data.ice_servers : null;
}

app.get('/ice', async (_req, res) => {
  const now = Date.now();
  if (cachedIce && (now - cachedAt) < ICE_TTL_MIN * 60 * 1000) return res.json(cachedIce);
  try {
    const tw = await fetchTwilioIce();
    if (tw && tw.length) {
      cachedIce = tw;
    } else if (process.env.ICE_SERVERS_JSON) {
      cachedIce = JSON.parse(process.env.ICE_SERVERS_JSON);
    } else {
      cachedIce = DEFAULT_ICE;
    }
  } catch (e) {
    try {
      cachedIce = process.env.ICE_SERVERS_JSON ? JSON.parse(process.env.ICE_SERVERS_JSON) : DEFAULT_ICE;
    } catch {
      cachedIce = DEFAULT_ICE;
    }
  }
  cachedAt = now;
  res.json(cachedIce);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, methods: ['GET','POST'] } });

// Utils
const now = ()=> Date.now();
const rl = (map, id, ms)=>{ const n=now(); const last=map.get(id)||0; if(n-last<ms) return true; map.set(id,n); return false; };
function sanitizeTopic(raw=''){ return String(raw).replace(/[\u0000-\u001F\u007F]/g,'').replace(/\s+/g,' ').trim().slice(0,64); }

// Queues + bans
const queues = {}; const q = t => (queues[t] ??= []);
const HARD_BAN = new Map();
function isActiveBan(id){ return (HARD_BAN.get(id)||0) > now(); }

// Trending
const topicStats = new Map();
function bump(topic, delta){
  if (!topic) return;
  const s = topicStats.get(topic) || {count:0, score:0, updated:now()};
  s.count = Math.max(0, s.count + delta);
  s.score += Math.max(0, delta);
  s.updated = now();
  topicStats.set(topic, s);
}
function decay(){
  const tNow = now();
  for (const [t, s] of topicStats){
    const dtMin = (tNow - s.updated)/60000;
    s.score *= Math.exp(-0.2*dtMin);
    s.updated = tNow;
    if (s.count<=0 && s.score<0.1) topicStats.delete(t);
  }
}
app.get('/trending',(_req,res)=>{
  decay();
  const items = [...topicStats.entries()].map(([topic, s])=>({topic, count:s.count}))
    .sort((a,b)=> (b.count - a.count) || a.topic.localeCompare(b.topic))
    .slice(0,12);
  const fallback = [
    {topic:'TikTok', count:0},{topic:'Random', count:0},{topic:'Gaming', count:0},
    {topic:'Music', count:0},{topic:'Sports', count:0},{topic:'Memes', count:0},
    {topic:'Movies', count:0},{topic:'Tech', count:0}
  ];
  res.json(items.length? items : fallback);
});

// Reports and bans
const reports = [];
const reportLimiter = new Map();
const nextLimiter = new Map();
const signalLimiter = new Map();
const REASON = 'Nudity/sexual content';
function ipHash(req){
  const raw = (req.headers['x-forwarded-for']||req.socket.remoteAddress||'') + '|pepper';
  try { return crypto.createHash('sha256').update(raw).digest('hex').slice(0,16); }
  catch { return 'unknown'; }
}
function uniqueReportersCount(target, windowMs){
  const since = now() - windowMs;
  const set = new Set(reports.filter(r=> r.reported===target && r.ts >= since).map(r=> r.reporter));
  return set.size;
}

// Pairing
function cleanFiltered(t){
  queues[t] = q(t).filter(id => io.sockets.sockets.get(id) && !isActiveBan(id));
}
function tryPair(t){
  cleanFiltered(t);
  const arr = q(t);
  for (let i=0; i<arr.length; i++){
    for (let j=i+1; j<arr.length; j++){
      const a = arr[i], b = arr[j];
      if (a === b) continue;
      const sa = io.sockets.sockets.get(a);
      const sb = io.sockets.sockets.get(b);
      if (sa && sb && sa.connected && sb.connected && !sa.partner && !sb.partner){
        arr.splice(j,1); arr.splice(i,1);
        sa.partner = sb.id; sb.partner = sa.id;
        const aPolite = a > b; const bPolite = !aPolite;
        sa.emit('partnerFound'); sb.emit('partnerFound');
        sa.emit('roles', { polite: aPolite, peerId: sb.id });
        sb.emit('roles', { polite: bPolite, peerId: sa.id });
        return true;
      }
    }
  }
  return false;
}

// Core chat
io.on('connection', (socket)=>{
  socket.topic = "";

  socket.on('setTopic', (t='')=>{
    if (isActiveBan(socket.id)){
      const until = HARD_BAN.get(socket.id);
      socket.emit('banned', { untilISO: new Date(until).toISOString() });
      return;
    }
    const newT = sanitizeTopic(t);
    if (socket.topic && socket.topic !== newT) bump(socket.topic, -1);
    if (!socket.topic || socket.topic !== newT) bump(newT, +1);
    socket.topic = newT;

    if (socket.partner){
      const p = io.sockets.sockets.get(socket.partner);
      if (p){ p.partner = null; p.emit('partnerDisconnected'); }
      socket.partner = null;
    }
    const arr = q(socket.topic);
    const idx = arr.indexOf(socket.id);
    if (idx !== -1) arr.splice(idx,1);
    arr.push(socket.id);

    if (!tryPair(socket.topic)) socket.emit('waiting','Searching for a partner…');
  });

  socket.on('next', ()=>{
    if (rl(nextLimiter, socket.id, 2000)) return;
    const t = socket.topic || '';
    if (socket.partner){
      const p = io.sockets.sockets.get(socket.partner);
      if (p){ p.partner = null; p.emit('partnerDisconnected'); }
      socket.partner = null;
    }
    cleanFiltered(t);
    const arr = q(t);
    const idx = arr.indexOf(socket.id);
    if (idx !== -1) arr.splice(idx,1);
    arr.push(socket.id);
    if (!tryPair(t)) socket.emit('waiting','Searching for a partner…');
  });

  socket.on('signal', d=>{ if (rl(signalLimiter, socket.id, 10)) return; if (socket.partner) io.to(socket.partner).emit('signal', d); });

  socket.on('ecdh-public', pub=>{ if (socket.partner) io.to(socket.partner).emit('ecdh-public', pub); });
  socket.on('enc-message', payload=>{ if (socket.partner) io.to(socket.partner).emit('enc-message', payload); });
  socket.on('typing', ()=>{ if (socket.partner) io.to(socket.partner).emit('partnerTyping'); });

  socket.on('report', (payload={})=>{
    if (rl(reportLimiter, socket.id, 30000)) return;
    const { partnerId, topic } = payload;
    if (!partnerId) return;
    const rec = { reporter: socket.id, reported: partnerId, topic: String(topic||''), reason: REASON, ts: now(), ipHash: 'anon:'+ipHash(socket.request) };
    reports.push(rec);
    const unique24 = uniqueReportersCount(partnerId, 24*60*60*1000);
    if (unique24 >= 8) {
      const until = now() + 7*24*60*60*1000;
      HARD_BAN.set(partnerId, until);
      const peer = io.sockets.sockets.get(partnerId);
      if (peer) {
        peer.emit('banned', { untilISO: new Date(until).toISOString() });
        peer.disconnect(true);
      }
    }
  });

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
    socket.partner = null;
    if (socket.topic) bump(socket.topic, -1);
  });
});

// Dome Phone
const phoneNS = io.of('/domephone');
const rooms = new Map();
phoneNS.on('connection', (socket)=>{
  let currentRoom=null, nick='';
  function emitPlayers(code){
    const r = rooms.get(code);
    if (!r) return;
    phoneNS.to(code).emit('players', r.players);
  }

  socket.on('joinLobby', (code, nickname, created)=>{
    code = String(code||'').toUpperCase().slice(0,6);
    nick = String(nickname||'').slice(0,16) || 'Player';
    let r = rooms.get(code);
    if (!r && created) { r = { players: [] }; rooms.set(code, r); }
    if (!r) return;
    currentRoom = code;
    socket.join(code);
    r.players.push({ id: socket.id, nick, camOn:false });
    socket.emit('joined', { code, players: r.players, created, nick });
    emitPlayers(code);
  });

  socket.on('camState', ({on})=>{
    const r = rooms.get(currentRoom); if (!r) return;
    const p = r.players.find(p=>p.id===socket.id); if (!p) return;
    p.camOn = !!on;
    emitPlayers(currentRoom);
  });

  socket.on('dp-peers', ()=>{
    const ids = Array.from(phoneNS.adapter.rooms.get(currentRoom) || []);
    socket.emit('dp-peers', ids);
  });

  socket.on('dp-signal', ({to, type, description, candidate})=>{
    if (!to) return;
    phoneNS.to(to).emit('dp-signal', {from: socket.id, type, description, candidate});
  });

  socket.on('disconnect', ()=>{
    if (!currentRoom) return;
    const r = rooms.get(currentRoom); if (!r) return;
    r.players = r.players.filter(p=> p.id !== socket.id);
    phoneNS.to(currentRoom).emit('leftPeer', socket.id);
    emitPlayers(currentRoom);
    if (r.players.length === 0) rooms.delete(currentRoom);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('DomeChat listening on :' + PORT));
