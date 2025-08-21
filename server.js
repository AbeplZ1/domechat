
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, methods: ['GET','POST'] } });

app.use(express.static('public'));
app.get('/', (_req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/health', (_req,res)=> res.json({ok:true}));

// ===== Dome Phone =====
const rooms = new Map(); // code -> { code,size,hostId,stage,round,order,assignments,submissions,members: Map(id->{name,isHost}) }
const publicQueues = new Map(); // size -> array of socket.id waiting

function code(n=6){
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<n;i++) s+=a[Math.floor(Math.random()*a.length)];
  return s;
}
function getRoom(codeStr){
  let r = rooms.get(codeStr);
  if(!r){
    r = { code: codeStr, size: 8, hostId: null, stage: 'lobby', round: 0, order: [], assignments: {}, submissions: {}, members: new Map(), chains: [] };
    rooms.set(codeStr, r);
  }
  return r;
}
function snapshotRoom(r){
  return {
    code: r.code,
    size: r.size,
    hostId: r.hostId,
    stage: r.stage,
    round: r.round,
    members: [...r.members.entries()].map(([id,m])=>({id,name:m.name,isHost:m.isHost}))
  };
}
function emitRoom(r){ io.to('dp:'+r.code).emit('dp:room', snapshotRoom(r)); }

io.on('connection', (socket)=>{
  socket.on('dp:create', ({name='Guest', size=8}={})=>{
    const c = code(6);
    const r = getRoom(c);
    r.size = Math.min(12, Math.max(3, parseInt(size,10)||8));
    r.hostId = socket.id;
    r.stage = 'lobby'; r.round = 0; r.order = []; r.assignments = {}; r.submissions = {}; r.chains = [];
    r.members.clear();
    r.members.set(socket.id, { name: String(name).slice(0,16), isHost: true });
    socket.join('dp:'+c); socket.data.room = c;
    emitRoom(r);
  });

  socket.on('dp:join', ({name='Guest', code}={})=>{
    const r = rooms.get(String(code||'').toUpperCase());
    if(!r) return socket.emit('dp:status','Room not found');
    if(r.members.size >= r.size) return socket.emit('dp:status','Room is full');
    r.members.set(socket.id, { name: String(name).slice(0,16), isHost: false });
    socket.join('dp:'+r.code); socket.data.room = r.code;
    emitRoom(r);
  });

  socket.on('dp:public', ({name='Guest', size=8}={})=>{
    const target = Math.min(12, Math.max(3, parseInt(size,10)||8));
    // Try to find a room not full and in lobby
    for (const r of rooms.values()){
      if (r.size===target && r.stage==='lobby' && r.members.size < r.size){
        r.members.set(socket.id, { name: String(name).slice(0,16), isHost: false });
        socket.join('dp:'+r.code); socket.data.room = r.code; emitRoom(r); return;
      }
    }
    // Otherwise create a new public room and wait
    const c = code(6);
    const r = getRoom(c);
    r.size = target;
    if (!r.hostId) r.hostId = socket.id; // first joiner becomes temporary host
    r.stage = 'lobby'; r.round=0; r.order=[]; r.assignments={}; r.submissions={}; r.chains=[];
    r.members.set(socket.id, { name: String(name).slice(0,16), isHost: (r.hostId===socket.id) });
    socket.join('dp:'+c); socket.data.room = c; emitRoom(r);
  });

  // --- Game flow like Gartic Phone ---
  function roomOf(sock){
    const c = sock.data.room; if(!c) return null; return rooms.get(c);
  }

  socket.on('game:start', ()=>{
    const r = roomOf(socket); if(!r) return;
    if (socket.id !== r.hostId) return;
    if (r.members.size < 3) { io.to('dp:'+r.code).emit('dp:status', 'Need at least 3 players'); return; }
    r.stage = 'prompt';
    r.round = 0;
    r.order = [...r.members.keys()]; // array of socket ids
    r.assignments = {}; r.submissions = {}; r.chains = r.order.map(id=>({ owner: r.members.get(id).name, sequence: [] }));
    emitRoom(r);
    emitGameState(r);
    startTimer(r, 50);
  });

  socket.on('game:submit', (payload)=>{
    const r = roomOf(socket); if(!r) return;
    if(!r.submissions[r.stage]) r.submissions[r.stage] = new Map();
    r.submissions[r.stage].set(socket.id, payload);
    checkAdvance(r);
  });

  function startTimer(r, seconds){
    clearTimer(r);
    r._timerCount = seconds;
    io.to('dp:'+r.code).emit('game:timer', r._timerCount);
    r._timer = setInterval(()=>{
      r._timerCount -= 1;
      io.to('dp:'+r.code).emit('game:timer', r._timerCount);
      if (r._timerCount <= 0){
        clearTimer(r);
        // Auto-advance with whatever is submitted
        checkAdvance(r, true);
      }
    }, 1000);
  }
  function clearTimer(r){
    if (r._timer){ clearInterval(r._timer); r._timer = null; }
  }

  function emitGameState(r){
    const base = { stage: r.stage, stageTitle: stageTitleFor(r.stage), round: r.round };
    for (const [id,_m] of r.members){
      let state = { ...base };
      if (r.stage === 'draw'){
        // assignment for drawing: receive previous prompt
        const idx = r.order.indexOf(id);
        const fromIdx = ((r.round + idx) % r.order.length);
        const ownerId = r.order[fromIdx];
        const promptPayload = r.submissions.prompt?.get(ownerId);
        state.assignment = (promptPayload && promptPayload.text) || 'Draw anything!';
      }
      if (r.stage === 'guess'){
        // assignment image to guess
        const idx = r.order.indexOf(id);
        const fromIdx = ((r.round + idx) % r.order.length);
        const ownerId = r.order[fromIdx];
        const drawPayload = r.submissions.draw?.get(ownerId);
        state.assignmentImage = drawPayload ? drawPayload.image : null;
      }
      io.to(id).emit('game:state', state);
    }
  }
  function stageTitleFor(stage){
    if(stage==='lobby') return 'Lobby';
    if(stage==='prompt') return 'Write a prompt';
    if(stage==='draw') return 'Draw the prompt';
    if(stage==='guess') return 'Describe the drawing';
    if(stage==='results') return 'Results';
    return '';
  }

  function checkAdvance(r, timeout=false){
    const total = r.members.size;
    const subs = r.submissions[r.stage] ? r.submissions[r.stage].size : 0;
    if (subs >= total || timeout){
      if (r.stage === 'prompt'){
        r.stage = 'draw';
        emitGameState(r);
        startTimer(r, 60);
        return;
      }
      if (r.stage === 'draw'){
        r.stage = 'guess';
        emitGameState(r);
        startTimer(r, 45);
        return;
      }
      if (r.stage === 'guess'){
        // Commit this round's submissions to chains
        const ids = r.order;
        for (let i=0;i<ids.length;i++){
          const ownerId = ids[i];
          const prompt = r.submissions.prompt?.get(ownerId);
          const draw = r.submissions.draw?.get(ownerId);
          const guess = r.submissions.guess?.get(ownerId);
          const chain = r.chains[i];
          if (prompt && chain.sequence.length===0) chain.sequence.push({type:'text', value: prompt.text||''});
          if (draw) chain.sequence.push({type:'image', value: draw.image});
          if (guess) chain.sequence.push({type:'text', value: guess.text||''});
        }
        r.round += 1;
        if (r.round >= r.members.size){ // all chains completed
          r.stage = 'results';
          clearTimer(r);
          const results = r.chains.map(c=>({owner: c.owner, sequence: c.sequence}));
          io.to('dp:'+r.code).emit('game:results', { stories: results });
          emitGameState(r);
        } else {
          // next cycle
          r.submissions = {}; // reset per-stage submissions
          r.stage = 'prompt';
          emitGameState(r);
          startTimer(r, 50);
        }
        return;
      }
    }
  }

  socket.on('disconnect', ()=>{
    // Remove from room
    const c = socket.data.room;
    if(!c) return;
    const r = rooms.get(c);
    if(!r) return;
    r.members.delete(socket.id);
    if (socket.id === r.hostId){
      // reassign host if possible
      const first = r.members.keys().next().value;
      r.hostId = first || null;
      if (first && r.members.get(first)) r.members.get(first).isHost = true;
    }
    emitRoom(r);
    if (r.members.size===0){ rooms.delete(c); }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('Dome Phone server on', PORT));
