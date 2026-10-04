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
  const loginBtn = document.getElementById('loginBtn');
  const topLoginBtn = document.getElementById('topLoginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authScreen = document.getElementById('authScreen');
  const openLogin = () => authScreen?.classList.add('show');
  loginBtn?.addEventListener('click', openLogin);
  topLoginBtn?.addEventListener('click', openLogin);
  if (!token || !user) {
    document.body.classList.remove('logged');
    if (loginBtn) loginBtn.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (topLoginBtn) topLoginBtn.style.display = 'block';
    document.getElementById('myName').textContent = 'زائر';
    document.getElementById('myRole').textContent = 'تصفح عام';
    document.getElementById('myAvatar').textContent = 'ز';
    return;
  }
  document.body.classList.add('logged');
  if (loginBtn) loginBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'flex';
  if (topLoginBtn) topLoginBtn.style.display = 'none';

  document.getElementById('myName').textContent = user.username;
  document.getElementById('myRole').textContent = user.is_owner ? 'الأونر 👑' : 'عضو';

  const av = document.getElementById('myAvatar');
  if (user.avatar) av.innerHTML = `<img src="${esc(user.avatar)}">`;
  else av.textContent = initials(user.username);

  if (user.is_owner || ['admin','owner'].includes(String(user.role||'').toLowerCase())) {
    document.getElementById('adminLink').style.display = 'flex'; document.getElementById('adminSection').style.display = 'block'; document.getElementById('ownerSection').style.display = user.is_owner ? 'block' : 'none'; if(user.is_owner){ document.getElementById('ownerLink').style.display='flex'; }
  }


  document.getElementById('profileName').value = user.username || '';
  document.getElementById('profileBio').value = user.bio || '';

  loadBots();
}

