
const grid=document.getElementById('grid'); const roomInfo=document.getElementById('roomInfo');
const usernameEl=document.getElementById('username'); const roomCodeEl=document.getElementById('roomCode');
let localStream=null; let peers=new Map(); let socket=null; let myRoom=null; let me=null;

function addTile(id,name,stream,isLocal){
  let card=document.getElementById('card_'+id);
  if(!card){ card=document.createElement('div'); card.className='card'; card.id='card_'+id;
    const v=document.createElement('video'); v.autoplay=true; v.playsInline=true; v.muted=isLocal; v.id='video_'+id; card.appendChild(v);
    const n=document.createElement('div'); n.className='name'; n.textContent=name||('User '+id.slice(0,4)); card.appendChild(n);
    grid.appendChild(card);
  }
  if(stream){ const v=document.getElementById('video_'+id); v.srcObject=stream; v.play().catch(()=>{}); }
}
function removeTile(id){ const card=document.getElementById('card_'+id); if(card) card.remove(); }
function code(n=6){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<n;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}

function connectSocket(){ if(socket) return; socket=io();
  socket.on('connect',()=>{ me=socket.id; });
  socket.on('phone:roomInfo',(info)=>{ roomInfo.textContent = `Room ${info.code} • ${info.count} online`; });
  socket.on('phone:peers',({peers:list})=>{ list.forEach(async p=>{ if(p.id===me) return; if(!peers.has(p.id)) await createOfferTo(p.id); }); });
  socket.on('phone:user-join',({id,name})=>{ addTile(id,name,null,false); });
  socket.on('phone:user-leave',({id})=>{ removeTile(id); const pc=peers.get(id); if(pc){ pc.close(); peers.delete(id);} });
  socket.on('phone:signal',async ({from,type,description,candidate})=>{
    let pc = peers.get(from); if(!pc){ pc = await makePeer(from); }
    if(type==='sdp'){
      await pc.setRemoteDescription(description);
      if(description.type==='offer'){
        await pc.setLocalDescription(await pc.createAnswer());
        socket.emit('phone:signal',{to:from,type:'sdp',description:pc.localDescription,room:myRoom});
      }
    } else if(type==='ice'){
      if(!pc.remoteDescription){ (pc._pend||(pc._pend=[])).push(candidate); }
      else { try{ await pc.addIceCandidate(candidate); }catch{} }
    }
  });
}

async function ensureMedia(){
  return new Promise((resolve)=>{
    MediaPerms.ensureLocal({
      video:true, audio:true, autoStart:true,
      overlayIds:{overlay:'camOverlay', enableBtn:'enableCamBtn', diag:'diag', camSel:'camSelectOverlay', micSel:'micSelectOverlay', applyBtn:'applyDevicesBtn'},
      localVideoId:'dummyLocal',
      onStream:(s)=>{ localStream=s; resolve(s); }
    });
  });
}

async function makePeer(to){
  const res = await fetch('/ice',{cache:'no-store'}); const ice = await res.json().catch(()=>[{urls:['stun:stun.l.google.com:19302']}]);
  const pc = new RTCPeerConnection({ iceServers: ice });
  localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));
  pc.ontrack = e => { if(e.streams&&e.streams[0]) addTile(to, '', e.streams[0], false); };
  pc.onicecandidate = ({candidate}) => { if(candidate) socket.emit('phone:signal',{to, type:'ice', candidate, room:myRoom}); };
  pc.onconnectionstatechange = () => { if(pc.connectionState==='failed'){ try{pc.restartIce()}catch{} } };
  peers.set(to, pc);
  return pc;
}

async function createOfferTo(id){
  const pc = await makePeer(id);
  await pc.setLocalDescription(await pc.createOffer({offerToReceiveAudio:true, offerToReceiveVideo:true}));
  socket.emit('phone:signal',{to:id,type:'sdp',description:pc.localDescription,room:myRoom});
}

document.getElementById('createRoom').onclick = async ()=>{
  connectSocket();
  const name = (usernameEl.value||'Guest').slice(0,16);
  myRoom = code(6);
  await ensureMedia();
  addTile('me', name, localStream, true);
  socket.emit('phone:create',{code:myRoom,name});
};
document.getElementById('joinRoom').onclick = async ()=>{
  const rc=(roomCodeEl.value||'').trim().toUpperCase(); if(!rc) return alert('Enter a room code');
  connectSocket();
  const name=(usernameEl.value||'Guest').slice(0,16); myRoom=rc;
  await ensureMedia();
  addTile('me', name, localStream, true);
  socket.emit('phone:join',{code:myRoom,name});
};
