
window.MediaPerms = (function(){
  async function enumerateDiag() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter(d => d.kind === 'videoinput');
      const mics = list.filter(d => d.kind === 'audioinput');
      return { cams, mics, list };
    } catch (e) { return { cams:[], mics:[], list:[], error:String(e) }; }
  }
  function audioConstraints(wantProcessing){ return wantProcessing ? { echoCancellation:true, noiseSuppression:true, autoGainControl:true } : true; }

  async function ensureLocal(opts = {}) {
    const { video=true, audio=true, overlayIds={}, localVideoId='localVideo', wantProcessing=true, onStream=null } = opts;
    const overlay = document.getElementById(overlayIds.overlay || 'camOverlay');
    const enableBtn = document.getElementById(overlayIds.enableBtn || 'enableCamBtn');
    const diagEl = document.getElementById(overlayIds.diag || 'diag');
    const camSel = document.getElementById(overlayIds.camSel || 'camSelect2');
    const micSel = document.getElementById(overlayIds.micSel || 'micSelect2');
    const localVideo = document.getElementById(localVideoId);
    const setDiag = (t) => { if (diagEl) diagEl.textContent = t || ''; };

    async function populateSelects(){
      const { cams, mics } = await enumerateDiag();
      if (camSel) { camSel.innerHTML = cams.map((d,i)=>`<option value="${d.deviceId}">${d.label||'Camera '+(i+1)}</option>`).join(''); }
      if (micSel) { micSel.innerHTML = mics.map((d,i)=>`<option value="${d.deviceId}">${d.label||'Microphone '+(i+1)}</option>`).join(''); }
    }
    async function getConstraints(){
      const vId = camSel && camSel.value ? { deviceId: { exact: camSel.value } } : {};
      const aId = micSel && micSel.value ? { deviceId: { exact: micSel.value } } : {};
      return { video: video ? { facingMode:'user', width:{ideal:1280}, height:{ideal:720}, ...vId } : false,
               audio: audio ? { ...audioConstraints(wantProcessing), ...aId } : false };
    }
    async function tryOpen(constraints){
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (localVideo) { localVideo.srcObject = stream; localVideo.muted = true; await localVideo.play().catch(()=>{}); }
        if (overlay) overlay.style.display='none'; setDiag(''); onStream && onStream(stream); return stream;
      } catch (e) { setDiag(`${e.name||'Error'} — ${e.message||e}`); return null; }
    }

    if (overlay) overlay.style.display = 'flex'; await populateSelects();
    if (enableBtn && !enableBtn._bound) {
      enableBtn._bound = true;
      enableBtn.addEventListener('click', async()=>{
        enableBtn.disabled = true;
        let s = await tryOpen(await getConstraints());
        if (!s) s = await tryOpen({ video: !!video, audio: !!audio });
        if (!s) enableBtn.disabled = false;
      });
    }
    return null;
  }
  return { ensureLocal };
})();
