
(function(){
  // Admin modal (Ctrl+Shift+C)
  const tpl = `
  <div class="admin-modal" id="dcAdminModal" style="display:none;position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);align-items:center;justify-content:center">
    <div class="admin-card" style="background:linear-gradient(180deg,#141821,#10141b);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;max-width:520px;width:92%">
      <h3 style="margin:0 0 6px 0">DomeChat Admin</h3>
      <div id="dcAdminBadge" style="display:none;font-size:12px;opacity:.8;margin-bottom:8px">Admin unlocked</div>
      <div id="dcAdminAuth">
        <input id="dcAdminCode" placeholder="Admin code" type="password" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#0c1117;color:#fff;margin:8px 0"/>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="dcAdminCancel" class="ghost">Close</button>
          <button id="dcAdminLogin">Log in</button>
        </div>
      </div>
      <div id="dcAdminTools" style="display:none">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">
          <button id="dcConfetti">Confetti 🎉</button>
          <button id="dcReactLol">😂</button>
          <button id="dcReactLove">❤️</button>
          <button id="dcReactThumb">👍</button>
          <button id="dcToggleTheme">Theme: Black/Navy</button>
          <button id="dcSlowMode">Toggle Slow Mode</button>
          <button id="dcRemoveAds">Remove Ads (device)</button>
          <button id="dcRestoreAds" class="ghost">Restore Ads</button>
        </div>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', tpl);
  const modal = document.getElementById('dcAdminModal');
  const badge = document.getElementById('dcAdminBadge');
  const tools = document.getElementById('dcAdminTools');
  const auth = document.getElementById('dcAdminAuth');

  function openModal(){ modal.style.display='flex'; }
  function closeModal(){ modal.style.display='none'; }

  window.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==='c'){ openModal(); }
  });
  document.getElementById('dcAdminCancel').onclick = closeModal;

  document.getElementById('dcAdminLogin').onclick = async ()=>{
    const code = document.getElementById('dcAdminCode').value.trim();
    if(!code) return;
    const res = await fetch('/api/admin/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) });
    const ok = res.ok && (await res.json().catch(()=>({}))).ok;
    if(ok){ badge.style.display='block'; tools.style.display='block'; auth.style.display='none'; }
    else alert('Invalid code');
  };

  // Reactions overlay
  function spawnEmoji(emoji){
    const el = document.createElement('div');
    el.textContent = emoji;
    Object.assign(el.style, { position:'fixed', left: (Math.random()*80+10)+'vw', top: '110vh', fontSize:'36px', transition:'transform 2s ease, opacity 2s ease', zIndex: 999 });
    document.body.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.transform = 'translateY(-120vh)';
      el.style.opacity = '0';
    });
    setTimeout(()=> el.remove(), 2100);
  }
  document.getElementById('dcReactLol').onclick = ()=> spawnEmoji('😂');
  document.getElementById('dcReactLove').onclick = ()=> spawnEmoji('❤️');
  document.getElementById('dcReactThumb').onclick = ()=> spawnEmoji('👍');

  // Confetti (simple CSS burst)
  document.getElementById('dcConfetti').onclick = ()=>{
    for(let i=0;i<80;i++){ setTimeout(()=> spawnEmoji('🎉'), i*8); }
  };

  // Theme toggle
  document.getElementById('dcToggleTheme').onclick = ()=>{
    const r = document.documentElement;
    const current = getComputedStyle(r).getPropertyValue('--bg').trim();
    if(current === '#0a0c0f'){
      r.style.setProperty('--bg', '#0b1020'); // navy
      r.style.setProperty('--panel', '#10182a');
      r.style.setProperty('--panel-2', '#0d1526');
      r.style.setProperty('--accent', '#8db2ff');
    }else{
      r.style.setProperty('--bg', '#0a0c0f'); // black
      r.style.setProperty('--panel', '#10131a');
      r.style.setProperty('--panel-2', '#0d1016');
      r.style.setProperty('--accent', '#8db2ff');
    }
  };

  // Slow mode (client-side basic 1 msg / 2s)
  let slow = false, lastSend = 0;
  document.getElementById('dcSlowMode').onclick = ()=>{
    slow = !slow;
    alert('Slow mode ' + (slow?'ON (2s)':'OFF'));
  };
  const sendBtn = document.getElementById('sendBtn');
  const msgInput = document.getElementById('messageInput');
  if(sendBtn){
    const orig = sendBtn.onclick;
    sendBtn.onclick = function(){
      const now = Date.now();
      if(slow && (now - lastSend) < 2000){ return; }
      lastSend = now;
      orig && orig.apply(this, arguments);
    };
  }

  // Ads control
  document.getElementById('dcRemoveAds').onclick = async ()=>{
    await fetch('/api/admin/ads/remove', { method:'POST' });
    alert('Ads disabled on this device.');
  };
  document.getElementById('dcRestoreAds').onclick = async ()=>{
    await fetch('/api/admin/ads/restore', { method:'POST' });
    alert('Ads restored on this device.');
  };
})();
