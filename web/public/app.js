const API = 'https://api-production-5bddb.up.railway.app';

let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let mode = 'login';

function toast(t) {
  const el = document.getElementById('toast');
  el.textContent = t;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function initials(n) { return (n || '?').slice(0, 2).toUpperCase(); }

document.getElementById('forgotOpenBtn')?.addEventListener('click',()=>{document.getElementById('authScreen')?.classList.remove('show');document.getElementById('forgotScreen')?.classList.add('show');});
document.getElementById('forgotBtn')?.addEventListener('click',async()=>{
 const msg=document.getElementById('forgotMsg'), username=document.getElementById('forgotUsername')?.value.trim(), discord_id=document.getElementById('forgotDiscord')?.value.trim();
 msg.className='msg show';msg.textContent='جاري التحقق...';
 try{const r=await fetch(API+'/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,discord_id})});const d=await r.json();if(!r.ok)throw new Error(d.error||'تعذر الاسترجاع');msg.className='msg show success';msg.textContent=d.message||'تم الإرسال ✓';}
 catch(e){msg.className='msg show error';msg.textContent=e.message;}
});
document.getElementById('verifyDiscordBtn')?.addEventListener('click', async () => {
  const id = document.getElementById('discord_id').value.trim();
  const msg = document.getElementById('authMsg');
  if (!id) { msg.className='msg show error'; msg.textContent='اكتب Discord ID أولاً'; return; }
  msg.className='msg show'; msg.textContent='جاري إرسال كود التحقق...';
  try {
    const r=await fetch(API + '/api/auth/verify-discord',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({discord_id:id})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'تعذر التحقق');
    document.getElementById('verification_code').style.display='block';
    msg.className='msg show success'; msg.textContent='تم إرسال الكود لخاصك في ديسكورد ✓';
  } catch(e) { msg.className='msg show error'; msg.textContent=e.message; }
});

document.querySelectorAll('.tabs button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.tab;
    document.getElementById('discordField').style.display = mode === 'register' ? 'block' : 'none';
    if (mode === 'login') { const code=document.getElementById('verification_code'); if(code) code.style.display='none'; }
    document.getElementById('submitBtn').textContent = mode === 'register' ? 'تسجيل' : 'دخول';
  };
});

document.getElementById('authForm').onsubmit = async (e) => {
  e.preventDefault();
  const msg = document.getElementById('authMsg');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const discord_id = document.getElementById('discord_id').value.trim();
  const verification_code = document.getElementById('verification_code')?.value.trim() || '';
  msg.className = 'msg show';
  msg.textContent = 'جاري...';

  try {
    const r = await fetch(API + '/api/auth/' + mode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, discord_id, verification_code })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'خطأ');

    localStorage.setItem('token', d.token);
    localStorage.setItem('user', JSON.stringify(d.user));
    location.reload();
  } catch (err) {
    msg.className = 'msg show error';
    msg.textContent = err.message;
  }
};

async function api(path, opts = {}) {
  const url = /^https?:\/\//.test(path) ? path : API + (path.startsWith('/') ? path : '/' + path);
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      ...(opts.headers || {})
    }
  });
  return r.json();
}

async function initApp() {
  // Always refresh the account from the API so owner/admin permissions are never stale.
  if (token) {
    try {
      const me = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      if (me.ok) { const md = await me.json(); if (md.user) { user = md.user; localStorage.setItem('user', JSON.stringify(user)); } }
      else { localStorage.removeItem('token'); localStorage.removeItem('user'); token = null; user = null; }
    } catch (_) {}
  }
  const loginBtn = document.getElementById('loginBtn');
  const topLoginBtn = document.getElementById('topLoginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authScreen = document.getElementById('authScreen');
  const openLogin = () => authScreen?.classList.add('show');
  loginBtn?.addEventListener('click', openLogin);
  topLoginBtn?.addEventListener('click', openLogin);
  if (!token || !user) {
    document.body.classList.remove('logged');
    document.body.classList.add('guest');
    if (loginBtn) loginBtn.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (topLoginBtn) topLoginBtn.style.display = 'block';
    document.getElementById('myName').textContent = 'زائر';
    document.getElementById('myRole').textContent = 'تصفح عام';
    document.getElementById('myAvatar').textContent = 'ز';
    return;
  }
  document.body.classList.add('logged');
  document.body.classList.remove('guest');
  if (loginBtn) loginBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'flex';
  if (topLoginBtn) topLoginBtn.style.display = 'none';

  document.getElementById('myName').textContent = user.username;
  document.getElementById('myRole').textContent = user.is_owner ? 'الأونر 👑' : (String(user.role||'').toLowerCase()==='admin' ? 'إدارة 🛡️' : 'عضو');

  const av = document.getElementById('myAvatar');
  if (user.avatar) av.innerHTML = `<img src="${esc(user.avatar)}">`;
  else av.textContent = initials(user.username);

  if (user.is_owner || ['admin','owner'].includes(String(user.role||'').toLowerCase())) {
    document.getElementById('adminLink').style.display = 'flex'; document.getElementById('adminSection').style.display = 'block'; document.getElementById('ownerSection').style.display = user.is_owner ? 'block' : 'none'; if(user.is_owner){ document.getElementById('ownerLink').style.display='flex'; }
  }


  document.getElementById('profileName').value = user.username || '';
  document.getElementById('profileBio').value = user.bio || '';

  syncPrivilegedMenu();
  loadBots();
}

document.querySelectorAll('.sidebar .nav a[data-page]').forEach(a => {
  a.onclick = (e) => {
    const page = a.dataset.page;
    const protectedPages = ['chat','pigeon','tickets','applications','bots','addbot','add-bot','profile'];
    if(page==='applications' && !user?.is_owner){ e.preventDefault(); toast('التقديم وإدارته للأونر فقط'); closeSidebar(); return; }
    if (protectedPages.includes(page) && (!token || !user)) {
      e.preventDefault();
      toast('سجّل دخول أولاً');
      document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('appMenuBackdrop')?.classList.remove('show'); document.body.classList.remove('app-menu-open'); document.getElementById('appMenuBackdrop')?.classList.remove('show'); document.body.classList.remove('app-menu-open'); document.body.classList.remove('app-menu-open'); document.getElementById('appMenuBackdrop')?.classList.remove('show');
      return;
    }
    if (featurePages.includes(page) || page==='admin' || page==='owner-admin') {
      e.preventDefault();
      renderFeature(page);
      return;
    }
    if (page === 'bots' || page === 'addbot' || page === 'add-bot') {
      e.preventDefault();
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.sidebar .nav a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      document.getElementById('page-' + page)?.classList.add('active');
      document.getElementById('pageTitle').textContent = a.textContent.trim();
      document.getElementById('sidebar')?.classList.remove('open');
      if (page === 'bots' || page === 'addbot' || page === 'add-bot') loadBots();
      return;
    }
    if (page === 'admin' || page === 'owner-admin') {
      e.preventDefault();
      if (page === 'owner-admin' && !user?.is_owner) { toast('هذه الصفحة للأونر فقط'); return; }
      if (!user?.is_owner && !['admin','owner'].includes(String(user?.role||'').toLowerCase())) { toast('هذه الصفحة للإدارة فقط'); return; }
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.sidebar .nav a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      document.getElementById('page-admin')?.classList.add('active');
      document.getElementById('pageTitle').textContent = a.textContent.trim();
      document.getElementById('sidebar')?.classList.remove('open');
      loadAdmin();
    }
  };
});

function closeSidebar(){
  const sidebar=document.getElementById('sidebar');
  const back=document.getElementById('appMenuBackdrop');
  sidebar?.classList.remove('open');
  back?.classList.remove('show');
  document.body.classList.remove('app-menu-open');
  document.getElementById('menuBtn')?.setAttribute('aria-expanded','false');
}
function toggleSidebar(e){
  e?.preventDefault(); e?.stopPropagation();
  const sidebar=document.getElementById('sidebar');
  const back=document.getElementById('appMenuBackdrop');
  if(!sidebar)return;
  const open=!sidebar.classList.contains('open');
  sidebar.classList.toggle('open',open);
  back?.classList.toggle('show',open);
  document.body.classList.toggle('app-menu-open',open);
  document.getElementById('menuBtn')?.setAttribute('aria-expanded',String(open));
}
document.getElementById('menuBtn')?.addEventListener('click',toggleSidebar);
document.getElementById('appMenuBackdrop')?.addEventListener('click',closeSidebar);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar();});
window.addEventListener('resize',()=>{if(innerWidth>900)closeSidebar();});
document.getElementById('logoutBtn')?.addEventListener('click',e=>{e.preventDefault();localStorage.removeItem('token');localStorage.removeItem('user');token=null;user=null;location.hash='home';location.reload();});

