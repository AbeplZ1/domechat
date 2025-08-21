
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
    const { video=true, audio=true, overlayIds={}, localVideoId='localVideo', wantProcessing=true, onStream=null, autoStart=true } = opts;
    const overlay = document.getElementById(overlayIds.overlay || 'camOverlay');
    const enableBtn = document.getElementById(overlayIds.enableBtn || 'enableCamBtn');
    const diagEl = document.getElementById(overlayIds.diag || 'diag');
    const camSel = document.getElementById(overlayIds.camSel || 'camSelectOverlay');
    const micSel = document.getElementById(overlayIds.micSel || 'micSelectOverlay');
    const applyBtn = document.getElementById(overlayIds.applyBtn || 'applyDevicesBtn');
    const localVideo = document.getElementById(localVideoId);
    const setDiag = (t) => { if (diagEl) diagEl.textContent = t || ''; };

    async function populateSelects(){
      const { cams, mics } = await enumerateDiag();
      if (camSel) { camSel.innerHTML = cams.map((d,i)=>`<option value="${d.deviceId}">${d.label||'Camera '+(i+1)}</option>`).join(''); }
      if (micSel) { micSel.innerHTML = mics.map((d,i)=>`<option value="${d.deviceId}">${d.label||'Microphone '+(i+1)}</option>`).join(''); }
    }

    async function tryOpen(constraints){
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (localVideo) { localVideo.srcObject = stream; localVideo.muted = true; await localVideo.play().catch(()=>{}); }
        onStream && onStream(stream);
        if (overlay) overlay.style.display='none';
        setDiag('');
        return stream;
      } catch (e) {
        setDiag(`${e.name||'Error'} — ${e.message||e}`);
        if (overlay) overlay.style.display='flex';
        return null;
      }
    }

    await populateSelects();
    if (autoStart) {
      await tryOpen({ video: !!video, audio: !!audio });
      await populateSelects();
    }

    if (enableBtn && !enableBtn._bound) {
      enableBtn._bound = true;
      enableBtn.addEventListener('click', async()=>{
        enableBtn.disabled = true;
        let s = await tryOpen({ video: !!video, audio: !!audio });
        if (!s) enableBtn.disabled = false;
      });
    }

    if (applyBtn && !applyBtn._bound) {
      applyBtn._bound = true;
      applyBtn.addEventListener('click', async()=>{
        const vId = camSel && camSel.value ? { deviceId: { exact: camSel.value } } : {};
        const aId = micSel && micSel.value ? { deviceId: { exact: micSel.value } } : {};
        await tryOpen({
          video: video ? { facingMode:'user', width:{ideal:1280}, height:{ideal:720}, ...vId } : false,
          audio: audio ? { ...audioConstraints(wantProcessing), ...aId } : false
        });
      });
    }

    return null;
  }
  return { ensureLocal };
})();
