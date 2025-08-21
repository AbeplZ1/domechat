
(function(){
  const adminModal = document.getElementById('adminModal');
  const adminBadge = document.getElementById('adminBadge');
  const toolbar = document.getElementById('adminToolbar');
  const loginBtn = document.getElementById('adminLogin');
  const cancelBtn = document.getElementById('adminCancel');
  const codeInput = document.getElementById('adminCode');
  let authed = false;

  function showAdminUI(){
    adminBadge.style.display = 'inline-block';
    toolbar.style.display = 'flex';
  }

  loginBtn.onclick = async ()=>{
    const code = codeInput.value.trim();
    if(!code) return;
    try{
      const res = await fetch('/api/admin/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) });
      const ok = res.ok;
      const j = await res.json().catch(()=>({}));
      if(ok && j && j.ok){
        authed = true;
        adminModal.style.display='none';
        showAdminUI();
      }else{
        alert('Invalid code');
      }
    }catch(e){ alert('Network error'); }
  };
  cancelBtn.onclick = ()=> adminModal.style.display='none';

  // Admin actions
  document.getElementById('adminStart').onclick = ()=> fetch('/api/admin/start', { method:'POST' });
  document.getElementById('adminShorten').onclick = ()=> fetch('/api/admin/timer', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ delta:-15 }) });
  document.getElementById('adminExtend').onclick = ()=> fetch('/api/admin/timer', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ delta:15 }) });
  document.getElementById('adminLock').onclick = ()=> fetch('/api/admin/lock', { method:'POST' });
  document.getElementById('adminSetSize').onclick = ()=>{
    const v = prompt('New room size (3–12)?','8');
    if(!v) return;
    fetch('/api/admin/size', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ size: Number(v) }) });
  };
  document.getElementById('adminAnnounce').onclick = ()=>{
    const msg = prompt('Admin announcement…','Be respectful or be removed.');
    if(!msg) return;
    fetch('/api/admin/announce', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: msg.slice(0,140) }) });
  };
  document.getElementById('adminKick').onclick = ()=>{
    const id = prompt('Enter player socket ID to kick (copy from admin list if you track it).');
    if(!id) return;
    fetch('/api/admin/kick', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
  };
})();
