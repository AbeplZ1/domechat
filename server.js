
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = (...args)=>import('node-fetch').then(({default:fetch})=>fetch(...args)).catch(()=>global.fetch && global.fetch(...args));

const ADMIN_CODE = process.env.ADMIN_CODE || 'change-me-super-secret'; // <-- set on Railway!
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, methods: ['GET','POST'] } });

app.use(express.json({limit:'5mb'}));
app.use(express.static('public'));

// ---------- Minimal security headers ----------
app.use((_,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' wss: https:; frame-ancestors 'none'");
  next();
});

// ---------- Pages ----------
app.get('/', (_req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/health', (_req,res)=> res.json({ok:true}));

// ---------- ICE (Twilio-ready) ----------
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID || '';
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET || '';
const ICE_TTL_MIN = parseInt(process.env.ICE_TTL_MIN || '10', 10);
const DEFAULT_ICE = [{ urls: ['stun:stun.l.google.com:19302'] }];
let cachedIce = null, cachedAt = 0;
async function fetchTwilioIce(){
  try{
    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) return null;
    const auth = Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Tokens.json`;
    const res = await fetch(url, { method:'POST', headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.ice_servers) ? data.ice_servers : null;
  }catch{ return null; }
}
app.get('/ice', async (_req,res)=>{
  const now = Date.now();
  if (cachedIce && (now - cachedAt) < ICE_TTL_MIN*60000) return res.json(cachedIce);
  const tw = await fetchTwilioIce();
  if (tw && tw.length) cachedIce = tw;
  else if (process.env.ICE_SERVERS_JSON) { try{ cachedIce = JSON.parse(process.env.ICE_SERVERS_JSON) } catch{ cachedIce = DEFAULT_ICE } }
  else cachedIce = DEFAULT_ICE;
  cachedAt = now; res.json(cachedIce);
});

// ---------- Trending (unchanged) ----------
const now = ()=> Date.now();
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
  for (const [t,s] of topicStats){
    const dt = (tNow - s.updated)/60000;
    s.score *= Math.exp(-0.2*dt);
    s.updated = tNow;
    if (s.count<=0 && s.score<0.1) topicStats.delete(t);
  }
}
app.get('/trending',(_req,res)=>{
  decay();
  const items = [...topicStats.entries()].map(([topic,s])=>({topic,count:s.count}))
    .sort((a,b)=> (b.count-a.count) || a.topic.localeCompare(b.topic)).slice(0,12);
  const fallback = [{topic:'TikTok',count:0},{topic:'Random',count:0},{topic:'Gaming',count:0},
                    {topic:'Music',count:0},{topic:'Sports',count:0},{topic:'Memes',count:0},
                    {topic:'Movies',count:0},{topic:'Tech',count:0}];
  res.json(items.length?items:fallback);
});

// ---------- 1:1 chat (left intact) ----------
const queues = {}; const q = t => (queues[t] ??= []);
const HARD_BAN = new Map();
const isActiveBan = id => (HARD_BAN.get(id)||0) > now();
const reports = [];
function uniqueReportersCount(target, windowMs){const since=now()-windowMs;return new Set(reports.filter(r=>r.reported===target && r.ts>=since).map(r=>r.reporter)).size}
const REASON = 'Nudity/sexual content';

io.on('connection',(socket)=>{
  socket.topic=''; socket.sessionId='';

  socket.on('session',(sid)=>{ socket.sessionId = String(sid||''); });
  const cleanText = r => String(r).replace(/[\u0000-\u001F\u007F]/g,'').replace(/\s+/g,' ').trim().slice(0,64);

  socket.on('setTopic',(t='')=>{
    if(isActiveBan(socket.id)){const until=HARD_BAN.get(socket.id);socket.emit('banned',{untilISO:new Date(until).toISOString()});return}
    const newT=cleanText(t);
    if(socket.topic && socket.topic!==newT) bump(socket.topic,-1);
    if(!socket.topic || socket.topic!==newT) bump(newT,+1);
    socket.topic=newT;
    if(socket.partner){const p=io.sockets.sockets.get(socket.partner); if(p){p.partner=null;p.emit('partnerDisconnected')} socket.partner=null}
    const arr=q(socket.topic); const idx=arr.indexOf(socket.id); if(idx!==-1)arr.splice(idx,1); arr.push(socket.id);
    if(!tryPair(socket.topic)) socket.emit('waiting','Searching for a partner…');
  });

  function tryPair(t){
    queues[t]=q(t).filter(id=>io.sockets.sockets.get(id)&&!isActiveBan(id));
    const arr=q(t); const shuffled=[...arr].sort(()=>Math.random()-0.5);
    for(let i=0;i<shuffled.length;i++){
      for(let j=i+1;j<shuffled.length;j++){
        const a=shuffled[i], b=shuffled[j]; if(a===b)continue;
        const sa=io.sockets.sockets.get(a), sb=io.sockets.sockets.get(b);
        if(!sa||!sb||!sa.connected||!sb.connected)continue;
        if(sa.partner||sb.partner)continue;
        if(sa.sessionId && sb.sessionId && sa.sessionId===sb.sessionId) continue;
        const ia=arr.indexOf(a); if(ia>-1)arr.splice(ia,1);
        const ib=arr.indexOf(b); if(ib>-1)arr.splice(ib,1);
        sa.partner=sb.id; sb.partner=sa.id;
        const aPolite=a>b, bPolite=!aPolite;
        sa.emit('partnerFound'); sb.emit('partnerFound');
        sa.emit('roles',{polite:aPolite,peerId:sb.id});
        sb.emit('roles',{polite:bPolite,peerId:sa.id});
        return true;
      }
    }
    return false;
  }

  socket.on('next',()=>{
    const t=socket.topic||'';
    if(socket.partner){const p=io.sockets.sockets.get(socket.partner); if(p){p.partner=null;p.emit('partnerDisconnected')} socket.partner=null}
    queues[t]=q(t).filter(id=>io.sockets.sockets.get(id)&&!isActiveBan(id));
    const arr=q(t); const idx=arr.indexOf(socket.id); if(idx!==-1)arr.splice(idx,1); arr.push(socket.id);
    if(!tryPair(t)) socket.emit('waiting','Searching for a partner…');
  });

  socket.on('signal',d=>{ if(socket.partner) io.to(socket.partner).emit('signal',d); });
  socket.on('typing',({from}={})=>{ if(socket.partner) io.to(socket.partner).emit('partnerTyping',{from:socket.id}); });
  socket.on('message', ({text}={}) => {
    if (!socket.partner) return;
    if (typeof text !== 'string') return;
    const trimmed = String(text).trim().slice(0, 2000);
    if (!trimmed) return;
    io.to(socket.partner).emit('message', { text: trimmed, from: socket.id });
  });

  socket.on('report',({partnerId,topic}={})=>{
    if(!partnerId) return;
    reports.push({reporter:socket.id, reported:partnerId, topic:String(topic||''), reason:REASON, ts:now()});
    const unique24=uniqueReportersCount(partnerId,24*60*60*1000);
    if(unique24>=8){const until=now()+7*24*60*60*1000;HARD_BAN.set(partnerId,until);const peer=io.sockets.sockets.get(partnerId);if(peer){peer.emit('banned',{untilISO:new Date(until).toISOString()});peer.disconnect(true)}}
  });

  socket.on('disconnectPartner',()=>{
    if(socket.partner){io.to(socket.partner).emit('forceDisconnect'); const p=io.sockets.sockets.get(socket.partner); if(p)p.partner=null; socket.partner=null}
  });

  socket.on('disconnect',()=>{
    if(socket.partner){const p=io.sockets.sockets.get(socket.partner); if(p){p.partner=null;p.emit('partnerDisconnected')}}
    socket.partner=null;
    if(socket.topic) bump(socket.topic,-1);
  });
});

// ---------- Dome Phone rooms with host-first public lobby & admin ----------
const rooms = new Map();
function roomBy(code){return rooms.get(code)}
function makeCode(n=6){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<n;i++)s+=a[Math.floor(Math.random()*a.length)];return s}
function ensureRoom(code){let r=rooms.get(code);if(!r){r={code,size:8,hostId:null,stage:'lobby',round:0,order:[],assignments:{},submissions:{},members:new Map(),chains:[],_timer:null,_timerCount:0,locked:false};rooms.set(code,r)}return r}
function snap(r){return{code:r.code,size:r.size,hostId:r.hostId,stage:r.stage,round:r.round,locked:r.locked,members:[...r.members.entries()].map(([id,m])=>({id,name:m.name,isHost:m.isHost}))}}
function emitRoom(r){io.to('dp:'+r.code).emit('dp:room',snap(r))}

io.of('/').on('connection',(socket)=>{
  function inRoom(){const c=socket.data.dpRoom;return c?rooms.get(c):null}

  socket.post = (path, handler) => app.post(path, (req,res)=>{
    // Bind to this socket's room context using a minimal token map keyed by socket.id via header
    // For simplicity in this patch, we attach the current socket id to a cookie-less context.
    req._socket = socket;
    handler(req,res);
  });

  // ----- Public & Private join/create (Host is first in public lobbies) -----
  socket.on('dp:create',({name='Guest',size=8}={})=>{
    const code=makeCode(6);
    const r=ensureRoom(code);
    r.size=Math.min(12,Math.max(3,parseInt(size,10)||8));
    r.hostId=socket.id;
    r.stage='lobby'; r.round=0; r.order=[]; r.assignments={}; r.submissions={}; r.chains=[]; r.locked=false;
    r.members.clear();
    r.members.set(socket.id,{name:String(name).slice(0,16),isHost:true});
    socket.join('dp:'+code); socket.data.dpRoom=code;
    emitRoom(r);
  });

  socket.on('dp:join',({name='Guest',code}={})=>{
    const r=roomBy(String(code||'').toUpperCase());
    if(!r) return socket.emit('dp:status','Room not found');
    if(r.locked) return socket.emit('dp:status','Room is locked');
    if(r.members.size>=r.size) return socket.emit('dp:status','Room is full');
    if(!r.hostId){ r.hostId = socket.id; } // ensure a host exists
    r.members.set(socket.id,{name:String(name).slice(0,16),isHost:(r.hostId===socket.id)});
    socket.join('dp:'+r.code); socket.data.dpRoom=r.code;
    emitRoom(r);
  });

  socket.on('dp:public',({name='Guest',size=8}={})=>{
    const target=Math.min(12,Math.max(3,parseInt(size,10)||8));
    for(const r of rooms.values()){
      if(r.size===target && r.stage==='lobby' && !r.locked && r.members.size<r.size){
        if(!r.hostId){ r.hostId = socket.id; } // FIRST person becomes host
        r.members.set(socket.id,{name:String(name).slice(0,16),isHost:(r.hostId===socket.id)});
        socket.join('dp:'+r.code); socket.data.dpRoom=r.code;
        emitRoom(r);
        return;
      }
    }
    const code=makeCode(6);
    const r=ensureRoom(code);
    r.size=target; r.stage='lobby'; r.round=0; r.order=[]; r.assignments={}; r.submissions={}; r.chains=[]; r.locked=false;
    r.hostId=socket.id;
    r.members.set(socket.id,{name:String(name).slice(0,16),isHost:true});
    socket.join('dp:'+code); socket.data.dpRoom=code;
    emitRoom(r);
  });

  // ----- Game state controls (unchanged baseline) -----
  function titleFor(s){return s==='lobby'?'Lobby':s==='prompt'?'Write a prompt':s==='draw'?'Draw the prompt':s==='guess'?'Describe the drawing':'Results'}
  function emitState(r){
    const base={stage:r.stage,stageTitle:titleFor(r.stage),round:r.round};
    for(const [id,_m] of r.members){
      const st={...base};
      if(r.stage==='draw'){
        const idx=[...r.members.keys()].indexOf(id);
        const fromIdx=((r.round+idx)%r.members.size);
        const ownerId=[...r.members.keys()][fromIdx];
        const prompt=r.submissions.prompt?.get(ownerId);
        st.assignment=(prompt&&prompt.text)||'Draw anything!';
      }
      if(r.stage==='guess'){
        const idx=[...r.members.keys()].indexOf(id);
        const fromIdx=((r.round+idx)%r.members.size);
        const ownerId=[...r.members.keys()][fromIdx];
        const draw=r.submissions.draw?.get(ownerId);
        st.assignmentImage=draw?draw.image:null;
      }
      io.to(id).emit('game:state',st);
    }
  }
  function startTimer(r,sec){clearTimer(r);r._timerCount=sec;io.to('dp:'+r.code).emit('game:timer',r._timerCount);r._timer=setInterval(()=>{r._timerCount--;io.to('dp:'+r.code).emit('game:timer',r._timerCount);if(r._timerCount<=0){clearTimer(r);checkAdvance(r,true)}},1000)}
  function clearTimer(r){if(r._timer){clearInterval(r._timer);r._timer=null}}
  function checkAdvance(r,timeout=false){
    const total=r.members.size;const subs=r.submissions[r.stage]?r.submissions[r.stage].size:0;
    if(subs>=total||timeout){
      if(r.stage==='prompt'){r.stage='draw';emitState(r);startTimer(r,60);return}
      if(r.stage==='draw'){r.stage='guess';emitState(r);startTimer(r,45);return}
      if(r.stage==='guess'){
        const ids=[...r.members.keys()];
        for(let i=0;i<ids.length;i++){
          const ownerId=ids[i];
          const prompt=r.submissions.prompt?.get(ownerId);
          const draw=r.submissions.draw?.get(ownerId);
          const guess=r.submissions.guess?.get(ownerId);
          if(!r.chains[i]) r.chains[i] = { owner: r.members.get(ownerId)?.name || 'Player', sequence: [] };
          const chain=r.chains[i];
          if(prompt && chain.sequence.length===0) chain.sequence.push({type:'text',value:prompt.text||''});
          if(draw) chain.sequence.push({type:'image',value:draw.image});
          if(guess) chain.sequence.push({type:'text',value:guess.text||''});
        }
        r.round+=1;
        if(r.round>=r.members.size){ r.stage='results'; clearTimer(r); io.to('dp:'+r.code).emit('game:results',{stories:r.chains}); emitState(r); }
        else { r.submissions={}; r.stage='prompt'; emitState(r); startTimer(r,50); }
        return
      }
    }
  }
  socket.on('game:start',()=>{const r=inRoom();if(!r)return;if(socket.id!==r.hostId)return;if(r.members.size<3){io.to('dp:'+r.code).emit('dp:status','Need at least 3 players');return}r.stage='prompt';r.round=0;r.order=[...r.members.keys()];r.assignments={};r.submissions={};r.chains=[];emitRoom(r);emitState(r);startTimer(r,50)});
  socket.on('game:submit',(payload)=>{const r=inRoom();if(!r)return;if(!r.submissions[r.stage])r.submissions[r.stage]=new Map();r.submissions[r.stage].set(socket.id,payload);checkAdvance(r)});

  socket.on('disconnect',()=>{
    const code=socket.data.dpRoom;if(!code)return;
    const r=rooms.get(code);if(!r)return;
    r.members.delete(socket.id);
    if(socket.id===r.hostId){const first=[...r.members.keys()][0];r.hostId=first||null;if(first&&r.members.get(first))r.members.get(first).isHost=true}
    emitRoom(r);
    if(r.members.size===0) rooms.delete(code);
  });

  // ----- Admin endpoints (per-socket auth via ADMIN_CODE) -----
  function requireAdmin(req,res,next){
    const s=req._socket;
    if(!s || !s.data) return res.status(403).json({ok:false});
    if(!s.data.isAdmin) return res.status(403).json({ok:false});
    return next();
  }
  function currentRoomFor(req){
    const s=req._socket; if(!s) return null; const code=s.data.dpRoom; return code?rooms.get(code):null;
  }

  app.post('/api/admin/auth', (req,res)=>{
    const { code } = req.body || {};
    if(String(code||'') === ADMIN_CODE){
      socket.data.isAdmin = true;
      return res.json({ ok:true });
    }
    return res.status(401).json({ ok:false });
  });

  app.post('/api/admin/start', (req,res)=>{
    if(!socket.data.isAdmin) return res.status(403).json({ok:false});
    const r=currentRoomFor(req); if(!r) return res.status(400).json({ok:false});
    r.stage='prompt'; r.round=0; r.order=[...r.members.keys()]; r.assignments={}; r.submissions={}; r.chains=[];
    emitRoom(r); emitState(r); startTimer(r,50);
    res.json({ok:true});
  });

  app.post('/api/admin/timer', (req,res)=>{
    if(!socket.data.isAdmin) return res.status(403).json({ok:false});
    const { delta=0 } = req.body || {};
    const r=currentRoomFor(req); if(!r) return res.status(400).json({ok:false});
    r._timerCount = Math.max(0, (r._timerCount||0) + Number(delta||0));
    io.to('dp:'+r.code).emit('game:timer', r._timerCount);
    res.json({ok:true, seconds:r._timerCount});
  });

  app.post('/api/admin/lock', (req,res)=>{
    if(!socket.data.isAdmin) return res.status(403).json({ok:false});
    const r=currentRoomFor(req); if(!r) return res.status(400).json({ok:false});
    r.locked = !r.locked; emitRoom(r);
    res.json({ok:true, locked:r.locked});
  });

  app.post('/api/admin/size', (req,res)=>{
    if(!socket.data.isAdmin) return res.status(403).json({ok:false});
    const r=currentRoomFor(req); if(!r) return res.status(400).json({ok:false});
    let s = Math.min(12, Math.max(3, parseInt((req.body||{}).size,10)||8));
    r.size = s; emitRoom(r);
    res.json({ok:true, size:s});
  });

  app.post('/api/admin/announce', (req,res)=>{
    if(!socket.data.isAdmin) return res.status(403).json({ok:false});
    const r=currentRoomFor(req); if(!r) return res.status(400).json({ok:false});
    const text = String((req.body||{}).text || '').slice(0,140);
    io.to('dp:'+r.code).emit('dp:status', text || 'Announcement');
    res.json({ok:true});
  });

  app.post('/api/admin/kick', (req,res)=>{
    if(!socket.data.isAdmin) return res.status(403).json({ok:false});
    const r=currentRoomFor(req); if(!r) return res.status(400).json({ok:false});
    const id = String((req.body||{}).id || '');
    if(!id || !r.members.has(id)) return res.status(404).json({ok:false});
    r.members.delete(id); io.sockets.sockets.get(id)?.leave('dp:'+r.code);
    emitRoom(r);
    res.json({ok:true});
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('✅ Dome Phone with Admin & host-first public lobby on', PORT));
