
const usernameEl = document.getElementById('username');
const sizeEl = document.getElementById('size');
const roomCodeEl = document.getElementById('roomCode');
const roomInfo = document.getElementById('roomInfo');
const membersRow = document.getElementById('membersRow');
const startBtn = document.getElementById('startGame');
const stageTitle = document.getElementById('stageTitle');
const stagePanel = document.getElementById('stagePanel');

let socket = io();
let me = null;
let myRoom = null;
let isHost = false;
let members = [];

function setMembers(list){
  members = list || [];
  membersRow.innerHTML = '<ul class="inline">'+members.map(m=>`<li>${m.name}${m.isHost?' ⭐':''}</li>`).join('')+'</ul>';
  roomInfo.textContent = myRoom ? `Room ${myRoom.code} • ${members.length}/${myRoom.size}` : 'No room yet';
  startBtn.disabled = !(isHost && members.length >= 3);
}

socket.on('connect', ()=>{ me = socket.id; });

socket.on('dp:room', (room)=>{ myRoom = room; isHost = room.hostId === me; setMembers(room.members); stageTitle.textContent = room.stage==='lobby'?'Lobby':stageTitle.textContent; });
socket.on('dp:members', (list)=> setMembers(list));
socket.on('dp:status', (t)=> { roomInfo.textContent = t; });
socket.on('game:state', (state)=> renderState(state));
socket.on('game:timer', (sec)=> updateTimer(sec));
socket.on('game:results', (payload)=> renderResults(payload));

document.getElementById('createPrivate').onclick = ()=>{
  const name = (usernameEl.value || 'Guest').slice(0,16);
  const size = parseInt(sizeEl.value,10);
  socket.emit('dp:create', { name, size });
};
document.getElementById('joinPrivate').onclick = ()=>{
  const name = (usernameEl.value || 'Guest').slice(0,16);
  const code = (roomCodeEl.value || '').trim().toUpperCase();
  if(!code) return alert('Enter a room code');
  socket.emit('dp:join', { name, code });
};
document.getElementById('publicLobby').onclick = ()=>{
  const name = (usernameEl.value || 'Guest').slice(0,16);
  const size = parseInt(sizeEl.value,10);
  socket.emit('dp:public', { name, size });
};
startBtn.onclick = ()=> socket.emit('game:start');

let currentTimer = null;
function updateTimer(sec){
  const tEl = document.getElementById('timerEl');
  if (tEl) tEl.textContent = `⏱ ${sec}s`;
}

function renderState(state){
  stageTitle.textContent = state.stageTitle;
  startBtn.style.display = state.stage==='lobby' ? 'inline-block' : 'none';
  stagePanel.innerHTML = '';
  if(state.stage === 'lobby'){
    stagePanel.innerHTML = `<div class="small">Waiting for players... Host can start when ready.</div>`;
    return;
  }
  if(state.stage === 'prompt'){
    const wrap = document.createElement('div');
    wrap.className = 'stack';
    const p = document.createElement('textarea');
    p.placeholder = 'Write a funny prompt...';
    p.maxLength = 120;
    const submit = document.createElement('button');
    submit.textContent = 'Submit prompt';
    const timer = document.createElement('div'); timer.id='timerEl'; timer.className='timer';
    submit.onclick = ()=> socket.emit('game:submit', { text: p.value });
    wrap.appendChild(timer); wrap.appendChild(p); wrap.appendChild(submit);
    stagePanel.appendChild(wrap);
    return;
  }
  if(state.stage === 'draw'){
    const wrap = document.createElement('div'); wrap.className='stack';
    const timer = document.createElement('div'); timer.id='timerEl'; timer.className='timer';
    const canvasWrap = document.createElement('div'); canvasWrap.className='canvas-wrap';
    const c = document.createElement('canvas'); c.width=720; c.height=420; c.id='draw';
    const row = document.createElement('div'); row.className='row';
    const prompt = document.createElement('div'); prompt.className='badge'; prompt.textContent = `Prompt: ${state.assignment || ''}`;
    const clearBtn = document.createElement('button'); clearBtn.className='ghost'; clearBtn.textContent='Clear';
    const submit = document.createElement('button'); submit.textContent='Submit drawing';
    const ctx=c.getContext('2d'); ctx.fillStyle='#111'; ctx.fillRect(0,0,c.width,c.height); ctx.strokeStyle='#fff'; ctx.lineWidth=3; let drawing=false;
    c.onpointerdown=e=>{drawing=true;ctx.beginPath();ctx.moveTo(e.offsetX,e.offsetY)};
    c.onpointermove=e=>{if(!drawing)return;ctx.lineTo(e.offsetX,e.offsetY);ctx.stroke()};
    c.onpointerup=()=>drawing=false; c.onpointerleave=()=>drawing=false;
    clearBtn.onclick=()=>{ctx.fillStyle='#111';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#fff'};
    submit.onclick=()=>{ c.toBlob(b=>{ const fr=new FileReader(); fr.onload=()=>socket.emit('game:submit',{ image: fr.result }); fr.readAsDataURL(b); }, 'image/png'); };
    canvasWrap.appendChild(c);
    row.appendChild(prompt); row.appendChild(clearBtn); row.appendChild(submit);
    wrap.appendChild(timer); wrap.appendChild(canvasWrap); wrap.appendChild(row);
    stagePanel.appendChild(wrap);
    return;
  }
  if(state.stage === 'guess'){
    const wrap = document.createElement('div'); wrap.className='stack';
    const timer = document.createElement('div'); timer.id='timerEl'; timer.className='timer';
    const img = new Image(); img.src = state.assignmentImage || ''; img.style.maxWidth='720px'; img.style.borderRadius='12px'; img.style.border='1px solid var(--line)';
    const input = document.createElement('textarea'); input.placeholder='Describe what you see...'; input.maxLength=120;
    const submit = document.createElement('button'); submit.textContent='Submit guess';
    submit.onclick = ()=> socket.emit('game:submit', { text: input.value });
    wrap.appendChild(timer); wrap.appendChild(img); wrap.appendChild(input); wrap.appendChild(submit);
    stagePanel.appendChild(wrap);
    return;
  }
  if(state.stage === 'results'){
    const wrap = document.createElement('div'); wrap.className='stack';
    const small = document.createElement('div'); small.className='small'; small.textContent='Slideshow of stories';
    const cards = document.createElement('div'); cards.className='cards';
    (state.stories||[]).forEach(story=>{
      const card = document.createElement('div'); card.className='card';
      const h = document.createElement('h4'); h.textContent = story.owner;
      card.appendChild(h);
      story.sequence.forEach(step=>{
        if(step.type==='text'){ const p=document.createElement('div'); p.textContent='📝 '+step.value; card.appendChild(p); }
        if(step.type==='image'){ const i=new Image(); i.src=step.value; i.style.width='100%'; i.style.borderRadius='10px'; i.style.marginTop='6px'; card.appendChild(i); }
      });
      cards.appendChild(card);
    });
    wrap.appendChild(small); wrap.appendChild(cards);
    stagePanel.appendChild(wrap);
  }
}
