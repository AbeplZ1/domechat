
const chat=document.getElementById('chatMessages');function addMessage(text,self=false){const d=document.createElement('div');d.className='msg '+(self?'self':'other');d.textContent=text;const t=document.createElement('span');t.className='timestamp';t.textContent=new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});d.appendChild(t);chat.appendChild(d);chat.scrollTop=chat.scrollHeight}
const typing=document.getElementById('typingIndicator');const setSearching=(on)=>document.getElementById('searchOverlay').style.display=on?'flex':'none';
let localStream=null; let pc=null; const msgIn=document.getElementById('messageInput'); const sendBtn=document.getElementById('sendBtn');
const remoteVideo=document.getElementById('remoteVideo'); const localVideo=document.getElementById('localVideo'); const unmuteOverlay=document.getElementById('unmuteOverlay');
remoteVideo.muted=true; unmuteOverlay.style.display='block'; unmuteOverlay.onclick=()=>{remoteVideo.muted=false;unmuteOverlay.style.display='none'};
let audioCtx, analyser, micMeter=document.getElementById('micMeter'); let remoteCtx, remoteAnalyser, remoteMeter=document.getElementById('remoteMeter');
function startMicMeter(stream){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();const source=audioCtx.createMediaStreamSource(stream);analyser=audioCtx.createAnalyser();analyser.fftSize=256;source.connect(analyser);
const data=new Uint8Array(analyser.frequencyBinCount);(function loop(){analyser.getByteTimeDomainData(data);let sum=0;for(let i=0;i<data.length;i++){const v=(data[i]-128)/128;sum+=v*v}const rms=Math.sqrt(sum/data.length);micMeter.textContent='mic: '+(rms>0.02?'live':'quiet');requestAnimationFrame(loop)})()}catch{}}
function startRemoteMeter(videoEl){try{remoteCtx=new (window.AudioContext||window.webkitAudioContext)();const src=remoteCtx.createMediaElementSource(videoEl);remoteAnalyser=remoteCtx.createAnalyser();remoteAnalyser.fftSize=256;src.connect(remoteAnalyser);remoteAnalyser.connect(remoteCtx.destination);
const data=new Uint8Array(remoteAnalyser.frequencyBinCount);(function loop(){remoteAnalyser.getByteTimeDomainData(data);let sum=0;for(let i=0;i<data.length;i++){const v=(data[i]-128)/128;sum+=v*v}const rms=Math.sqrt(sum/data.length);remoteMeter.textContent='remote: '+(rms>0.02?'live':'quiet');requestAnimationFrame(loop)})()}catch{}}

MediaPerms.ensureLocal({
  video:true, audio:true,
  overlayIds:{overlay:'camOverlay', enableBtn:'enableCamBtn', diag:'diag', camSel:'camSelect2', micSel:'micSelect2'},
  localVideoId:'localVideo',
  onStream:(s)=>{ localStream=s; startMicMeter(s); if(pc){ const senders=pc.getSenders(); const vTrack=s.getVideoTracks()[0]; const aTrack=s.getAudioTracks()[0];
      const vSender=senders.find(x=>x.track&&x.track.kind==='video'); const aSender=senders.find(x=>x.track&&x.track.kind==='audio');
      if(vSender && vTrack) vSender.replaceTrack(vTrack); else if(vTrack) pc.addTrack(vTrack,s);
      if(aSender && aTrack) aSender.replaceTrack(aTrack); else if(aTrack) pc.addTrack(aTrack,s);
      try{ pc.restartIce(); }catch{} } }, wantProcessing:true
});

let makingOffer=false,ignoreOffer=false,isPolite=false,hasPartner=false,currentPartnerId=null;const pendingCandidates=[];function drainPending(){if(!pc||!pc.remoteDescription)return;while(pendingCandidates.length){pc.addIceCandidate(pendingCandidates.shift()).catch(()=>{})}}
let ICE={iceServers:[{urls:['stun:stun.l.google.com:19302']}]};(async()=>{try{const r=await fetch('/ice',{cache:'no-store'});const list=await r.json();if(Array.isArray(list)&&list.length)ICE={iceServers:list}}catch{}})();
const params=new URLSearchParams(location.search);const topic=(params.get('topic')||'').trim();const forceRelay=params.get('relay')==='1';
const SID_KEY='dome_sid';let sessionId=localStorage.getItem(SID_KEY);if(!sessionId){sessionId=(crypto.randomUUID?.()||(Date.now().toString(36)+Math.random().toString(36).slice(2,8)));localStorage.setItem(SID_KEY,sessionId)}
const socket=io();socket.emit('session',sessionId);socket.emit('setTopic',topic);