async function loadBots() {
  const d = await api('/api/bots');
  const list = document.getElementById('botsList');
  if (!d.bots || !d.bots.length) {
    list.innerHTML = '<p style="color:var(--muted)">ما عندك بوتات بعد.</p>';
    return;
  }
  list.innerHTML = d.bots.map(b => `
    <div class="bot-card">
      <h4>🤖 ${esc(b.name)}</h4>
      <p>السيرفر: ${esc(b.guild_id || '—')}</p>
      <p>الحالة: ${b.active ? '<span style="color:#70f5b1">● نشط</span>' : '<span style="color:#ff8a8d">● متوقف</span>'}</p>
      <button onclick="toggleBot('${b.id}')" style="padding:8px 14px;border:0;border-radius:10px;background:var(--accent);color:#241329;font-weight:700;cursor:pointer;margin-top:8px">
        ${b.active ? 'إيقاف' : 'تشغيل'}
      </button>
    </div>
  `).join('');
}

document.getElementById('createBotBtn').onclick = async () => {
  const msg = document.getElementById('botMsg');
  const name = document.getElementById('botName').value.trim();
  const token_ = document.getElementById('botToken').value.trim();
  const guild_id = document.getElementById('botGuild').value.trim();

  msg.className = 'msg show';
  msg.textContent = 'جاري...';

  const d = await api('/api/bots', {
    method: 'POST',
    body: JSON.stringify({ name, token: token_, guild_id })
  });

  if (d.error) {
    msg.className = 'msg show error';
    msg.textContent = d.error;
    return;
  }
  msg.className = 'msg show success';
  msg.textContent = 'تم ✓';
  document.getElementById('botName').value = '';
  document.getElementById('botToken').value = '';
  document.getElementById('botGuild').value = '';
  setTimeout(() => loadBots(), 500);
};

document.getElementById('saveProfileBtn').onclick = async () => {
  const username = document.getElementById('profileName').value.trim();
  const bio = document.getElementById('profileBio').value.trim();
  const d = await api('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ username, bio })
  });
  if (d.error) return toast(d.error);
  localStorage.setItem('user', JSON.stringify(d.user));
  user = d.user;
  toast('تم الحفظ ✓');
};

async function loadAdmin() {
  const d = await api('/api/users');
  const list = document.getElementById('ownerUsers');
  if (list && d.users) {
    list.innerHTML = d.users.map(u => `
      <div class="bot-card"><h4>${esc(u.username)}</h4><p>${u.is_owner ? '👑 أونر' : (u.role === 'admin' ? '🛡️ إدارة' : 'عضو')}</p>
      ${user?.is_owner && !u.is_owner ? `<button onclick="setAdmin('${u.id}','${u.role==='admin'?'remove':'add'}')" class="btn-primary">${u.role==='admin'?'إزالة الإدارة':'إضافة للإدارة'}</button>` : ''}</div>`).join('');
  }

  const adminTickets=document.getElementById('adminTickets');
  if(adminTickets){
    const td=await api('/api/community/tickets');
    adminTickets.innerHTML='<h3>🎫 التذاكر</h3>'+(td.tickets||[]).map(t=>`
      <div class="bot-card"><b>#${t.id} · ${esc(t.subject)}</b><p>${esc(t.status)} · claimed: ${esc(t.claimed_by||'—')}</p>
      <button class="btn-primary" onclick="claimTicket('${t.id}')">استلام</button>
      ${t.status!=='closed'?'<button class="btn-primary" onclick="closeTicket(\''+t.id+'\')">إغلاق</button>':''}</div>`).join('')||'<p>لا توجد تذاكر.</p>';
  }

  if(user?.is_owner){
    const [ad,gd]=await Promise.all([api('/api/community/applications'),api('/api/community/groups')]);
    const apps=document.getElementById('ownerApplications');
    if(apps) apps.innerHTML='<h3>📝 التقديم</h3>'+(ad.applications||[]).map(a=>`
      <div class="bot-card"><b>#${a.id}</b><p>${esc(a.status)} · Discord: ${esc(a.discord_id||'—')}</p>
      <button class="btn-primary" onclick="applicationStatus('${a.id}','accepted')">قبول</button>
      <button class="btn-primary" onclick="applicationStatus('${a.id}','rejected')">رفض</button></div>`).join('')||'<p>لا توجد طلبات.</p>';
    const allGroups=await api('/api/community/groups/all');
    const groups=allGroups.groups||gd.groups||[];
    const ge=document.getElementById('ownerGroups');
    if(ge) ge.innerHTML='<h3>👨‍👩‍👧 القروبات</h3>'+(groups||[]).map(g=>`
      <div class="bot-card"><b>#${g.id} · ${esc(g.name)}</b><p>${esc(g.status)}</p>
      ${g.status==='pending'?'<button class="btn-primary" onclick="groupStatus(\''+g.id+'\',\'approved\')">اعتماد</button>':''}</div>`).join('')||'<p>لا توجد طلبات قروبات.</p>';
    const al=await api('/api/community/audit');
    const ae=document.getElementById('ownerAudit');
    if(ae) ae.innerHTML='<h3>📋 السجل</h3>'+(al.logs||[]).map(x=>`<div class="bot-card"><b>${esc(x.action)}</b><p>${esc(x.actor_name||'')} · ${esc(x.target||'')}</p></div>`).join('')||'<p>لا يوجد سجل.</p>';
  }
}


window.setAdmin = async (id, action) => { const d=await api('/api/users/'+id+'/admin',{method:'POST',body:JSON.stringify({action})}); toast(d.message||d.error); loadAdmin(); };
window.claimTicket = async id => { const d=await api('/api/community/tickets/'+id+'/claim',{method:'POST'}); toast(d.error||'تم استلام التذكرة'); loadAdmin(); };
window.closeTicket = async id => { const d=await api('/api/community/tickets/'+id+'/close',{method:'POST'}); toast(d.error||'تم إغلاق التذكرة'); loadAdmin(); };
window.applicationStatus = async (id,status) => { const d=await api('/api/community/applications/'+id+'/status',{method:'POST',body:JSON.stringify({status})}); toast(d.error||'تم التحديث'); loadAdmin(); };
window.groupStatus = async (id,status) => { const d=await api('/api/community/groups/'+id+'/status',{method:'POST',body:JSON.stringify({status})}); toast(d.error||'تم التحديث'); loadAdmin(); };