document.querySelectorAll('.sidebar .nav a[data-page]').forEach(a => {
  a.onclick = (e) => {
    const page = a.dataset.page;
    const protectedPages = ['chat','pigeon','tickets','applications','bots','addbot','add-bot','profile'];
    if (protectedPages.includes(page) && (!token || !user)) {
      e.preventDefault();
      toast('سجّل دخول أولاً');
      document.getElementById('sidebar')?.classList.remove('open'); document.body.classList.remove('app-menu-open'); document.getElementById('appMenuBackdrop')?.classList.remove('show');
      return;
    }
    if (featurePages.includes(page)) {
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

function toggleSidebar(e) {
  e?.preventDefault(); e?.stopPropagation();
  const sidebar=document.getElementById('sidebar'), button=document.getElementById('menuBtn'), backdrop=document.getElementById('appMenuBackdrop');
  if(!sidebar) return;
  const open=sidebar.classList.toggle('open');
  button?.setAttribute('aria-expanded',String(open));
  document.body.classList.toggle('app-menu-open',open);
  backdrop?.classList.toggle('show',open);
}
document.getElementById('menuBtn')?.addEventListener('click',toggleSidebar);
document.getElementById('appMenuBackdrop')?.addEventListener('click',()=>toggleSidebar());
document.addEventListener('click',e=>{
  const sidebar=document.getElementById('sidebar'),button=document.getElementById('menuBtn');
  if(!sidebar?.classList.contains('open')||!button)return;
  if(!sidebar.contains(e.target)&&e.target!==button)toggleSidebar();
});
document.getElementById('logoutBtn')?.addEventListener('click', () => { localStorage.clear(); location.reload(); });

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

function openRequestedHash(){ const p=(location.hash||'#home').slice(1).trim(); if(!p||p==='home') return; const protectedPages=['chat','pigeon','tickets','applications','bots','addbot','add-bot','profile']; if(protectedPages.includes(p)&&(!token||!user)){ document.getElementById('authScreen')?.classList.add('show'); toast('هذه الصفحة تتطلب تسجيل الدخول'); return; } const link=document.querySelector('.sidebar .nav a[data-page="'+p+'"]'); if(link) link.click(); }
window.addEventListener('hashchange',openRequestedHash);
initApp().then(()=>setTimeout(openRequestedHash,0));

/* ===== MLD community feature bridge ===== */
const featurePages = ['members','top','leaders','chat','pigeon','games','cinema','groups','tickets','applications','reviews','profile'];
const pageTitles = {members:'👥 الأعضاء',top:'🏆 التوب',leaders:'👑 الرتب القيادية',chat:'💬 الشات العام',pigeon:'✉️ الزاجل',games:'🎮 الألعاب',cinema:'🎬 السينما',groups:'👨‍👩‍👧 القروبات',tickets:'🎫 التذاكر',applications:'📝 التقديم',reviews:'⭐ الآراء'};
function featureProtected(p){ return ['chat','pigeon','tickets','applications','bots','addbot','add-bot','profile'].includes(p); }
function requireFeatureAuth(){ if(!token||!user){ toast('سجّل دخول أولاً'); document.getElementById('authScreen')?.classList.add('show'); return false; } return true; }
function pageBox(p,body){ const el=document.getElementById('page-'+p); if(el) el.innerHTML='<div class="card">'+body+'</div>'; }
async function renderFeature(p){
  if(featureProtected(p)&&!requireFeatureAuth()) return;
  const page=document.getElementById('page-'+p); if(!page)return;
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active')); page.classList.add('active');
  document.querySelectorAll('.sidebar .nav a').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
  document.getElementById('pageTitle').textContent=pageTitles[p]||p;
  document.getElementById('sidebar').classList.remove('open');
  if(p==='games'){ location.href='/game.html'; return; }
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
 const al=document.getElementById('adminLink'), ol=document.getElementById('ownerLink'), as=document.getElementById('adminSection'), os=document.getElementById('ownerSection');
 if(al) al.style.display=admin?'flex':'none'; if(as) as.style.display=admin?'block':'none';
 if(ol) ol.style.display=owner?'flex':'none'; if(os) os.style.display=owner?'block':'none';
 document.body.classList.toggle('is-owner',owner); document.body.classList.toggle('is-admin',admin);
}
setTimeout(syncPrivilegedMenu,0);
window.addEventListener('storage',syncPrivilegedMenu);

/* ===== FINAL MLD PAGE UI ===== */
const FINAL_META={members:['👥','الأعضاء','دليل مجتمع MLD والبحث المباشر'],top:['🏆','التوب','ترتيب النشاط داخل المجتمع'],leaders:['👑','الرتب القيادية','الرتب المهمة وأعضاءها'],chat:['💬','الشات العام','محادثة المجتمع'],pigeon:['✉️','الزاجل','رسائلك الخاصة'],games:['🎮','الألعاب','جلسات اللعب والمتفرجين'],cinema:['🎬','السينما','غرف المشاهدة الجماعية'],groups:['👨‍👩‍👧','القروبات','مجتمعات صغيرة مرتبطة بـ MLD'],tickets:['🎫','التذاكر','الدعم والمتابعة'],applications:['📝','التقديم','طلبات الإدارة الرسمية'],reviews:['⭐','الآراء','تجارب أعضاء المجتمع'],bots:['🤖','منصة البوتات','إدارة بوتاتك'],addbot:['➕','إضافة بوت','ربط بوت جديد'],profile:['👤','بروفايلي','إدارة بيانات حسابك'],admin:['🛡️','لوحة الإدارة','التذاكر والحسابات المسموح بها'], 'owner-admin':['👑','لوحة الأونر','التحكم الكامل بالأونر']};
function finalShell(p,body){const m=FINAL_META[p]||['✦',p,''];return '<section class="mld-page-shell"><header class="mld-page-head"><div><span class="mld-kicker">'+m[0]+' MLD COMMUNITY</span><h1>'+m[1]+'</h1><p>'+m[2]+'</p></div></header><div class="mld-page-body">'+body+'</div></section>'}
async function finalRender(p){
 if(['chat','pigeon','tickets','applications','bots','addbot','profile','admin','owner-admin'].includes(p)&&!token){toast('سجّل دخول أولاً');document.getElementById('authScreen')?.classList.add('show');return}
 if(p==='owner-admin'&&!user?.is_owner){toast('لوحة الأونر للأونر فقط');return}
 if(p==='admin'&&!user?.is_owner&&!['admin','owner'].includes(String(user?.role||'').toLowerCase())){toast('لوحة الإدارة للإدارة فقط');return}
 const page=document.getElementById('page-'+p);if(!page)return;
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));page.classList.add('active');
 document.querySelectorAll('.sidebar .nav a').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
 document.getElementById('pageTitle').textContent=(FINAL_META[p]||['',p])[1];
 document.getElementById('sidebar')?.classList.remove('open');
 try{
  if(p==='members'){const d=await fetch(API+'/api/public/members',{cache:'no-store'}).then(r=>r.json());page.innerHTML=finalShell(p,'<div class="mld-toolbar"><input id="fmq" class="full" placeholder="ابحث عن عضو..."><span>'+((d.members||[]).length)+' عضو</span></div><div class="mld-member-grid">'+(d.members||[]).map(m=>'<article class="mld-member"><img src="'+esc(m.avatar||'/logo.svg')+'"><span><b>'+esc(m.name)+'</b><small>@'+esc(m.username||'')+'</small><em>'+(m.importantRoles||[]).slice(0,2).map(x=>esc(x.name)).join(' · ')||'عضو')+'</em></span></article>').join('')+'</div>');page.querySelector('#fmq').oninput=async e=>{const d=await fetch(API+'/api/public/members?q='+encodeURIComponent(e.target.value),{cache:'no-store'}).then(r=>r.json());page.querySelector('.mld-member-grid').innerHTML=(d.members||[]).map(m=>'<article class="mld-member"><img src="'+esc(m.avatar||'/logo.svg')+'"><span><b>'+esc(m.name)+'</b><small>@'+esc(m.username||'')+'</small></span></article>').join('')||'<div class="mld-empty">لا توجد نتائج</div>'}
  }else if(p==='top'){const d=await fetch(API+'/api/public/top',{cache:'no-store'}).then(r=>r.json());const section=(t,a,k)=>'<div class="mld-rankbox"><h3>'+t+'</h3>'+((d[a]||[]).slice(0,10).map((x,i)=>'<div class="mld-rank"><i>'+String(i+1).padStart(2,'0')+'</i><img src="'+esc(x.avatar||'/logo.svg')+'"><span><b>'+esc(x.name)+'</b><small>'+k+'</small></span><strong>'+num(x.stats?.[a==='messages'?'messages':a==='voice'?'voiceMinutes':'mentionsReceived'])+'</strong></div>').join('')||'<div class="mld-empty">لا توجد بيانات نشاط بعد</div>')+'</div>';page.innerHTML=finalShell(p,section('💬 أكثر الرسائل','messages','رسالة')+section('🎙️ النشاط الصوتي','voice','دقيقة')+section('✨ أكثر المنشنات','mentions','منشن'))}
  else if(p==='leaders'){const d=await fetch(API+'/api/public/roles',{cache:'no-store'}).then(r=>r.json());page.innerHTML=finalShell(p,'<div class="mld-role-grid">'+(d.roles||[]).map(r=>'<article class="mld-role-card"><div><i style="background:'+esc(r.color||'#ff9cde')+'"></i><b>'+num(r.membersCount)+' عضو</b></div><h3>'+esc(r.name)+'</h3><p>'+(r.permissions||[]).slice(0,4).map(esc).join(' · ')+'</p></article>').join('')+'</div>')}
  else if(p==='games'){page.innerHTML=finalShell(p,'<div class="mld-game-grid">'+[['uno','🎴','أونو','2–6'],['jaccaro','🎲','جاكارو','2–4'],['codenames','🕵️','كود نيمز','4+'],['baloot','♠️','بلوت','4'],['ludo','🎯','لودو','2–4'],['monopoly','🏠','مونوبولي','2–6'],['maqousar','🃏','مقوصر','4+']].map(g=>'<article class="mld-game"><span>'+g[1]+'</span><h3>'+g[2]+'</h3><p>'+g[3]+' لاعبين</p><button class="primary" onclick="location.href=\'/game.html?type='+g[0]+'\'">فتح اللعبة</button></article>').join('')+'</div><div class="mld-panel"><h3>الجلسات الحالية</h3><div id="sessions-list">جاري التحميل...</div></div>');loadSessions()}
  else if(p==='reviews'){page.innerHTML=finalShell(p,'<div id="reviews-list" class="mld-feed">جاري...</div><div class="mld-form-grid"><textarea id="review-input" class="full" placeholder="اكتب رأيك"></textarea><button class="primary" id="review-send">إضافة رأي</button></div>');loadReviews()}
  else if(p==='chat'){page.innerHTML=finalShell(p,'<div id="feature-chat" class="mld-feed">جاري...</div><div class="mld-composer"><input id="chat-input" class="full" placeholder="اكتب رسالتك..."><button class="primary" id="chat-send">إرسال</button></div>');loadFeatureChat()}
  else if(p==='pigeon'){page.innerHTML=finalShell(p,'<div class="mld-form-grid"><input id="pigeon-recipient" class="full" placeholder="اسم المستخدم أو ID"><textarea id="pigeon-text" class="full" placeholder="الرسالة"></textarea><button class="primary" id="pigeon-send">إرسال</button></div><div id="pigeon-list" class="mld-feed"></div>');document.getElementById('pigeon-send').onclick=async()=>{const d=await api('/api/community/pigeon',{method:'POST',body:JSON.stringify({recipient_id:document.getElementById('pigeon-recipient').value,content:document.getElementById('pigeon-text').value})});toast(d.error||'تم ✓');loadPigeon()};loadPigeon()}
  else if(p==='tickets'){page.innerHTML=finalShell(p,'<div class="mld-form-grid"><input id="ticket-subject" class="full" placeholder="عنوان التذكرة"><textarea id="ticket-content" class="full" placeholder="اشرح المشكلة"></textarea><button class="primary" id="ticket-send">فتح التذكرة</button></div><div id="tickets-list" class="mld-feed"></div>');document.getElementById('ticket-send').onclick=async()=>{const d=await api('/api/community/tickets',{method:'POST',body:JSON.stringify({subject:document.getElementById('ticket-subject').value,content:document.getElementById('ticket-content').value})});toast(d.error||'تم فتح التذكرة ✓');loadTickets()};loadTickets()}
  else if(p==='applications'){page.innerHTML=finalShell(p,user?.is_owner?'<div id="apps-list" class="mld-feed">جاري...</div>':'<div class="mld-empty"><strong>التقديم للأونر فقط</strong><span>هذه الصفحة لا تعرض طلبات الأعضاء.</span></div>');if(user?.is_owner)loadApps()}
  else if(p==='groups'){const d=await fetch(API+'/api/community/groups',{cache:'no-store'}).then(r=>r.json());page.innerHTML=finalShell(p,'<div class="mld-room-grid">'+(d.groups||[]).map(x=>'<article class="mld-room"><span>👨‍👩‍👧</span><h3>'+esc(x.name)+'</h3><p>'+esc(x.description||'')+'</p><button class="primary" onclick="joinGroup('+x.id+')">انضمام</button></article>').join('')+'</div><div class="mld-create"><input id="group-name" class="full" placeholder="اسم القروب"><textarea id="group-desc" class="full" placeholder="الوصف"></textarea><button class="primary" id="group-send">إنشاء قروب</button></div>');document.getElementById('group-send').onclick=async()=>{const d=await api('/api/community/groups',{method:'POST',body:JSON.stringify({name:document.getElementById('group-name').value,description:document.getElementById('group-desc').value})});toast(d.error||'تم ✓');finalRender('groups')}}
  else if(p==='cinema'){const d=await fetch(API+'/api/community/cinema',{cache:'no-store'}).then(r=>r.json());page.innerHTML=finalShell(p,'<div class="mld-room-grid">'+(d.rooms||[]).map(x=>'<article class="mld-room"><span>🎬</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.status)+'</p><video controls playsinline src="'+esc(x.media_url)+'"></video><button class="primary" onclick="joinCinema('+x.id+')">دخول ومزامنة</button></article>').join('')+'</div><div class="mld-create"><input id="cinema-title" class="full" placeholder="اسم العرض"><input id="cinema-url" class="full" placeholder="رابط محتوى مصرح"><button class="primary" id="cinema-send">إنشاء غرفة</button></div>');document.getElementById('cinema-send').onclick=async()=>{const d=await api('/api/community/cinema',{method:'POST',body:JSON.stringify({title:document.getElementById('cinema-title').value,media_url:document.getElementById('cinema-url').value})});toast(d.error||'تم ✓');finalRender('cinema')}}
  else if(p==='bots'){page.innerHTML=finalShell(p,'<div class="mld-panel"><h3>بوتاتي</h3><div id="botsList" class="mld-member-grid"></div></div>');loadBots()}
  else if(p==='addbot'){page.innerHTML=finalShell(p,'<div class="mld-form-grid"><input id="botName" class="full" placeholder="اسم البوت"><input id="botToken" class="full" type="password" placeholder="توكن البوت"><input id="botGuild" class="full" placeholder="ID السيرفر"><button class="primary" id="createBotBtn">إضافة البوت</button><div id="botMsg" class="msg"></div></div>');document.getElementById('createBotBtn').onclick=async()=>{const d=await api('/api/bots',{method:'POST',body:JSON.stringify({name:botName.value,token:botToken.value,guild_id:botGuild.value})});toast(d.error||'تم ✓');if(!d.error)finalRender('bots')}}
  else if(p==='profile'){page.innerHTML=finalShell(p,'<div class="mld-profile-form"><div class="mld-avatar-big">'+esc((user.username||'?')[0].toUpperCase())+'</div><input id="profileName" class="full" value="'+esc(user.username||'')+'"><textarea id="profileBio" class="full" rows="5" placeholder="النبذة">'+esc(user.bio||'')+'</textarea><button class="primary" id="saveProfileBtn">حفظ</button></div>');document.getElementById('saveProfileBtn').onclick=async()=>{const d=await api('/api/users/me',{method:'PATCH',body:JSON.stringify({username:profileName.value.trim(),bio:profileBio.value.trim()})});if(d.error)return toast(d.error);user=d.user;localStorage.setItem('user',JSON.stringify(user));toast('تم الحفظ ✓')}}
  else if(p==='admin'||p==='owner-admin'){const owner=p==='owner-admin';page.innerHTML=finalShell(p,'<div class="mld-admin-grid"><div class="mld-panel"><h3>👥 الحسابات</h3><div id="ownerUsers" class="mld-feed"></div></div><div class="mld-panel"><h3>🎫 التذاكر</h3><div id="adminTickets" class="mld-feed"></div></div>'+(owner?'<div class="mld-panel"><h3>📝 التقديمات</h3><div id="ownerApplications" class="mld-feed"></div></div><div class="mld-panel"><h3>👨‍👩‍👧 القروبات</h3><div id="ownerGroups" class="mld-feed"></div></div><div class="mld-panel"><h3>📋 السجل</h3><div id="ownerAudit" class="mld-feed"></div></div>':'')+'</div>');loadAdmin()}
 }
 catch(e){page.innerHTML=finalShell(p,'<div class="mld-empty"><strong>تعذر تحميل الصفحة</strong><span>حاول مرة أخرى.</span></div>')}
}
renderFeature=finalRender;
