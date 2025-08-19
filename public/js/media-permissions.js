
// Robust camera/microphone permission + diagnostics helper
// Usage:
// await MediaPerms.ensureLocal({
//   video: true, audio: true,
//   overlayIds: { overlay: 'camOverlay', enableBtn: 'enableCamBtn', diag: 'diag' },
//   localVideoId: 'localVideo',
//   onStream: (stream) => {},
//   wantProcessing: true // enables echoCancellation etc.
// });

window.MediaPerms = (function(){
  async function enumerateDiag() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter(d => d.kind === 'videoinput');
      const mics = list.filter(d => d.kind === 'audioinput');
      return { cams, mics, hasLabels: list.some(d => d.label) };
    } catch (e) { return { cams:[], mics:[], hasLabels:false, error:String(e) }; }
  }

  function prettyErr(e) {
    return `${e && e.name ? e.name : 'Error'} — ${e && e.message ? e.message : e}`;
  }

  function audioConstraints(wantProcessing){
    return wantProcessing ? {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    } : true;
  }

  async function ensureLocal(opts = {}) {
    const {
      video = true, audio = true, overlayIds = {}, localVideoId = 'localVideo',
      onStream = null, wantProcessing = true
    } = opts;

    const overlay = document.getElementById(overlayIds.overlay || 'camOverlay');
    const enableBtn = document.getElementById(overlayIds.enableBtn || 'enableCamBtn');
    const diagEl = document.getElementById(overlayIds.diag || 'diag');
    const localVideo = document.getElementById(localVideoId);
    const setDiag = (t) => { if (diagEl) diagEl.textContent = t || ''; };

    const baseConstraints = {
      video: video ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: audio ? audioConstraints(wantProcessing) : false
    };

    async function attempt(constraints){
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getAudioTracks().forEach(t => t.enabled = true); // mic on
        if (localVideo) { localVideo.srcObject = stream; localVideo.muted = true; await localVideo.play().catch(()=>{}); }
        if (overlay) overlay.style.display = 'none';
        setDiag('');
        if (onStream) onStream(stream);
        return stream;
      } catch (e) {
        const info = await enumerateDiag();
        let hint = prettyErr(e);
        if (e && e.name === 'NotFoundError') {
          hint += '\nNo input device found. Close Zoom/Discord, check OS privacy settings, and ensure a camera/mic exists.';
        } else if (e && e.name === 'NotAllowedError') {
          hint += '\nPermission denied. Click the lock icon → Allow Camera & Microphone, then Retry.';
        } else if (e && e.name === 'OverconstrainedError') {
          hint += '\nConstraints too strict; retrying with basic constraints…';
        }
        setDiag(hint + (info ? `\nDetected: ${info.cams.length} cameras, ${info.mics.length} mics` : ''));
        return null;
      }
    }

    // Bind once
    if (enableBtn && !enableBtn._bound) {
      enableBtn._bound = true;
      enableBtn.addEventListener('click', async () => {
        enableBtn.disabled = true;
        // First try base constraints
        let s = await attempt(baseConstraints);
        if (!s) {
          // Try with very basic constraints (video:true/audio:true) as a fallback
          s = await attempt({ video: !!video, audio: !!audio });
        }
        if (!s) enableBtn.disabled = false;
      });
    }

    if (overlay) overlay.style.display = 'flex';
    return null;
  }

  return { ensureLocal };
})();