window.banUser = async (id) => {
  const d = await api('/api/users/' + id + '/ban', { method: 'POST' });
  toast(d.message || d.error);
  loadAdmin();
};

window.toggleBot = async (id) => {
  const d = await api('/api/bots/' + id + '/toggle', { method: 'POST' });
  toast(d.message || d.error);
  loadBots();
};

function openRequestedHash(){ const p=(location.hash||'#home').slice(1).trim(); if(!p||p==='home') return; const protectedPages=['chat','pigeon','tickets','applications','bots','addbot','add-bot','profile','admin','owner','owner-admin']; if(protectedPages.includes(p)&&(!token||!user)){ document.getElementById('authScreen')?.classList.add('show'); toast('هذه الصفحة تتطلب تسجيل الدخول'); return; } const link=document.querySelector('.sidebar .nav a[data-page="'+p+'"]'); if(link) link.click(); }
window.addEventListener('hashchange',openRequestedHash);
initApp().then(()=>setTimeout(openRequestedHash,0));

/* ===== MLD community feature bridge ===== */
const featurePages = ['members','top','leaders','chat','pigeon','games','cinema','groups','tickets','applications','reviews','profile'];
const pageTitles = {members:'👥 الأعضاء',top:'🏆 التوب',leaders:'👑 الرتب القيادية',chat:'💬 الشات العام',pigeon:'✉️ الزاجل',games:'🎮 الألعاب',cinema:'🎬 السينما',groups:'👨‍👩‍👧 القروبات',tickets:'🎫 التذاكر',applications:'📝 التقديم',reviews:'⭐ الآراء'};
function featureProtected(p){ return ['chat','pigeon','tickets','bots','addbot','add-bot','profile'].includes(p); }
function requireFeatureAuth(){ if(!token||!user){ toast('سجّل دخول أولاً'); document.getElementById('authScreen')?.classList.add('show'); return false; } return true; }
function pageBox(p,body){ const el=document.getElementById('page-'+p); if(el) el.innerHTML='<div class="card">'+body+'</div>'; }
async function renderFeature(p){
  if(featureProtected(p)&&!requireFeatureAuth()) return;
  const page=document.getElementById('page-'+p); if(!page)return;
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active')); page.classList.add('active');
  document.querySelectorAll('.sidebar .nav a').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
  document.getElementById('pageTitle').textContent=pageTitles[p]||p;
  document.getElementById('sidebar').classList.remove('open');
  if(p==='games'){ pageBox(p,'<div class="mld-page-shell"><div class="mld-page-head"><span class="mld-kicker">🎮 MLD GAMES</span><h1>الألعاب</h1><p>اختر اللعبة وابدأ الجلسة بدون مغادرة منصة MLD.</p></div><div class="mld-page-body"><div id="gameCatalog" class="page-grid three"><div class="panel"><h3>🎴 أونو</h3><p class="muted">لعبة جماعية.</p><button class="btn-primary" onclick="openMLDGame(\'uno\')">ابدأ</button></div><div class="panel"><h3>🎯 لودو</h3><p class="muted">جلسة لودو.</p><button class="btn-primary" onclick="openMLDGame(\'ludo\')">ابدأ</button></div><div class="panel"><h3>🕵️ كود نيمز</h3><p class="muted">تحدي الفرق.</p><button class="btn-primary" onclick="openMLDGame(\'codenames\')">ابدأ</button></div><div class="panel"><h3>🎲 جاكارو</h3><p class="muted">لعبة جماعية.</p><button class="btn-primary" onclick="openMLDGame(\'jaccaro\')">ابدأ</button></div><div class="panel"><h3>♠️ بلوت</h3><p class="muted">جلسة بلوت.</p><button class="btn-primary" onclick="openMLDGame(\'baloot\')">ابدأ</button></div><div class="panel"><h3>🏠 مونوبولي</h3><p class="muted">جلسة مونوبولي.</p><button class="btn-primary" onclick="openMLDGame(\'monopoly\')">ابدأ</button></div></div><div id="embeddedGame" style="display:none;margin-top:18px"></div></div></div>'); return; }
  if(p==='members'||p==='top'||p==='leaders'){
    const endpoint=p==='members'?'/api/public/members':p==='top'?'/api/public/top':'/api/public/roles';
    try{const d=await fetch(API + endpoint).then(r=>r.json()); pageBox(p,p==='members'?'<h3>👥 الأعضاء</h3><div class="grid">'+(d.members||[]).map(m=>'<div class="bot-card"><h4>'+esc(m.name)+'</h4><p>@'+esc(m.username||'')+'</p></div>').join('')+'</div>':p==='top'?'<h3>🏆 التوب</h3><pre style="white-space:pre-wrap;color:var(--muted)">'+esc(JSON.stringify(d,null,2))+'</pre>':'<h3>👑 الرتب القيادية</h3><div class="grid">'+(d.roles||[]).map(r=>'<div class="bot-card"><h4>'+esc(r.name)+'</h4><p>'+esc(r.membersCount)+' عضو</p></div>').join('')+'</div>');}catch(e){pageBox(p,'<h3>تعذر تحميل البيانات</h3>');} return;
  }
  if(p==='chat'){pageBox(p,'<h3>💬 الشات العام</h3><div id="feature-chat"></div><input id="chat-input" class="full" placeholder="اكتب رسالتك..."><button class="btn-primary" id="chat-send">إرسال</button>'); loadFeatureChat(); return;}
  if(p==='reviews'){pageBox(p,'<h3>⭐ الآراء</h3><div id="reviews-list">جاري التحميل...</div><textarea id="review-input" class="full" placeholder="اكتب رأيك"></textarea><button class="btn-primary" id="review-send">إضافة رأي</button>'); loadReviews(); return;}
  if(p==='tickets'){pageBox(p,'<h3>🎫 التذاكر</h3><input id="ticket-subject" class="full" placeholder="عنوان التذكرة"><textarea id="ticket-content" class="full" placeholder="اشرح مشكلتك"></textarea><button class="btn-primary" id="ticket-send">فتح تذكرة</button><div id="tickets-list"></div>'); document.getElementById('ticket-send').onclick=async()=>{const d=await api('/api/community/tickets',{method:'POST',body:JSON.stringify({subject:document.getElementById('ticket-subject').value,content:document.getElementById('ticket-content').value})});toast(d.error||'تم فتح التذكرة ✓');loadTickets();};loadTickets();return;}
  if(p==='applications'){pageBox(p,'<h3>📝 التقديم</h3><input id="app-discord" class="full" placeholder="Discord ID"><textarea id="app-answers" class="full" placeholder="اكتب إجاباتك"></textarea><button class="btn-primary" id="app-send">إرسال التقديم</button><div id="apps-list"></div>');document.getElementById('app-send').onclick=async()=>{const d=await api('/api/community/applications',{method:'POST',body:JSON.stringify({discord_id:document.getElementById('app-discord').value,answers:{text:document.getElementById('app-answers').value}})});toast(d.error||'تم إرسال التقديم ✓');loadApps();};loadApps();return;}
  if(p==='groups'){pageBox(p,'<h3>👨‍👩‍👧 القروبات</h3><div id="groups-list">جاري...</div><input id="group-name" class="full" placeholder="اسم القروب"><textarea id="group-desc" class="full" placeholder="الوصف"></textarea><button class="btn-primary" id="group-send">إنشاء قروب</button>');loadGroups();document.getElementById('group-send').onclick=async()=>{if(!requireFeatureAuth())return;const d=await api('/api/community/groups',{method:'POST',body:JSON.stringify({name:document.getElementById('group-name').value,description:document.getElementById('group-desc').value})});toast(d.error||'تم إرسال طلب القروب ✓');loadGroups();};return;}
  if(p==='pigeon'){pageBox(p,'<h3>✉️ الزاجل</h3><input id="pigeon-recipient" class="full" placeholder="ID المستلم"><textarea id="pigeon-text" class="full" placeholder="الرسالة"></textarea><button class="btn-primary" id="pigeon-send">إرسال</button><div id="pigeon-list"></div>');document.getElementById('pigeon-send').onclick=async()=>{const d=await api('/api/community/pigeon',{method:'POST',body:JSON.stringify({recipient_id:document.getElementById('pigeon-recipient').value,content:document.getElementById('pigeon-text').value})});toast(d.error||'تم الإرسال ✓');loadPigeon();};loadPigeon();return;}
  if(p==='cinema'){pageBox(p,'<h3>🎬 السينما</h3><div id="cinema-list">جاري...</div><input id="cinema-title" class="full" placeholder="اسم العرض"><input id="cinema-url" class="full" placeholder="رابط المحتوى المصرح لك باستخدامه"><button class="btn-primary" id="cinema-send">إنشاء غرفة</button>');loadCinema();document.getElementById('cinema-send').onclick=async()=>{if(!requireFeatureAuth())return;const d=await api('/api/community/cinema',{method:'POST',body:JSON.stringify({title:document.getElementById('cinema-title').value,media_url:document.getElementById('cinema-url').value})});toast(d.error||'تم إنشاء الغرفة ✓');loadCinema();};return;}
}
async function loadFeatureChat(){const d=await api('/api/community/chat');const e=document.getElementById('feature-chat');if(e)e.innerHTML=(d.messages||[]).map(m=>'<div class="bot-card"><b>'+esc(m.sender_name)+'</b><p>'+esc(m.content)+'</p></div>').join('')||'<p>لا توجد رسائل.</p>';const b=document.getElementById('chat-send');if(b)b.onclick=async()=>{const i=document.getElementById('chat-input');const d=await api('/api/community/chat',{method:'POST',body:JSON.stringify({content:i.value})});if(d.error)return toast(d.error);i.value='';loadFeatureChat();};}
async function loadReviews(){const d=await fetch(API + '/api/community/reviews').then(r=>r.json());const e=document.getElementById('reviews-list');if(e)e.innerHTML=(d.reviews||[]).map(x=>'<div class="bot-card"><b>'+esc(x.username)+'</b><p>'+esc(x.content)+'</p><small>★ '+x.rating+'</small></div>').join('')||'<p>لا توجد آراء.</p>';const b=document.getElementById('review-send');if(b)b.onclick=async()=>{const i=document.getElementById('review-input');const d=await api('/api/community/reviews',{method:'POST',body:JSON.stringify({content:i.value,rating:5})});toast(d.error||'تمت الإضافة ✓');i.value='';loadReviews();};}
async function loadTickets(){const d=await api('/api/community/tickets');const e=document.getElementById('tickets-list');if(e)e.innerHTML=(d.tickets||[]).map(x=>'<div class="bot-card"><b>#'+x.id+' '+esc(x.subject)+'</b><p>'+esc(x.status)+'</p></div>').join('');}
async function loadApps(){const d=await api('/api/community/applications');const e=document.getElementById('apps-list');if(e)e.innerHTML=(d.applications||[]).map(x=>'<div class="bot-card"><b>#'+x.id+'</b><p>'+esc(x.status)+'</p></div>').join('');}
async function loadGroups(){const d=await fetch(API + '/api/community/groups').then(r=>r.json());const e=document.getElementById('groups-list');if(e)e.innerHTML=(d.groups||[]).map(x=>'<div class="bot-card"><b>'+esc(x.name)+'</b><p>'+esc(x.description||'')+'</p><button class="btn-primary" onclick="joinGroup('+x.id+')">انضمام</button></div>').join('')||'<p>لا توجد قروبات.</p>';}
window.joinGroup=async id=>{if(!requireFeatureAuth())return;const d=await api('/api/community/groups/'+id+'/join',{method:'POST'});toast(d.error||d.message);};
async function loadPigeon(){const d=await api('/api/community/pigeon');const e=document.getElementById('pigeon-list');if(e)e.innerHTML=(d.messages||[]).map(x=>'<div class="bot-card"><p>'+esc(x.content)+'</p></div>').join('');}
async function loadCinema(){
  const d=await fetch(API + '/api/community/cinema').then(r=>r.json()); const e=document.getElementById('cinema-list'); if(!e)return;
  e.innerHTML=(d.rooms||[]).map(x=>`<div class="bot-card"><b>${esc(x.title)}</b><p>${esc(x.status)}</p><video id="cinema-video-${x.id}" controls playsinline style="width:100%;max-height:420px;border-radius:14px;background:#000" src="${esc(x.media_url)}"></video><div style="display:flex;gap:8px;margin-top:10px"><button class="btn-primary" onclick="joinCinema(${x.id})">🎬 دخول ومزامنة</button></div></div>`).join('')||'<p>لا توجد غرف.</p>';
}
window.joinCinema=(id)=>{
  const v=document.getElementById('cinema-video-'+id); if(!v || !window.io)return toast('تعذر تشغيل السينما');
  const s=window.__cinemaSocket || (window.__cinemaSocket=io(API,{auth:{token}})); s.emit('cinema:join',{roomId:id});
  s.off('cinema:state'); s.on('cinema:state',data=>{ if(data.roomId!==id)return; if(Math.abs(v.currentTime-data.playbackTime)>1)v.currentTime=data.playbackTime; if(data.isPlaying && v.paused)v.play().catch(()=>{}); if(!data.isPlaying&&!v.paused)v.pause(); });
  v.onplay=()=>s.emit('cinema:sync',{roomId:id,type:'play',time:v.currentTime});
  v.onpause=()=>s.emit('cinema:sync',{roomId:id,type:'pause',time:v.currentTime});
  v.onseeked=()=>s.emit('cinema:sync',{roomId:id,type:'seek',time:v.currentTime});
};