socket.on('roles',({polite,peerId})=>{isPolite=!!polite;currentPartnerId=peerId});
socket.on('waiting',msg=>{addMessage(msg);setSearching(true)});
socket.on('partnerFound',async()=>{
  setSearching(false); hasPartner=true; chat.textContent=''; addMessage('You found a new partner!');
  if(!localStream){ addMessage('Click \"Enable camera & mic\" to start.', true); return; }
  if(!pc){ pc=new RTCPeerConnection({...ICE,...(forceRelay?{iceTransportPolicy:'relay'}:{})});
    localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));
    pc.ontrack=e=>{ if(e.streams&&e.streams[0]){ remoteVideo.srcObject=e.streams[0]; remoteVideo.play().catch(()=>{}); startRemoteMeter(remoteVideo);} };
    pc.onicecandidate=({candidate})=>{ if(candidate) socket.emit('signal',{type:'ice',candidate}) };
    pc.onconnectionstatechange=()=>{ if(pc.connectionState==='failed'){ try{pc.restartIce()}catch{} } };
    pc.onnegotiationneeded=async()=>{ try{ makingOffer=true; await pc.setLocalDescription(await pc.createOffer()); socket.emit('signal',{type:'sdp',description:pc.localDescription}); }finally{ makingOffer=false; } };
  }
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
socket.on('partnerDisconnected',()=>{ hasPartner=false; addMessage('Partner disconnected. Searching…'); setSearching(true); sendBtn.disabled=true; msgIn.disabled=true; setTimeout(()=>{ if(!hasPartner) socket.emit('next'); }, 1800); });

const sendBtnEl=document.getElementById('sendBtn');const msgInEl=document.getElementById('messageInput');
sendBtnEl.onclick=()=>{ if(!hasPartner) return; const txt=msgInEl.value.trim(); if(!txt) return; socket.emit('message',{text:txt}); addMessage(txt,true); msgInEl.value=''; };
msgInEl.addEventListener('keypress',e=>{ if(e.key==='Enter') sendBtnEl.click(); else if(hasPartner) socket.emit('typing',{from:socket.id}) });
socket.on('message',({text,from})=>{ if(!hasPartner || from===socket.id) return; if(typeof text==='string' && text) addMessage(text,false); });
socket.on('partnerTyping',({from})=>{ if(!hasPartner || from!==currentPartnerId) return; typing.textContent='Partner is typing...'; setTimeout(()=>typing.textContent='',900) });

const muteBtn=document.getElementById('muteBtn'); const camBtn=document.getElementById('camBtn');
muteBtn.onclick=()=>{ if(!localStream) return; const at=localStream.getAudioTracks()[0]; if(!at) return; at.enabled=!at.enabled; muteBtn.textContent='Mic: '+(at.enabled?'On':'Off'); try{pc&&pc.getSenders().find(s=>s.track&&s.track.kind==='audio')?.replaceTrack(at)}catch{}};
camBtn.onclick=()=>{ if(!localStream) return; const vt=localStream.getVideoTracks()[0]; if(!vt) return; vt.enabled=!vt.enabled; camBtn.textContent='Cam: '+(vt.enabled?'On':'Off'); try{pc&&pc.getSenders().find(s=>s.track&&s.track.kind==='video')?.replaceTrack(vt)}catch{}};
document.getElementById('blockBtn').onclick=()=>{ if(!currentPartnerId)return alert('No partner to block.'); socket.emit('disconnectPartner') };
document.getElementById('reportBtn').onclick=()=>{ if(!currentPartnerId)return alert('No partner to report.'); socket.emit('report',{partnerId:currentPartnerId, topic:(new URLSearchParams(location.search).get('topic')||'')}); socket.emit('disconnectPartner'); };
document.getElementById('nextBtn').onclick=()=>{ if(hasPartner) socket.emit('next'); else socket.emit('setTopic', topic); };
document.getElementById('disconnectBtn').onclick=()=>{ if(hasPartner) socket.emit('disconnectPartner'); location.href='/'; };
