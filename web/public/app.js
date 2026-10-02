const API='https://api-production-5bddb.up.railway.app';
const LOCKED='https://discord.com/users/w4px';
const PUBLIC_PAGES=new Set(['home','members','top','leaders','games','cinema']);
let token=localStorage.getItem('mld_token')||'';
let user=JSON.parse(localStorage.getItem('mld_user')||'null');
let authMode='login',socket=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=n=>(n||'M').slice(0,2).toUpperCase();
const toast=t=>{const e=$('toast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove('show'),2300)};
function lockedFeature(){window.open(LOCKED,'_blank','noopener,noreferrer')}
function openAuth(){if($('authModal'))$('authModal').hidden=false}
function closeAuth(){if($('authModal'))$('authModal').hidden=true}
async function api(path,opt={}){
  const r=await fetch(API+path,{...opt,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(opt.headers||{})}});
  let d={};try{d=await r.json()}catch{}
  if(r.status===401){logout(false);throw new Error('سجّل دخولك أولاً')}
  if(!r.ok)throw new Error(d.error||'حدث خطأ');
  return d;
}
function setUser(u){
  user=u||null;
  if(user)localStorage.setItem('mld_user',JSON.stringify(user));else localStorage.removeItem('mld_user');
  const name=user?.username||'زائر';
  $('sideName').textContent=name;$('topName').textContent=name;
  $('sideRole').textContent=user?(user.is_owner?'الأونر 👑':user.role==='admin'?'إدارة 🛡️':'عضو'):'زائر';
  $('logout').hidden=!user;$('loginMenu').hidden=!!user;
  const canManage=!!user&&(!!user.is_owner||user.role==='admin');
  $('adminNav').hidden=false;
  document.querySelectorAll('.admin-only').forEach(e=>e.hidden=!canManage);
  const owner=!!user?.is_owner;
  $('ownerNav').hidden=!owner;
  document.querySelectorAll('.owner-only').forEach(e=>e.hidden=!owner);
  for(const id of ['sideAvatar','topAvatar']){const e=$(id);e.innerHTML=user?.avatar?'<img src="'+esc(user.avatar)+'">':esc(initials(name))}
}
function logout(reload=true){
  token='';user=null;localStorage.removeItem('mld_token');localStorage.removeItem('mld_user');
  if(socket){socket.disconnect();socket=null}
  setUser(null);closeAuth();showPage('home',true);if(reload)toast('تم تسجيل الخروج');
}
function requireLogin(){if(user)return true;openAuth();toast('هذا القسم يحتاج تسجيل دخول');return false}
function showPage(name,force=false){
  if(!PUBLIC_PAGES.has(name)&&!force&&!requireLogin())return;
  const p=$('page-'+name);if(!p)return;
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));p.classList.add('active');
  document.querySelectorAll('#sideNav button[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  const active=[...document.querySelectorAll('#sideNav button[data-page]')].find(b=>b.dataset.page===name);
  $('pageTitle').textContent=active?.textContent?.trim()||name;
  closeMenu();loadPage(name).catch(e=>toast(e.message));
}
function closeMenu(){$('sidebar').classList.remove('open');$('overlay').classList.remove('show')}
function bindNav(){
  document.querySelectorAll('#sideNav button[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showPage(b.dataset.go));
  $('hamb').onclick=()=>{$('sidebar').classList.add('open');$('overlay').classList.add('show')};
  $('overlay').onclick=closeMenu;$('closeMenu').onclick=closeMenu;
  $('loginMenu').onclick=openAuth;$('logout').onclick=()=>logout(true);
}
function setAuthMode(mode){
  authMode=mode;
  document.querySelectorAll('[data-auth]').forEach(x=>x.classList.toggle('pink',x.dataset.auth===mode));
  $('authSubmit').textContent=mode==='login'?'دخول':'تسجيل';
  $('discordWrap').style.display=mode==='register'?'block':'none';
}
async function doAuth(e){
  e.preventDefault();$('authMsg').textContent='جاري...';
  try{
    const d=await api('/api/auth/'+authMode,{method:'POST',body:JSON.stringify({username:$('username').value.trim(),password:$('password').value,discord_id:$('discord_id').value.trim()})});
    token=d.token;localStorage.setItem('mld_token',token);setUser(d.user);closeAuth();$('authForm').reset();setAuthMode('login');toast('تم تسجيل الدخول ✓');showPage('home',true);
  }catch(x){$('authMsg').textContent=x.message}
}
async function loadPage(p){
  if(p==='home')return home();if(p==='members')return members();if(p==='top')return top();if(p==='leaders')return leaders();
  if(p==='chat')return chat();if(p==='pigeon')return pigeon();if(p==='games')return games();if(p==='cinema')return cinema();if(p==='groups')return groups();
  if(p==='tickets')return tickets();if(p==='application')return applications();if(p==='reviews')return reviews();if(p==='bots')return bots();if(p==='addbot')return;
  if(p==='users')return users();if(p==='logs')return logs();if(p==='owner')return owner();if(p==='profile')return profile();
}
async function home(){
  try{
    const [s,r]=await Promise.all([api('/api/platform/stats'),api('/api/platform/reviews')]);
    $('stats').innerHTML=[['👥',s.members,'أعضاء'],['🤖',s.bots,'بوتات'],['🎮',s.games,'غرف ألعاب'],['🌐',s.servers,'سيرفرات']].map(x=>'<div class="mini"><strong>'+x[0]+' '+x[1]+'</strong><span>'+x[2]+'</span></div>').join('');
    $('homeReviews').innerHTML=(r.reviews||[]).slice(0,4).map(reviewCard).join('')||'<div class="empty">لا توجد آراء بعد.</div>';
  }catch(e){$('stats').innerHTML='<div class="empty">تعذر تحميل الإحصائيات حالياً.</div>';$('homeReviews').innerHTML='<div class="empty">تعذر تحميل الآراء.</div>'}
}
function reviewCard(r){return '<article class="review-card"><b>⭐ '+esc(r.username)+'</b><p class="muted">'+esc(r.content)+'</p><small class="muted">'+new Date(r.created_at).toLocaleString('ar-SA')+'</small></article>'}
async function members(q=''){const d=await api('/api/platform/members?q='+encodeURIComponent(q));$('members').innerHTML=(d.users||[]).map(u=>'<article class="user-card"><div class="user-head"><div class="avatar">'+(u.avatar?'<img src="'+esc(u.avatar)+'">':esc(initials(u.username)))+'</div><div><h3>'+esc(u.username)+'</h3><span class="badge">'+esc(u.role)+'</span></div></div><p class="muted">'+esc(u.bio||'عضو في مجتمع MLD')+'</p></article>').join('')||'<div class="empty">لا يوجد أعضاء.</div>'}
async function top(){
  const d=await api('/api/platform/top');
  $('topChat').innerHTML=(d.chat||[]).map((x,i)=>'<p class="muted" style="padding:8px;border-bottom:1px solid #ffffff0d">#'+(i+1)+' · <b>'+esc(x.name)+'</b> — '+x.score+' رسالة</p>').join('')||'<div class="empty">لا توجد بيانات.</div>';
  $('topVoice').innerHTML=(d.voice||[]).map((x,i)=>'<p class="muted">#'+(i+1)+' · <b>'+esc(x.name)+'</b> — '+x.score+'</p>').join('')||'لا توجد بيانات فويس حالياً.';
  $('topGames').innerHTML=(d.games||[]).map((x,i)=>'<p class="muted">#'+(i+1)+' · <b>'+esc(x.name)+'</b> — '+x.score+'</p>').join('')||'لا توجد بيانات ألعاب حالياً.';
}
async function leaders(){const d=await api('/api/platform/leaders');$('leaders').innerHTML=(d.users||[]).map(u=>'<article class="user-card"><div class="user-head"><div class="avatar">'+esc(initials(u.username))+'</div><div><h3>'+esc(u.username)+'</h3><span class="badge">'+(u.is_owner?'الأونر 👑':esc(u.role))+'</span></div></div></article>').join('')||'<div class="empty">لا توجد بيانات.</div>'}
async function chat(){
  const d=await api('/api/platform/chat');renderMessages(d.messages||[]);
  if(socket)socket.disconnect();socket=io(API);
  socket.on('connect',()=>socket.emit('join-chat'));
  socket.on('chat-message',m=>{const box=$('messages');box.insertAdjacentHTML('beforeend',messageHtml(m));box.scrollTop=box.scrollHeight});
}
function messageHtml(m){return '<div class="message '+(Number(m.user_id)===Number(user?.id)?'mine':'')+'"><div class="avatar">'+esc(initials(m.sender_name))+'</div><div class="bubble"><b>'+esc(m.sender_name)+'</b><p>'+esc(m.content)+'</p><small class="muted">'+new Date(m.created_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})+'</small></div></div>'}
function renderMessages(ms){$('messages').innerHTML=ms.map(messageHtml).join('')||'<div class="empty">ابدأ أول رسالة 👋</div>'}
async function pigeon(){const d=await api('/api/platform/members');$('pigeonRecipient').innerHTML=(d.users||[]).filter(x=>Number(x.id)!==Number(user.id)).map(x=>'<option value="'+x.id+'">'+esc(x.username)+'</option>').join('')||'<option>لا يوجد مستلمون</option>'}
async function games(){const d=await api('/api/platform/games');$('games').innerHTML=(d.games||[]).map(g=>'<article class="room-card"><h3>🎮 '+esc(g.name)+'</h3><p class="muted">'+esc(g.type)+' · '+(g.players||[]).length+' لاعب</p><button class="btn pink join-game" data-id="'+g.id+'">انضم</button></article>').join('')||'<div class="empty">لا توجد غرف. أنشئ أول غرفة.</div>'}
async function cinema(){const d=await api('/api/platform/cinema');$('cinemaRooms').innerHTML=(d.rooms||[]).map(r=>'<article class="room-card"><h3>🎬 '+esc(r.title)+'</h3><p class="muted">بواسطة '+esc(r.owner_name)+'</p>'+(r.media_url?'<a class="btn" href="'+esc(r.media_url)+'" target="_blank" rel="noopener">فتح المحتوى</a>':'')+'</article>').join('')||'<div class="empty">لا توجد جلسات.</div>'}
async function groups(){const d=await api('/api/platform/groups');$('groups').innerHTML=(d.groups||[]).map(g=>'<article class="room-card"><h3>👨‍👩‍👧 '+esc(g.name)+'</h3><p class="muted">'+esc(g.description||'بدون وصف')+'</p><span class="badge">'+esc(g.status)+'</span><button class="btn join-group" data-id="'+g.id+'">طلب انضمام</button></article>').join('')||'<div class="empty">لا توجد قروبات.</div>'}
async function tickets(){const d=await api('/api/platform/tickets');$('tickets').innerHTML=(d.tickets||[]).map(t=>'<article class="ticket-card"><h3>🎫 #'+t.id+' · '+esc(t.subject)+'</h3><p class="muted">'+esc(t.content)+'</p><span class="badge">'+esc(t.status)+'</span>'+(user?.is_owner||user?.role==='admin'?'<button class="btn green close-ticket" data-id="'+t.id+'">إغلاق</button>':'')+'</article>').join('')||'<div class="empty">لا توجد تذاكر.</div>'}
async function applications(){
  if(user?.is_owner){const d=await api('/api/platform/applications');$('ownerApplications').innerHTML=(d.applications||[]).map(a=>'<div class="ticket-card" style="margin-top:10px"><b>#'+a.id+' · '+esc(a.username)+'</b><p class="muted">Discord: '+esc(a.discord_id||'—')+'</p><p class="muted">'+esc(JSON.stringify(a.answers))+'</p><button class="btn green app-status" data-id="'+a.id+'" data-status="accepted">قبول</button> <button class="btn red app-status" data-id="'+a.id+'" data-status="rejected">رفض</button></div>').join('')||'<div class="empty">لا توجد طلبات.</div>'}else $('ownerApplications').innerHTML='<p class="muted">يرسل التقديم مباشرة للأونر للمراجعة.</p>'
}
async function reviews(){const d=await api('/api/platform/reviews');$('reviews').innerHTML=(d.reviews||[]).map(r=>'<article class="review-card"><b>⭐ '+esc(r.username)+'</b><p class="muted">'+esc(r.content)+'</p>'+(user?.is_owner?'<button class="btn red delete-review" data-id="'+r.id+'">حذف</button>':'')+'</article>').join('')||'<div class="empty">لا توجد آراء.</div>'}
async function bots(){const d=await api('/api/bots');$('bots').innerHTML=(d.bots||[]).map(b=>'<article class="bot-card"><h3>🤖 '+esc(b.name)+'</h3><p class="muted">السيرفر: '+esc(b.guild_id||'—')+'</p><p class="muted">الحالة: <b>'+(b.active?'نشط':'متوقف')+'</b></p><button class="btn bot-toggle" data-id="'+esc(b.id)+'" data-active="'+(!b.active)+'">'+(b.active?'إيقاف':'تشغيل')+'</button></article>').join('')||'<div class="empty">لا توجد بوتات.</div>'}
async function profile(){setUser(user);$('profileName').value=user?.username||''}
async function owner(){const s=await api('/api/platform/stats');$('ownerStats').innerHTML=[['👥',s.members,'مستخدم'],['🤖',s.bots,'بوت'],['🎮',s.games,'غرفة']].map(x=>'<div class="mini"><strong>'+x[0]+' '+x[1]+'</strong><span>'+x[2]+'</span></div>').join('')}
async function logs(){const d=await api('/api/platform/logs');$('logs').innerHTML=(d.logs||[]).map(l=>'<div style="padding:10px;border-bottom:1px solid #ffffff0d"><b>'+esc(l.action)+'</b><span class="muted"> · '+esc(l.actor_name||'system')+' · '+new Date(l.created_at).toLocaleString('ar-SA')+'</span></div>').join('')||'<div class="empty">لا توجد سجلات.</div>'}
async function users(){const d=await api('/api/platform/members?q='+encodeURIComponent($('userSearch').value||''));$('users').innerHTML=(d.users||[]).map(u=>'<article class="user-card"><h3>'+esc(u.username)+'</h3><p class="muted">الدور: '+esc(u.role)+'</p><select class="select user-role" data-id="'+u.id+'"><option value="member" '+(u.role==='member'?'selected':'')+'>عضو</option><option value="admin" '+(u.role==='admin'?'selected':'')+'>إدارة</option></select><button class="btn red delete-user" data-id="'+u.id+'">حذف</button></article>').join('')}
async function init(){
  bindNav();
  document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>setAuthMode(b.dataset.auth));
  $('authForm').onsubmit=doAuth;$('closeAuth').onclick=closeAuth;
  $('authModal').onclick=e=>{if(e.target===$('authModal'))closeAuth()};
  $('memberSearch').oninput=e=>members(e.target.value);
  $('userSearch').oninput=()=>users();
  $('sendChat').onclick=()=>{const v=$('chatInput').value.trim();if(!v)return;if(socket?.connected){socket.emit('chat-message',{token,content:v});$('chatInput').value=''}else toast('انتظر اتصال الشات')};
  $('chatInput').onkeydown=e=>{if(e.key==='Enter')$('sendChat').click()};
  $('sendPigeon').onclick=async()=>{try{await api('/api/platform/pigeon',{method:'POST',body:JSON.stringify({recipient_id:$('pigeonRecipient').value,content:$('pigeonText').value,anonymous:$('pigeonAnon').value==='true'})});$('pigeonText').value='';toast('تم إرسال الزاجل ✉️')}catch(e){toast(e.message)}};
  $('createGame').onclick=async()=>{if(!requireLogin())return;try{await api('/api/platform/games',{method:'POST',body:JSON.stringify({name:$('gameSelect').value,type:'room'})});toast('تم إنشاء الغرفة');games()}catch(e){toast(e.message)}};
  $('createCinema').onclick=async()=>{if(!requireLogin())return;try{await api('/api/platform/cinema',{method:'POST',body:JSON.stringify({title:$('cinemaTitle').value,media_url:$('cinemaUrl').value})});toast('تم إنشاء الجلسة');cinema()}catch(e){toast(e.message)}};
  $('createGroup').onclick=async()=>{if(!requireLogin())return;try{await api('/api/platform/groups',{method:'POST',body:JSON.stringify({name:$('groupName').value,description:$('groupDesc').value})});toast('تم إرسال طلب القروب للأونر');groups()}catch(e){toast(e.message)}};
  $('createTicket').onclick=async()=>{if(!requireLogin())return;try{await api('/api/platform/tickets',{method:'POST',body:JSON.stringify({subject:$('ticketSubject').value,content:$('ticketContent').value})});toast('تم فتح التذكرة');$('ticketSubject').value='';$('ticketContent').value='';tickets()}catch(e){toast(e.message)}};
  $('sendApplication').onclick=async()=>{if(!requireLogin())return;try{await api('/api/platform/applications',{method:'POST',body:JSON.stringify({discord_id:$('appDiscord').value,answers:{why:$('appWhy').value,experience:$('appExp').value}})});toast('تم إرسال التقديم للأونر')}catch(e){toast(e.message)}};
  $('sendReview').onclick=async()=>{if(!requireLogin())return;try{await api('/api/platform/reviews',{method:'POST',body:JSON.stringify({content:$('reviewText').value,rating:5})});$('reviewText').value='';toast('تمت إضافة رأيك');reviews()}catch(e){toast(e.message)}};
  $('addBot').onclick=async()=>{if(!requireLogin())return;try{await api('/api/bots',{method:'POST',body:JSON.stringify({name:$('botName').value,token:$('botToken').value,guild_id:$('botGuild').value})});$('botToken').value='';toast('تمت إضافة البوت');bots()}catch(e){toast(e.message)}};
  $('saveProfile').onclick=async()=>{try{const d=await api('/api/users/me',{method:'PATCH',body:JSON.stringify({username:$('profileName').value.trim()})});setUser(d.user);toast('تم الحفظ')}catch(e){toast(e.message)}};
  setAuthMode('login');setUser(user);
  if(token){try{const d=await api('/api/auth/me');setUser(d.user)}catch{logout(false)}}
  showPage('home',true);
}
document.addEventListener('click',async e=>{
  const t=e.target;
  if(t.classList.contains('join-game')){if(!requireLogin())return;try{await api('/api/platform/games/'+t.dataset.id+'/join',{method:'POST'});toast('انضممت للغرفة');games()}catch(x){toast(x.message)}}
  if(t.classList.contains('join-group')){if(!requireLogin())return;try{await api('/api/platform/groups/'+t.dataset.id+'/join',{method:'POST'});toast('تم إرسال طلب الانضمام')}catch(x){toast(x.message)}}
  if(t.classList.contains('close-ticket')){try{await api('/api/platform/tickets/'+t.dataset.id,{method:'PATCH',body:JSON.stringify({status:'closed'})});tickets()}catch(x){toast(x.message)}}
  if(t.classList.contains('app-status')){try{await api('/api/platform/applications/'+t.dataset.id,{method:'PATCH',body:JSON.stringify({status:t.dataset.status})});applications();toast('تم التحديث')}catch(x){toast(x.message)}}
  if(t.classList.contains('delete-review')){try{await api('/api/platform/reviews/'+t.dataset.id,{method:'DELETE'});reviews()}catch(x){toast(x.message)}}
  if(t.classList.contains('bot-toggle')){try{await api('/api/bots/'+t.dataset.id,{method:'PATCH',body:JSON.stringify({active:t.dataset.active==='true'})});bots()}catch(x){toast(x.message)}}
  if(t.classList.contains('user-role')){try{await api('/api/platform/users/'+t.dataset.id+'/role',{method:'PATCH',body:JSON.stringify({role:t.value})});toast('تم تغيير الصلاحية')}catch(x){toast(x.message)}}
  if(t.classList.contains('delete-user')){if(!confirm('حذف المستخدم؟'))return;try{await api('/api/platform/users/'+t.dataset.id,{method:'DELETE'});users()}catch(x){toast(x.message)}}
});
init();