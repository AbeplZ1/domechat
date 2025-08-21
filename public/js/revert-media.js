
const chat=document.getElementById('chatMessages');function addMessage(text,self=false){const d=document.createElement('div');d.className='msg '+(self?'self':'other');d.textContent=text;const t=document.createElement('span');t.className='timestamp';t.textContent=new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});d.appendChild(t);chat.appendChild(d);chat.scrollTop=chat.scrollHeight}
const typing=document.getElementById('typingIndicator');const setSearching=(on)=>document.getElementById('searchOverlay').style.display=on?'flex':'none';
let localStream=null; let pc=null; const msgIn=document.getElementById('messageInput'); const sendBtn=document.getElementById('sendBtn');
const remoteVideo=document.getElementById('remoteVideo'); const localVideo=document.getElementById('localVideo'); const unmuteOverlay=document.getElementById('unmuteOverlay');
remoteVideo.muted=true; unmuteOverlay.style.display='block'; unmuteOverlay.onclick=()=>{remoteVideo.muted=false;unmuteOverlay.style.display='none'};

let ICE={iceServers:[{urls:['stun:stun.l.google.com:19302']}]};(async()=>{try{const r=await fetch('/ice',{cache:'no-store'});const list=await r.json();if(Array.isArray(list)&&list.length)ICE={iceServers:list}}catch{}})();

async function openMedia(){
  try{
    localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    localVideo.srcObject=localStream; await localVideo.play().catch(()=>{});
    document.getElementById('enableBtn').disabled=true;
    // if already connected, add tracks
    if(pc){ localStream.getTracks().forEach(t=>{ if(!pc.getSenders().some(s=>s.track===t)) pc.addTrack(t, localStream); }); try{pc.restartIce()}catch{} }
  }catch(e){
    alert('Please allow camera & microphone in your browser settings.');
  }
}

window.addEventListener('load', ()=> { openMedia().catch(()=>{}); });

document.getElementById('enableBtn').onclick = openMedia;

let makingOffer=false,ignoreOffer=false,isPolite=false,hasPartner=false,currentPartnerId=null;const pendingCandidates=[];function drainPending(){if(!pc||!pc.remoteDescription)return;while(pendingCandidates.length){pc.addIceCandidate(pendingCandidates.shift()).catch(()=>{})}}

const params=new URLSearchParams(location.search);const topic=(params.get('topic')||'').trim();
const SID_KEY='dome_sid';let sessionId=localStorage.getItem(SID_KEY);if(!sessionId){sessionId=(crypto.randomUUID?.()||(Date.now().toString(36)+Math.random().toString(36).slice(2,8)));localStorage.setItem(SID_KEY,sessionId)}
const socket=io();socket.emit('session',sessionId);socket.emit('setTopic',topic);

socket.on('roles',({polite,peerId})=>{isPolite=!!polite;currentPartnerId=peerId});
socket.on('waiting',msg=>{addMessage(msg);setSearching(true)});
socket.on('partnerFound',async()=>{
  setSearching(false); hasPartner=true; chat.textContent=''; addMessage('You found a new partner!');
  if(!pc){ pc=new RTCPeerConnection(ICE); }
  if(localStream){ localStream.getTracks().forEach(t=>{ if(!pc.getSenders().some(s=>s.track===t)) pc.addTrack(t, localStream); }); }
  pc.ontrack=e=>{ if(e.streams&&e.streams[0]){ remoteVideo.srcObject=e.streams[0]; remoteVideo.play().catch(()=>{});} };
  pc.onicecandidate=({candidate})=>{ if(candidate) socket.emit('signal',{type:'ice',candidate}) };
  pc.onnegotiationneeded=null; // we do manual offer for reliability
  try{ makingOffer=true; await pc.setLocalDescription(await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true})); socket.emit('signal',{type:'sdp',description:pc.localDescription}); } finally { makingOffer=false; }
  sendBtn.disabled=false; msgIn.disabled=false;
});

socket.on('signal',async({type,description,candidate})=>{
  if(!pc) return;
  if(type==='sdp'){
    const collision=(description.type==='offer')&&(makingOffer||pc.signalingState!=='stable');
    ignoreOffer=!isPolite&&collision; if(ignoreOffer)return;
    await pc.setRemoteDescription(description);
    if(description.type==='offer'){ await pc.setLocalDescription(await pc.createAnswer()); socket.emit('signal',{type:'sdp',description:pc.localDescription}); }
    drainPending();
  }else if(type==='ice'){
    if(!pc.remoteDescription) pendingCandidates.push(candidate); else { try{ await pc.addIceCandidate(candidate); }catch{} }
  }
});
socket.on('partnerDisconnected',()=>{ hasPartner=false; addMessage('Partner disconnected. Searching…'); setSearching(true); sendBtn.disabled=true; msgIn.disabled=true; setTimeout(()=>{ if(!hasPartner) socket.emit('next'); }, 1500); });

const sendBtnEl=document.getElementById('sendBtn');const msgInEl=document.getElementById('messageInput');
sendBtnEl.onclick=()=>{ if(!hasPartner) return; const txt=msgInEl.value.trim(); if(!txt) return; socket.emit('message',{text:txt}); addMessage(txt,true); msgInEl.value=''; };
msgInEl.addEventListener('keypress',e=>{ if(e.key==='Enter') sendBtnEl.click(); else if(hasPartner) socket.emit('typing',{from:socket.id}) });
socket.on('message',({text,from})=>{ if(!hasPartner || from===socket.id) return; if(typeof text==='string' && text) addMessage(text,false); });

const muteBtn=document.getElementById('muteBtn'); const camBtn=document.getElementById('camBtn');
muteBtn.onclick=()=>{ if(!localStream) return; const at=localStream.getAudioTracks()[0]; if(!at) return; at.enabled=!at.enabled; muteBtn.textContent='Mic: '+(at.enabled?'On':'Off'); try{pc&&pc.getSenders().find(s=>s.track&&s.track.kind==='audio')?.replaceTrack(at)}catch{}};
camBtn.onclick=()=>{ if(!localStream) return; const vt=localStream.getVideoTracks()[0]; if(!vt) return; vt.enabled=!vt.enabled; camBtn.textContent='Cam: '+(vt.enabled?'On':'Off'); try{pc&&pc.getSenders().find(s=>s.track&&s.track.kind==='video')?.replaceTrack(vt)}catch{}};
document.getElementById('blockBtn').onclick=()=>{ if(!currentPartnerId)return alert('No partner to block.'); socket.emit('disconnectPartner') };
document.getElementById('reportBtn').onclick=()=>{ if(!currentPartnerId)return alert('No partner to report.'); socket.emit('report',{partnerId:currentPartnerId, topic:(new URLSearchParams(location.search).get('topic')||'')}); socket.emit('disconnectPartner'); };
document.getElementById('nextBtn').onclick=()=>{ if(hasPartner) socket.emit('next'); else socket.emit('setTopic', topic); };
document.getElementById('disconnectBtn').onclick=()=>{ if(hasPartner) socket.emit('disconnectPartner'); location.href='/'; };