/* ===== Discord autocomplete suggestions ===== */
(function bindDiscordSuggestions(){
  function setup(inputId, type, listId){
    const input=document.getElementById(inputId);
    if(!input)return;
    let list=document.getElementById(listId);
    if(!list){list=document.createElement('datalist');list.id=listId;document.body.appendChild(list);}
    input.setAttribute('list',listId);
    let timer;
    input.addEventListener('input',()=>{
      clearTimeout(timer);
      const q=input.value.trim();
      if(q.length<1){list.innerHTML='';return;}
      timer=setTimeout(async()=>{
        try{
          const d=await fetch(API + '/api/public/suggestions?type='+encodeURIComponent(type)+'&q='+encodeURIComponent(q)).then(r=>r.json());
          list.innerHTML=(d.suggestions||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name||x.username||'')+'</option>').join('');
        }catch(e){}
      },180);
    });
  }
  setup('discord_id','members','discord-members-suggestions');
  setup('botGuild','servers','discord-server-suggestions');
})();

/* MLD responsive navigation safety */
window.addEventListener('resize',()=>{
  if(innerWidth>820){
    document.getElementById('sidebar')?.classList.remove('open');
    document.body.classList.remove('app-menu-open');
    document.getElementById('appMenuBackdrop')?.classList.remove('show');
  }
});
/* Explicit owner/admin visibility */
function syncPrivilegedMenu(){
 const owner=!!user?.is_owner;
 const admin=owner||String(user?.role||'').toLowerCase()==='admin';
 const al=document.getElementById('adminLink'), ol=document.getElementById('ownerLink'), as=document.getElementById('adminSection'), os=document.getElementById('ownerSection'), apl=document.getElementById('applicationsLink');
 if(al) al.style.display=admin?'flex':'none'; if(as) as.style.display=admin?'block':'none';
 if(ol) ol.style.display=owner?'flex':'none'; if(os) os.style.display=owner?'block':'none'; if(login) login.style.display=token?'none':'flex'; if(logout) logout.style.display=token?'flex':'none'; if(profile) profile.style.display=token?'flex':'none'; if(appLink) appLink.style.display=owner?'flex':'none'; if(apl) apl.style.display=owner?'flex':'none';
 document.body.classList.toggle('is-owner',owner); document.body.classList.toggle('is-admin',admin);
}
setTimeout(syncPrivilegedMenu,0);
window.addEventListener('storage',syncPrivilegedMenu);


/* ===== MLD FINAL PAGE SYSTEM v20261004 ===== */
const PAGE_META={home:['🏠','الرئيسية','لوحة مجتمع MLD'],members:['👥','الأعضاء','أعضاء مجتمع MLD والبحث المباشر'],top:['🏆','التوب','ترتيب النشاط والإحصائيات'],leaders:['👑','الرتب القيادية','الرتب المهمة وأعضاؤها'],chat:['💬','الشات العام','محادثة مجتمع MLD'],pigeon:['✉️','الزاجل','رسائلك الخاصة'],games:['🎮','الألعاب','جلسات اللعب والمتفرجين'],cinema:['🎬','السينما','غرف المشاهدة الجماعية'],groups:['👨‍👩‍👧','القروبات','مجتمعات MLD الصغيرة'],tickets:['🎫','التذاكر','الدعم والمتابعة'],applications:['📝','التقديم','طلبات الإدارة'],reviews:['⭐','الآراء','آراء أعضاء المجتمع'],bots:['🤖','منصة البوتات','إدارة بوتاتك'],addbot:['➕','إضافة بوت','ربط وإدارة بوت جديد'],profile:['👤','بروفايلي','بيانات حسابك'],admin:['🛡️','لوحة الإدارة','إدارة التذاكر والحسابات'],owner:['👑','لوحة الأونر','التحكم الكامل بالمنصة'],'owner-admin':['👑','لوحة الأونر','التحكم الكامل بالمنصة']};
const PROTECTED=['chat','pigeon','tickets','applications','bots','addbot','profile','admin','owner','owner-admin'];
const isAdmin=()=>!!user&&(!!user.is_owner||['admin','owner'].includes(String(user.role||'').toLowerCase()));
const isOwner=()=>!!user?.is_owner;
function shell(p,body){const m=PAGE_META[p]||['✦',p,''];return '<section class="mld-page-shell"><header class="mld-page-head"><span class="mld-kicker">'+m[0]+' MLD COMMUNITY</span><h1>'+m[1]+'</h1><p>'+m[2]+'</p></header><div class="mld-page-body">'+body+'</div></section>'}
function card(title,body){return '<section class="mld-panel"><h3>'+title+'</h3>'+body+'</section>'}
function activate(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));const el=document.getElementById('page-'+(p==='owner-admin'?'owner-admin':p));if(el)el.classList.add('active');document.querySelectorAll('.sidebar .nav a[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));const t=document.getElementById('pageTitle');if(t)t.textContent=(PAGE_META[p]||['',p])[1];closeAppMenu();}
function closeAppMenu(){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('appMenuBackdrop')?.classList.remove('show');document.body.classList.remove('app-menu-open');}
function openAppMenu(){document.getElementById('sidebar')?.classList.add('open');document.getElementById('appMenuBackdrop')?.classList.add('show');document.body.classList.add('app-menu-open');}
function protect(p){if(!token||!user){toast('هذه الصفحة تتطلب تسجيل الدخول');document.getElementById('authScreen')?.classList.add('show');return false;}if(p==='applications'&&!isOwner()){toast('التقديم متاح للأونر فقط');return false;}if((p==='owner'||p==='owner-admin')&&!isOwner()){toast('لوحة الأونر للأونر فقط');return false;}if(p==='admin'&&!isAdmin()){toast('لوحة الإدارة للإدارة فقط');return false;}return true;}
async function renderPage(p){
 if(PROTECTED.includes(p)&&!protect(p))return;
 if(['members','top','leaders','chat','pigeon','games','cinema','groups','tickets','applications','reviews','bots','addbot','profile','admin','owner'].includes(p))activate(p);else if(p==='home'){activate('home');return;}
 const pageKey=p==='owner-admin'?'owner-admin':p; const el=document.getElementById('page-'+pageKey);if(!el)return;
 el.innerHTML=shell(p,'<div class="mld-loading">جاري تحميل الصفحة...</div>');
 try{
  if(p==='members'){const d=await fetch(API+'/api/public/members',{cache:'no-store'}).then(r=>r.json());el.innerHTML=shell(p,'<div class="mld-toolbar"><input id="memberSearch" class="full" placeholder="ابحث باسم العضو أو المعرف"><b>'+((d.members||[]).length)+' عضو</b></div><div class="mld-member-grid">'+(d.members||[]).map(m=>'<article class="mld-member"><img src="'+esc(m.avatar||'/logo.svg')+'"><span><b>'+esc(m.name)+'</b><small>@'+esc(m.username||'')+'</small><em>'+esc((m.importantRoles||[]).map(x=>x.name).join(' · ')||'عضو')+'</em></span></article>').join('')+'</div>');el.querySelector('#memberSearch').oninput=async e=>{const q=e.target.value.trim();const d=await fetch(API+'/api/public/members?q='+encodeURIComponent(q),{cache:'no-store'}).then(r=>r.json());el.querySelector('.mld-member-grid').innerHTML=(d.members||[]).map(m=>'<article class="mld-member"><img src="'+esc(m.avatar||'/logo.svg')+'"><span><b>'+esc(m.name)+'</b><small>@'+esc(m.username||'')+'</small><em>'+esc((m.importantRoles||[]).map(x=>x.name).join(' · ')||'عضو')+'</em></span></article>').join('')||'<div class="mld-empty">لا توجد نتائج</div>';};}
  else if(p==='top'){const d=await fetch(API+'/api/public/top',{cache:'no-store'}).then(r=>r.json());el.innerHTML=shell(p,(d.messages?.length?card('💬 أكثر الرسائل',d.messages.slice(0,10).map((x,i)=>rank(x,i,'رسالة',x.stats?.messages)).join('')):'')+(d.voice?.length?card('🎙️ النشاط الصوتي',d.voice.slice(0,10).map((x,i)=>rank(x,i,'دقيقة',x.stats?.voiceMinutes)).join('')):'')+((d.messages?.length||d.voice?.length)?'':'<div class="mld-empty">لا توجد إحصائيات نشاط بعد</div>'));}
  else if(p==='leaders'){const d=await fetch(API+'/api/public/roles',{cache:'no-store'}).then(r=>r.json());el.innerHTML=shell(p,'<div class="mld-role-grid">'+(d.roles||[]).filter(r=>r.name!=='@everyone').map(r=>'<article class="mld-role-card"><h3><i style="background:'+esc(r.color||'#ff9cde')+'"></i>'+esc(r.name)+'</h3><p>'+esc(r.membersCount)+' عضو</p><button class="btn-primary" onclick="location.hash=\'leaders-\'+encodeURIComponent(\''+esc(r.id)+'\')">عرض الأعضاء</button></article>').join('')+'</div>');}
  else if(p==='chat'){el.innerHTML=shell(p,card('💬 الشات العام','<div id="chatFeed" class="mld-feed"></div><div class="mld-composer"><input id="chatInput" class="full" placeholder="اكتب رسالتك..."><button class="btn-primary" id="chatSend">إرسال</button></div>'));loadFeatureChat();}
  else if(p==='reviews'){el.innerHTML=shell(p,card('⭐ آراء المجتمع','<div id="reviewsList" class="mld-feed">جاري...</div><textarea id="reviewInput" class="full" placeholder="اكتب رأيك"></textarea><button class="btn-primary" id="reviewSend">إضافة رأي</button>'));loadReviews();}
  else if(p==='tickets'){el.innerHTML=shell(p,card('🎫 فتح تذكرة','<input id="ticketSubject" class="full" placeholder="عنوان التذكرة"><textarea id="ticketContent" class="full" placeholder="اشرح مشكلتك"></textarea><button class="btn-primary" id="ticketSend">فتح التذكرة</button><div id="ticketsList" class="mld-feed"></div>'));document.getElementById('ticketSend').onclick=async()=>{const d=await api('/api/community/tickets',{method:'POST',body:JSON.stringify({subject:ticketSubject.value,content:ticketContent.value})});toast(d.error||'تم فتح التذكرة ✓');loadTickets()};loadTickets();}
  else if(p==='applications'){el.innerHTML=shell(p,card('📝 التقديم','<input id="appDiscord" class="full" placeholder="Discord ID"><textarea id="appAnswers" class="full" placeholder="إجاباتك"></textarea><button class="btn-primary" id="appSend">إرسال التقديم</button><div id="appsList" class="mld-feed"></div>'));document.getElementById('appSend').onclick=async()=>{const d=await api('/api/community/applications',{method:'POST',body:JSON.stringify({discord_id:appDiscord.value,answers:{text:appAnswers.value}})});toast(d.error||'تم الإرسال ✓');loadApps()};loadApps();}
  else if(p==='groups'){const d=await fetch(API+'/api/community/groups').then(r=>r.json());el.innerHTML=shell(p,card('👨‍👩‍👧 القروبات','<div class="mld-feed">'+(d.groups||[]).map(g=>'<div class="bot-card"><b>'+esc(g.name)+'</b><p>'+esc(g.description||'')+'</p><button class="btn-primary" onclick="joinGroup('+g.id+')">انضمام</button></div>').join('')+'</div>')+(token?card('➕ إنشاء قروب','<input id="groupName" class="full" placeholder="اسم القروب"><textarea id="groupDesc" class="full" placeholder="الوصف"></textarea><button class="btn-primary" id="groupSend">إرسال الطلب</button>'):''));if(token)document.getElementById('groupSend').onclick=async()=>{const d=await api('/api/community/groups',{method:'POST',body:JSON.stringify({name:groupName.value,description:groupDesc.value})});toast(d.error||'تم إرسال الطلب ✓')};}
  else if(p==='cinema'){const d=await fetch(API+'/api/community/cinema').then(r=>r.json());el.innerHTML=shell(p,card('🎬 الغرف','<div class="mld-room-grid">'+(d.rooms||[]).map(x=>'<article class="mld-room"><h3>'+esc(x.title)+'</h3><p>'+esc(x.status)+'</p><video controls playsinline src="'+esc(x.media_url)+'"></video><button class="btn-primary" onclick="joinCinema('+x.id+')">دخول ومزامنة</button></article>').join('')+'</div>')+(token?card('➕ إنشاء غرفة','<input id="cinemaTitle" class="full" placeholder="اسم العرض"><input id="cinemaUrl" class="full" placeholder="رابط المحتوى المصرح لك باستخدامه"><button class="btn-primary" id="cinemaSend">إنشاء الغرفة</button>'):''));if(token)document.getElementById('cinemaSend').onclick=async()=>{const d=await api('/api/community/cinema',{method:'POST',body:JSON.stringify({title:cinemaTitle.value,media_url:cinemaUrl.value})});toast(d.error||'تم إنشاء الغرفة ✓')};}
  else if(p==='pigeon'){el.innerHTML=shell(p,card('✉️ الزاجل','<input id="pigeonRecipient" class="full" placeholder="ID المستلم"><textarea id="pigeonText" class="full" placeholder="الرسالة"></textarea><button class="btn-primary" id="pigeonSend">إرسال</button><div id="pigeonList" class="mld-feed"></div>'));document.getElementById('pigeonSend').onclick=async()=>{const d=await api('/api/community/pigeon',{method:'POST',body:JSON.stringify({recipient_id:pigeonRecipient.value,content:pigeonText.value})});toast(d.error||'تم الإرسال ✓');loadPigeon()};loadPigeon();}
  else if(p==='bots'){el.innerHTML=shell(p,card('🤖 بوتاتي','<div id="botsList" class="grid"></div>'));await loadBots();}
  else if(p==='addbot'){el.innerHTML=shell(p,card('➕ إضافة بوت','<input id="botName" class="full" placeholder="اسم البوت"><input id="botToken" class="full" type="password" placeholder="توكن البوت"><input id="botGuild" class="full" placeholder="ID السيرفر"><button class="btn-primary" id="createBotBtn">إضافة البوت</button><div id="botMsg" class="msg"></div>'));document.getElementById('createBotBtn').onclick=async()=>{const d=await api('/api/bots',{method:'POST',body:JSON.stringify({name:botName.value,token:botToken.value,guild_id:botGuild.value})});toast(d.error||'تمت الإضافة ✓');if(!d.error)renderPage('bots')};}
  else if(p==='profile'){el.innerHTML=shell(p,card('👤 بياناتي','<div class="mld-profile-form"><input id="profileName" class="full" value="'+esc(user.username)+'"><textarea id="profileBio" class="full" rows="4" placeholder="نبذة">'+esc(user.bio||'')+'</textarea><button class="btn-primary" id="profileSave">حفظ التغييرات</button></div>'));document.getElementById('profileSave').onclick=async()=>{const d=await api('/api/users/me',{method:'PATCH',body:JSON.stringify({username:profileName.value,bio:profileBio.value})});if(d.error)return toast(d.error);user=d.user;localStorage.setItem('user',JSON.stringify(user));toast('تم الحفظ ✓');initApp()};}
  else if(p==='admin'||p==='owner'||p==='owner-admin'){await loadAdmin();el.innerHTML=shell(p,'<div class="mld-admin-grid"><div id="privUsers"></div><div id="privTickets"></div><div id="privApps"></div><div id="privGroups"></div><div id="privAudit"></div></div>');loadAdminFinal(p);}
 }catch(e){el.innerHTML=shell(p,'<div class="mld-empty">تعذر تحميل الصفحة حاليًا.<br>'+esc(e.message)+'</div>');}
}
function rank(x,i,label,val){return '<div class="mld-rank"><i>'+String(i+1).padStart(2,'0')+'</i><span><b>'+esc(x.name||x.username||'عضو')+'</b><small>'+label+'</small></span><strong>'+num(val)+'</strong></div>'}
function num(v){return Number(v||0).toLocaleString('ar-SA')}
async function loadAdminFinal(p){const u=await api('/api/users');const target=document.getElementById('privUsers');if(target)target.innerHTML=card('👥 الحسابات',(u.users||[]).map(x=>'<div class="bot-card"><b>'+esc(x.username)+'</b><p>'+(x.is_owner?'👑 الأونر':x.role==='admin'?'🛡️ إدارة':'عضو')+'</p>'+(isOwner()&&!x.is_owner?'<button class="btn-primary" onclick="setAdmin(\''+x.id+'\',\''+(x.role==='admin'?'remove':'add')+'\')">'+(x.role==='admin'?'إزالة الإدارة':'منح الإدارة')+'</button>':'')+'</div>').join('')||'<div class="mld-empty">لا توجد حسابات</div>';
const td=await api('/api/community/tickets');const tt=document.getElementById('privTickets');if(tt)tt.innerHTML=card('🎫 التذاكر',(td.tickets||[]).map(x=>'<div class="bot-card"><b>#'+x.id+' '+esc(x.subject)+'</b><p>'+esc(x.status)+'</p><button class="btn-primary" onclick="claimTicket(\''+x.id+'\')">استلام</button></div>').join('')||'<div class="mld-empty">لا توجد تذاكر</div>');
if(p==='owner'||p==='owner-admin'){const [a,g,l]=await Promise.all([api('/api/community/applications'),api('/api/community/groups/all'),api('/api/community/audit')]);document.getElementById('privApps').innerHTML=card('📝 التقديم للأونر فقط',(a.applications||[]).map(x=>'<div class="bot-card">#'+x.id+' · '+esc(x.status)+'<button class="btn-primary" onclick="applicationStatus(\''+x.id+'\',\'accepted\')">قبول</button> <button class="btn-primary" onclick="applicationStatus(\''+x.id+'\',\'rejected\')">رفض</button></div>').join('')||'<div class="mld-empty">لا توجد طلبات</div>';document.getElementById('privGroups').innerHTML=card('👨‍👩‍👧 القروبات',(g.groups||[]).map(x=>'<div class="bot-card">'+esc(x.name)+' · '+esc(x.status)+'</div>').join('')||'<div class="mld-empty">لا توجد طلبات</div>');document.getElementById('privAudit').innerHTML=card('📋 سجل الأونر',(l.logs||[]).map(x=>'<div class="bot-card"><b>'+esc(x.action)+'</b><p>'+esc(x.actor_name||'')+'</p></div>').join('')||'<div class="mld-empty">لا يوجد سجل</div>');}else{document.getElementById('privApps').innerHTML='';document.getElementById('privGroups').innerHTML='';document.getElementById('privAudit').innerHTML='';}}
function wireNav(){document.querySelectorAll('.sidebar .nav a[data-page]').forEach(a=>{a.onclick=e=>{e.preventDefault();renderPage(a.dataset.page);}});document.getElementById('menuBtn')?.addEventListener('click',openAppMenu);document.getElementById('appMenuBackdrop')?.addEventListener('click',closeAppMenu);document.getElementById('logoutBtn')?.addEventListener('click',()=>{localStorage.clear();location.reload()});document.getElementById('loginBtn')?.addEventListener('click',()=>document.getElementById('authScreen')?.classList.add('show'));document.getElementById('topLoginBtn')?.addEventListener('click',()=>document.getElementById('authScreen')?.classList.add('show'));}
function syncPrivilegedMenu(){const owner=isOwner(),admin=isAdmin();const al=document.getElementById('adminLink'),ol=document.getElementById('ownerLink'),as=document.getElementById('adminSection'),os=document.getElementById('ownerSection');if(al)al.style.display=admin?'flex':'none';if(as)as.style.display=admin?'block':'none';if(ol)ol.style.display=owner?'flex':'none';if(os)os.style.display=owner?'block':'none';const app=document.getElementById('applicationsLink');if(app)app.style.display=owner?'flex':'none';}
wireNav();syncPrivilegedMenu();

/* ===== MLD FINAL STABILITY PATCH ===== */
(function(){
  const protectedPages=['chat','pigeon','tickets','applications','bots','addbot','profile'];
  const canAdmin=()=>!!user?.is_owner||['admin','owner'].includes(String(user?.role||'').toLowerCase());
  const canOwner=()=>!!user?.is_owner;
  function syncAccess(){
    const admin=canAdmin(),owner=canOwner();
    for(const [id,show] of [['adminLink',admin],['adminSection',admin],['ownerLink',owner],['ownerSection',owner],['applicationsLink',owner]]){
      const e=document.getElementById(id);if(e)e.style.display=show?(id.endsWith('Section')?'block':'flex'):'none';
    }
  }
  function closeMenu(){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('appMenuBackdrop')?.classList.remove('show');document.body.classList.remove('app-menu-open');document.getElementById('menuBtn')?.setAttribute('aria-expanded','false')}
  function toggleMenu(e){e?.preventDefault();e?.stopPropagation();const s=document.getElementById('sidebar');if(!s)return;const open=!s.classList.contains('open');s.classList.toggle('open',open);document.getElementById('app-menu-backdrop')?.classList.toggle('show',open);document.body.classList.toggle('app-menu-open',open);document.getElementById('menuBtn')?.setAttribute('aria-expanded',String(open))}
  document.getElementById('menuBtn')?.addEventListener('click',toggleMenu,{capture:true});
  document.getElementById('app-menu-backdrop')?.addEventListener('click',closeMenu);
  document.querySelectorAll('.sidebar a[data-page]').forEach(a=>a.addEventListener('click',e=>{
    const p=a.dataset.page;
    if(!p)return;
    if(protectedPages.includes(p)&&!token){e.preventDefault();closeMenu();document.getElementById('authScreen')?.classList.add('show');toast('هذه الصفحة تتطلب تسجيل الدخول');return}
    if(p==='admin'||p==='owner'||p==='owner-admin'){e.preventDefault();if(p==='admin'&&!canAdmin())return toast('لوحة الإدارة للإدارة فقط');if((p==='owner'||p==='owner-admin')&&!canOwner())return toast('لوحة الأونر للأونر فقط');closeMenu();renderPage(p);return}
    closeMenu();
  }));
  syncAccess();window.addEventListener('load',syncAccess);
})();

/* ===== MLD NAVIGATION SINGLE-SOURCE PATCH ===== */
(function(){
  const oldBtn=document.getElementById('menuBtn');
  if(oldBtn){
    const btn=oldBtn.cloneNode(true); oldBtn.replaceWith(btn);
    btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();const side=document.getElementById('sidebar');const back=document.getElementById('appMenuBackdrop');const open=!side.classList.contains('open');side.classList.toggle('open',open);back?.classList.toggle('show',open);document.body.classList.toggle('app-menu-open',open);btn.setAttribute('aria-expanded',String(open));});
  }
  const side=document.getElementById('sidebar');
  if(side){
    const fresh=side.cloneNode(true); side.replaceWith(fresh);
    fresh.addEventListener('click',function(e){
      const a=e.target.closest('a[data-page]'); if(!a)return;
      e.preventDefault();
      const p=a.dataset.page;
      if(p==='logout'){localStorage.clear();location.reload();return;}
      if(p==='login'){document.getElementById('authScreen')?.classList.add('show');return;}
      renderPage(p);
    });
  }
  const back=document.getElementById('appMenuBackdrop');
  if(back){const fresh=back.cloneNode(true);back.replaceWith(fresh);fresh.addEventListener('click',()=>{document.getElementById('sidebar')?.classList.remove('open');fresh.classList.remove('show');document.body.classList.remove('app-menu-open');document.getElementById('menuBtn')?.setAttribute('aria-expanded','false');});}
  window.addEventListener('hashchange',()=>{const p=(location.hash||'#home').slice(1);if(p&&p!=='home')renderPage(p);});
})();

/* ===== MLD FINAL RESPONSIVE APP PATCH ===== */
(function(){
  const protectedPages=['chat','pigeon','tickets','applications','bots','addbot','profile'];
  function syncFinalAccess(){
    const owner=!!user?.is_owner;
    const admin=owner||['admin','owner'].includes(String(user?.role||'').toLowerCase());
    const adminLink=document.getElementById('adminLink'), adminSection=document.getElementById('adminSection');
    const ownerLink=document.getElementById('ownerLink'), ownerSection=document.getElementById('ownerSection');
    const appLink=document.getElementById('applicationsLink');
    if(adminLink)adminLink.style.display=admin?'flex':'none';
    if(adminSection)adminSection.style.display=admin?'block':'none';
    if(ownerLink)ownerLink.style.display=owner?'flex':'none';
    if(ownerSection)ownerSection.style.display=owner?'block':'none';
    if(appLink)appLink.style.display=owner?'flex':'none';
  }
  window.__mldSyncAccess=syncFinalAccess;
  setTimeout(syncFinalAccess,50);
  setTimeout(syncFinalAccess,700);
  document.addEventListener('visibilitychange',syncFinalAccess);
})();


/* ===== MLD ONE NAV CONTROLLER v20261005 ===== */
(function(){
  const $=s=>document.querySelector(s);
  const sidebar=$('#sidebar'), back=$('#appMenuBackdrop'), btn=$('#menuBtn');
  if(!sidebar||!btn)return;
  function close(){sidebar.classList.remove('open');back?.classList.remove('show');document.body.classList.remove('app-menu-open');btn.setAttribute('aria-expanded','false');}
  function toggle(e){e?.preventDefault();e?.stopPropagation();const open=!sidebar.classList.contains('open');sidebar.classList.toggle('open',open);back?.classList.toggle('show',open);document.body.classList.toggle('app-menu-open',open);btn.setAttribute('aria-expanded',String(open));}
  const freshBtn=btn.cloneNode(true);btn.replaceWith(freshBtn);freshBtn.addEventListener('click',toggle,{passive:false});
  const freshSide=sidebar.cloneNode(true);sidebar.replaceWith(freshSide);
  freshSide.addEventListener('click',e=>{
    const a=e.target.closest('a[data-page]');if(!a)return;e.preventDefault();
    const p=a.dataset.page;
    if(p==='logout'){localStorage.clear();location.href='app.html#home';location.reload();return;}
    if(p==='login'){close();$('#authScreen')?.classList.add('show');return;}
    renderPage(p);close();
  });
  const freshBack=back?.cloneNode(true);if(back&&freshBack){back.replaceWith(freshBack);freshBack.addEventListener('click',close);}
  window.addEventListener('resize',()=>{if(innerWidth>900)close();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
})();

/* Keep owner/admin visibility correct after /api/auth/me refresh. */
(function(){
  window.__mldSyncPrivileged=function(){
    const owner=!!user?.is_owner;
    const admin=owner||['admin','owner'].includes(String(user?.role||'').toLowerCase());
    const set=(id,show,display='flex')=>{const e=document.getElementById(id);if(e)e.style.display=show?display:'none';};
    set('adminSection',admin,'block');set('adminLink',admin);set('ownerSection',owner,'block');set('ownerLink',owner);set('applicationsLink',owner);
    const n=document.getElementById('myRole');if(n)n.textContent=owner?'الأونر 👑':admin?'إدارة 🛡️':'عضو';
  };
  window.__mldSyncPrivileged();setTimeout(window.__mldSyncPrivileged,500);setTimeout(window.__mldSyncPrivileged,1500);
})();

document.getElementById('changePasswordBtn')?.addEventListener('click',async()=>{
 const msg=document.getElementById('passwordMsg'), cur=document.getElementById('currentPassword')?.value||'', n=document.getElementById('newPassword')?.value||'', n2=document.getElementById('newPassword2')?.value||'';
 if(n!==n2){msg.className='msg show error';msg.textContent='كلمتا المرور غير متطابقتين';return;}
 const d=await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({current_password:cur,new_password:n})});
 msg.className='msg show '+(d.error?'error':'success');msg.textContent=d.error||d.message||'تم';
 if(!d.error){document.getElementById('currentPassword').value='';document.getElementById('newPassword').value='';document.getElementById('newPassword2').value='';}
});

window.openMLDGame=(type)=>{
 const host=document.getElementById('embeddedGame'); if(!host)return;
 document.getElementById('gameCatalog').style.display='none'; host.style.display='block';
 host.innerHTML='<div class="panel" style="padding:0;overflow:hidden"><div style="display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.08)"><b>🎮 جلسة MLD</b><button class="btn-secondary" onclick="closeMLDGame()">رجوع للألعاب</button></div><iframe id="mldGameFrame" title="MLD Game" style="width:100%;height:720px;border:0;background:#08060d"></iframe></div>';
 document.getElementById('mldGameFrame').src='/game.html?type='+encodeURIComponent(type)+'&embed=1';
};
window.closeMLDGame=()=>{const h=document.getElementById('embeddedGame'),c=document.getElementById('gameCatalog');if(h){h.style.display='none';h.innerHTML='';}if(c)c.style.display='grid';};

/* MLD FINAL OVERRIDE - single mobile navigation controller */
(()=>{
 const init=()=>{
  const s=document.getElementById('sidebar'),b=document.getElementById('menuBtn'),back=document.getElementById('appMenuBackdrop'); if(!s||!b)return;
  const close=()=>{s.classList.remove('open');back?.classList.remove('show');document.body.classList.remove('app-menu-open');b.setAttribute('aria-expanded','false')};
  const open=()=>{s.classList.add('open');back?.classList.add('show');document.body.classList.add('app-menu-open');b.setAttribute('aria-expanded','true')};
  b.onclick=e=>{e.preventDefault();e.stopPropagation();s.classList.contains('open')?close():open()};
  back?.addEventListener('click',close);s.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
  document.addEventListener('keydown',e=>e.key==='Escape'&&close());window.addEventListener('resize',()=>innerWidth>900&&close());
  window.__mldCloseMenu=close;
  window.__mldSyncPrivileged?.();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
