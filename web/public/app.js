(() => {
'use strict';
const API='https://api-production-5bddb.up.railway.app';
let token=localStorage.getItem('token')||'';
let user=JSON.parse(localStorage.getItem('user')||'null');

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>new Intl.NumberFormat('ar-SA').format(Number(v)||0);
const protectedPages=[];
const ownerOnly=['owner-admin'];
const adminPages=['admin'];
const meta={
home:['🏠','الرئيسية','واجهة MLD الرئيسية'],
members:['👥','الأعضاء','استكشف أعضاء مجتمع MLD'],
top:['🏆','التوب','أعلى النشاط داخل المجتمع'],
leaders:['👑','الرتب القيادية','الرتب والأعضاء المرتبطون بها'],
chat:['💬','الشات العام','محادثة مجتمع MLD'],
pigeon:['✉️','الزاجل','رسائلك الخاصة'],
games:['🎮','الألعاب','جلسات اللعب والتحديات'],
cinema:['🎬','السينما','غرف مشاهدة جماعية'],
groups:['👨‍👩‍👧','القروبات','قروبات مرتبطة بمجتمع MLD'],
tickets:['🎫','التذاكر','الدعم ومتابعة الطلبات'],
applications:['📝','التقديم','طلبات الانضمام للإدارة'],
reviews:['⭐','الآراء','آراء وتجارب أعضاء المجتمع'],
bots:['🤖','منصة البوتات','إدارة بوتاتك'],
addbot:['➕','إضافة بوت','ربط بوت جديد'],
profile:['👤','بروفايلي','بيانات حسابك'],
admin:['','لوحة الإدارة','إدارة الحسابات والتذاكر'],'owner-admin':['','لوحة الأونر','التحكم الكامل بالمجتمع']
};
function toast(t){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}
async function api(path,opts={}){const r=await fetch(API+(path.startsWith('/')?path:'/ '+path).replace('/ ','/'),{...opts,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(opts.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok){if(r.status===401){logout(false)}throw new Error(d.error||'تعذر تنفيذ الطلب')}return d}
function logout(reload=true){localStorage.removeItem('token');localStorage.removeItem('user');token='';user=null;if(reload)location.hash='home';if(reload)location.reload()}
function authRequired(){if(!token||!user){$('#authScreen')?.classList.add('show');toast('هذه الصفحة تتطلب تسجيل الدخول');return false}return true}
function privileged(kind){const role=String(user?.role||'').toLowerCase();const adminRoles=new Set(['admin','co-owner','coowner','founder','senior staff','senior_staff','staff','junior staff','junior_staff']);return !!user&&(user.is_owner||role==='owner'||(kind==='admin'&&adminRoles.has(role)))}
function closeMenu(){window.closeAppMenu?.()}
function shell(p,body){const m=meta[p]||['✦',p,''];return '<section class="mld-page-shell"><header class="mld-page-head"><span class="mld-kicker">'+m[0]+' MLD COMMUNITY</span><h1>'+m[1]+'</h1><p>'+m[2]+'</p></header><div class="mld-page-body">'+body+'</div></section>'}
function card(title,body,actions=''){return '<article class="panel"><h3>'+title+'</h3><div class="muted">'+body+'</div>'+actions+'</article>'}

function syncUserUI(){
 $('#myName').textContent=user?.username||'زائر';
 $('#myRole').textContent=user?.is_owner?'الأونر 👑':(String(user?.role||'').toLowerCase()==='admin'?'إدارة 🛡️':'عضو');
 $('#homeAccount').textContent=user?.username||'زائر';
 const av=$('#myAvatar');if(av){av.innerHTML=user?.avatar?'<img src="'+esc(user.avatar)+'">':esc((user?.username||'ز').slice(0,2).toUpperCase())}
 const admin=privileged('admin'), owner=privileged('owner');
 if($('#adminSection'))$('#adminSection').style.display=admin?'block':'none';
 if($('#adminLink'))$('#adminLink').style.display=admin?'flex':'none';
 if($('#ownerSection'))$('#ownerSection').style.display=owner?'block':'none';
 if($('#ownerLink'))$('#ownerLink').style.display=owner?'flex':'none';
 if($('#applicationsLink'))$('#applicationsLink').style.display=owner?'flex':'none';
 document.querySelectorAll('#owner-menu-link').forEach(e=>e.style.display=owner?'flex':'none');
 document.querySelectorAll('#admin-menu').forEach(e=>e.style.display=admin?'block':'none');
 ['adminLink','ownerLink','applicationsLink'].forEach(id=>{const e=$('#'+id);if(e)e.setAttribute('aria-hidden',e.style.display==='none'?'true':'false')});
 if($('#logoutBtn'))$('#logoutBtn').style.display=user?'flex':'none';
 if($('#loginBtn'))$('#loginBtn').style.display=user?'none':'flex';
}

async function loadStats(){
 try{const d=await fetch(API+'/api/public/server',{cache:'no-store'}).then(r=>r.json());
  const set=(id,v)=>{const e=$('#'+id);if(e)e.textContent=v};
  set('homeServerName',d.name||'MLD');set('homeMemberCount',d.memberCount==null?'—':num(d.memberCount));set('homeOnlineCount',d.onlineCount==null?'—':num(d.onlineCount));set('homeVisits',d.visits==null?'—':num(d.visits));
 }catch{['homeMemberCount','homeOnlineCount','homeVisits'].forEach(id=>{if($('#'+id))$('#'+id).textContent='—'})}
}

function setPage(p){
 document.querySelectorAll('.is-busy').forEach(x=>x.classList.remove('is-busy'));
 if(p==='logout'){logout();return}
 if(!user && ['chat','pigeon','tickets','applications','bots','groups','reviews','cinema'].includes(p)){closeMenu();$('.page').forEach(x=>x.classList.remove('active'));const pg=$('#page-'+p);if(pg){pg.classList.add('active');$('.sidebar a[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===p));$('#pageTitle').textContent=(meta[p]||['',p,''])[1];renderGuest(p).catch(e=>{pg.innerHTML=shell(p,'<div class="mld-empty">تعذر تحميل الصفحة: '+esc(e.message)+'</div>')});window.scrollTo(0,0)}return}
 if(p==='login'){$('#authScreen')?.classList.add('show');return}
 if((adminPages.includes(p)||p==='owner-admin')&&!authRequired())return;
 if(ownerOnly.includes(p)&&!privileged('owner')){toast('هذه الصفحة للأونر فقط');return}
 if(adminPages.includes(p)&&!privileged('admin')){toast('هذه الصفحة للإدارة فقط');return}
 closeMenu();
 $$('.page').forEach(x=>x.classList.remove('active'));
 const page=$('#page-'+p);if(!page)return;
 page.classList.add('active');$('.sidebar a[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===p));window.scrollTo(0,0);
 $('#pageTitle').textContent=(meta[p]||['',p,''])[1];
 if(p==='home')return;
 render(p).catch(e=>{page.innerHTML=shell(p,'<div class="mld-empty">تعذر تحميل الصفحة: '+esc(e.message)+'</div>')});
}
async function renderGuest(p){
 const page=$('#page-'+p); if(!page)return;
 if(p==='chat'){
   const d=await fetch(API+'/api/community/chat',{cache:'no-store'}).then(r=>r.json());
   page.innerHTML=shell(p,'<div class="mld-stack">'+(d.messages||[]).map(x=>'<article class="message-card"><b>'+esc(x.sender_name||'عضو')+'</b><p>'+esc(x.content||'')+'</p></article>').join('')||'<div class="mld-empty">لا توجد رسائل بعد</div>')+'</div><div class="panel guest-action"><h3>💬 المشاركة</h3><p class="muted">تقدر تشوف الشات، وللإرسال سجّل دخول.</p><button class="btn-primary" onclick="document.getElementById(\'authScreen\')?.classList.add(\'show\')">سجّل دخول للإرسال</button></div>'); return;
 }
 if(p==='pigeon'){page.innerHTML=shell(p,'<div class="panel"><h3>✉️ الزاجل</h3><p class="muted">صفحة الرسائل الخاصة. محتوى الرسائل لا يظهر للزائر حفاظًا على الخصوصية.</p><button class="btn-primary" onclick="document.getElementById(\'authScreen\')?.classList.add(\'show\')">سجّل دخول للمتابعة</button></div>'); return;}
 if(p==='tickets'){page.innerHTML=shell(p,'<div class="panel"><h3>🎫 التذاكر</h3><p class="muted">تقدر تتعرف على نظام الدعم هنا. فتح التذكرة ومتابعة تذاكرك يتطلب تسجيل الدخول.</p><button class="btn-primary" onclick="document.getElementById(\'authScreen\')?.classList.add(\'show\')">سجّل دخول لفتح تذكرة</button></div>'); return;}
 if(p==='applications'){page.innerHTML=shell(p,'<div class="panel"><h3>📝 التقديم</h3><p class="muted">يمكنك معاينة نموذج التقديم. الإرسال متاح بعد تسجيل الدخول وبحسب صلاحيات الأونر.</p><textarea class="full" disabled placeholder="معاينة نموذج التقديم"></textarea><button class="btn-primary" onclick="document.getElementById(\'authScreen\')?.classList.add(\'show\')">سجّل دخول للمتابعة</button></div>'); return;}
 if(p==='bots'){
   const d=await fetch(API+'/api/bots/public',{cache:'no-store'}).then(r=>r.json());
   page.innerHTML=shell(p,'<div class="mld-bot-grid">'+(d.bots||[]).map(b=>'<article class="panel"><h3>🤖 '+esc(b.name)+'</h3><p class="muted">'+(b.active?'● نشط':'○ متوقف')+'</p><small class="muted">'+esc(b.watching||'MLD')+'</small></article>').join('')||'<div class="mld-empty">لا توجد بوتات مضافة بعد</div>')+'</div><div class="panel guest-action"><h3>➕ إضافة بوت</h3><p class="muted">إضافة البوت تتطلب تسجيل الدخول والتحقق من صلاحياتك في Discord.</p><button class="btn-primary" onclick="document.getElementById(\'authScreen\')?.classList.add(\'show\')">سجّل دخول للمتابعة</button></div>'); return;
 }
 if(['groups','reviews','cinema'].includes(p)){
   await render(p);
   const actionIds={groups:['groupCreate'],reviews:['reviewSend'],cinema:['cinemaCreate']}[p]||[];
   actionIds.forEach(id=>{const e=$('#'+id);if(e){e.disabled=true;e.title='سجّل دخول للمتابعة';e.textContent='🔒 سجّل دخول للمتابعة';e.onclick=()=>$('#authScreen')?.classList.add('show')}});
   return;
 }
}
async function render(p){
 const page=$('#page-'+p);if(!page)return;
 if(p==='games'){location.href='/games.html';return}
 if(p==='members'){const d=await fetch(API+'/api/public/members',{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-toolbar"><input id="memberSearch" class="full" placeholder="ابحث عن عضو..."><b>'+num((d.members||[]).length)+' عضو</b></div><div class="mld-member-grid">'+memberCards(d.members)+'</div>');$('#memberSearch').oninput=async e=>{const q=e.target.value.trim();const x=await fetch(API+'/api/public/members?q='+encodeURIComponent(q),{cache:'no-store'}).then(r=>r.json());page.querySelector('.mld-member-grid').innerHTML=memberCards(x.members)};return}
 if(p==='top'){const d=await fetch(API+'/api/public/top',{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,rankSections(d));return}
 if(p==='leaders'){const d=await fetch(API+'/api/public/roles',{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-role-grid">'+(d.roles||[]).map(r=>'<article class="panel"><div class="role-top"><b>'+num(r.membersCount)+' عضو</b></div><h3>'+esc(r.name)+'</h3><p class="muted">'+esc((r.permissions||[]).slice(0,4).join(' · ')||'صلاحيات عادية')+'</p></article>').join('')+'</div>');return}
 if(p==='chat'){page.innerHTML=shell(p,'<div id="chatList" class="mld-stack">جاري التحميل...</div><div class="mld-compose"><textarea id="chatText" class="full" placeholder="اكتب رسالتك..."></textarea><button id="chatSend" class="btn-primary">إرسال</button></div>');await loadChat();$('#chatSend').onclick=async()=>{const v=$('#chatText').value.trim();if(!v)return;await api('/api/community/chat',{method:'POST',body:JSON.stringify({content:v})});$('#chatText').value='';loadChat()};return}
 if(p==='pigeon'){page.innerHTML=shell(p,'<div class="panel"><input id="pigeonRecipient" class="full" placeholder="Discord ID / حساب المستلم"><textarea id="pigeonText" class="full" placeholder="اكتب الرسالة"></textarea><button id="pigeonSend" class="btn-primary">إرسال</button></div><div id="pigeonList" class="mld-stack"></div>');$('#pigeonSend').onclick=async()=>{await api('/api/community/pigeon',{method:'POST',body:JSON.stringify({recipient_id:$('#pigeonRecipient').value.trim(),content:$('#pigeonText').value.trim()})});toast('تم الإرسال ✓');loadPigeon()};await loadPigeon();return}
 if(p==='groups'){const d=await fetch(API+'/api/community/groups',{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-page-actions"><div class="mld-group-grid">'+(d.groups||[]).map(g=>'<article class="panel"><h3>'+esc(g.name)+'</h3><p class="muted">'+esc(g.description||'')+'</p><button class="btn-secondary" data-join="'+g.id+'">انضمام</button></article>').join('')+'</div></div><div class="panel group-create"><h3>إنشاء قروب</h3><input id="groupName" class="full" placeholder="اسم القروب"><textarea id="groupDesc" class="full" placeholder="الوصف"></textarea><button id="groupCreate" class="btn-primary">إرسال الطلب</button></div>');$$('[data-join]').forEach(b=>b.onclick=async()=>{if(!authRequired())return;await api('/api/community/groups/'+b.dataset.join+'/join',{method:'POST'});toast('تم إرسال طلب الانضمام ✓')});$('#groupCreate').onclick=async()=>{if(!authRequired())return;await api('/api/community/groups',{method:'POST',body:JSON.stringify({name:$('#groupName').value,description:$('#groupDesc').value})});toast('تم إرسال طلب القروب ✓');};return}
 if(p==='cinema'){const d=await fetch(API+'/api/community/cinema',{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-cinema-grid">'+(d.rooms||[]).map(x=>'<article class="panel"><h3>'+esc(x.title)+'</h3><p class="muted">'+esc(x.status)+'</p><video controls playsinline src="'+esc(x.media_url)+'"></video></article>').join('')+'</div><div class="panel"><h3>إنشاء غرفة</h3><input id="cinemaTitle" class="full" placeholder="اسم العرض"><input id="cinemaUrl" class="full" placeholder="رابط المحتوى"><button id="cinemaCreate" class="btn-primary">إنشاء</button></div>');$('#cinemaCreate').onclick=async()=>{if(!authRequired())return;await api('/api/community/cinema',{method:'POST',body:JSON.stringify({title:$('#cinemaTitle').value,media_url:$('#cinemaUrl').value})});toast('تم إنشاء الغرفة ✓');setPage('cinema')};return}
 if(p==='tickets'){page.innerHTML=shell(p,'<div class="panel"><input id="ticketSubject" class="full" placeholder="عنوان التذكرة"><textarea id="ticketContent" class="full" placeholder="اشرح مشكلتك"></textarea><button id="ticketCreate" class="btn-primary">فتح تذكرة</button></div><div id="ticketList" class="mld-stack"></div>');$('#ticketCreate').onclick=async()=>{await api('/api/community/tickets',{method:'POST',body:JSON.stringify({subject:$('#ticketSubject').value,content:$('#ticketContent').value})});toast('تم فتح التذكرة ✓');loadTickets()};await loadTickets();return}
 if(p==='applications'){page.innerHTML=shell(p,'<div class="panel"><p class="muted">التقديم متاح للأونر فقط.</p><textarea id="appAnswers" class="full" placeholder="اكتب طلبك"></textarea><button id="appSend" class="btn-primary">إرسال</button></div>');$('#appSend').onclick=async()=>{await api('/api/community/applications',{method:'POST',body:JSON.stringify({discord_id:user.discord_id,answers:{text:$('#appAnswers').value}})});toast('تم إرسال التقديم ✓')};return}
 if(p==='reviews'){const d=await fetch(API+'/api/community/reviews',{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-review-grid">'+(d.reviews||[]).map(x=>'<article class="panel"><b>'+esc(x.username)+'</b><div class="stars">★★★★★</div><p>'+esc(x.content)+'</p></article>').join('')+'</div><div class="panel"><textarea id="reviewText" class="full" placeholder="اكتب رأيك"></textarea><button id="reviewSend" class="btn-primary">إضافة رأي</button></div>');$('#reviewSend').onclick=async()=>{await api('/api/community/reviews',{method:'POST',body:JSON.stringify({content:$('#reviewText').value,rating:5})});toast('تمت إضافة رأيك ✓');setPage('reviews')};return}
 if(p==='profile'){page.innerHTML=shell(p,'<div class="panel"><label>اسم المستخدم</label><input id="profileName" class="full" value="'+esc(user.username)+'"><label>النبذة</label><textarea id="profileBio" class="full">'+esc(user.bio||'')+'</textarea><button id="profileSave" class="btn-primary">حفظ</button><hr><h3>الأمان</h3><input id="oldPass" class="full" type="password" placeholder="كلمة المرور الحالية"><input id="newPass" class="full" type="password" placeholder="كلمة المرور الجديدة"><button id="passSave" class="btn-secondary">تغيير كلمة المرور</button></div>');$('#profileSave').onclick=async()=>{const d=await api('/api/users/me',{method:'PATCH',body:JSON.stringify({username:$('#profileName').value,bio:$('#profileBio').value})});user=d.user||d;localStorage.setItem('user',JSON.stringify(user));syncUserUI();toast('تم الحفظ ✓')};$('#passSave').onclick=async()=>{await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({current_password:$('#oldPass').value,new_password:$('#newPass').value})});toast('تم تغيير كلمة المرور ✓')};return}
 if(p==='bots'){const d=await api('/api/bots');page.innerHTML=shell(p,'<div class="mld-bot-grid">'+(d.bots||[]).map(b=>'<article class="panel"><h3>🤖 '+esc(b.name)+'</h3><p class="muted">'+(b.active?'● نشط':'○ متوقف')+'</p><button class="btn-secondary" data-toggle="'+b.id+'">'+(b.active?'إيقاف':'تشغيل')+'</button></article>').join('')+'</div>');$$('[data-toggle]').forEach(b=>b.onclick=async()=>{await api('/api/bots/'+b.dataset.toggle+'/toggle',{method:'POST'});setPage('bots')});return}
 if(p==='addbot'){page.innerHTML=shell(p,'<div class="panel"><input id="botName" class="full" placeholder="اسم البوت"><input id="botToken" class="full" type="password" placeholder="Bot Token"><input id="botGuild" class="full" placeholder="Discord Server ID"><button id="botCreate" class="btn-primary">إضافة البوت</button><p class="muted">لا تشارك التوكن مع أي شخص.</p></div>');$('#botCreate').onclick=async()=>{await api('/api/bots',{method:'POST',body:JSON.stringify({name:$('#botName').value,token:$('#botToken').value,guild_id:$('#botGuild').value})});toast('تمت إضافة البوت ✓');setPage('bots')};return}
 if(p==='admin'||p==='owner-admin'){await renderAdmin(p);return}
}
function memberCards(a=[]){return a.map(m=>'<article class="mld-member"><img src="'+esc(m.avatar||'/logo.svg')+'" onerror="this.src=\'/logo.svg\'"><span><b>'+esc(m.name)+'</b><small>@'+esc(m.username||'')+'</small><em>'+esc((m.importantRoles||[]).slice(0,2).map(x=>x.name).join(' · ')||'عضو')+'</em></span></article>').join('')||'<div class="mld-empty">لا توجد نتائج</div>'}
function rankSections(d){const sec=(title,a,key,label)=>'<section class="panel"><h3>'+title+'</h3>'+((d[a]||[]).slice(0,10).map((x,i)=>'<div class="mld-rank"><i>'+String(i+1).padStart(2,'0')+'</i><img src="'+esc(x.avatar||'/logo.svg')+'"><span><b>'+esc(x.name)+'</b><small>'+label+'</small></span><strong>'+num(x.stats?.[key])+'</strong></div>').join('')||'<div class="mld-empty">لا توجد بيانات نشاط بعد</div>')+'</section>';return '<div class="mld-rank-grid">'+sec('💬 أكثر الرسائل','messages','messages','رسالة')+sec('💬 أكثر المنشنات','mentions','mentionsReceived','منشن')+sec('🎙️ وقت الصوت','voice','voiceMinutes','دقيقة')+sec('⚡ الدخول الصوتي','joins','voiceJoins','دخول')+'</div>'}
async function loadChat(){const d=await api('/api/community/chat');$('#chatList').innerHTML=(d.messages||[]).map(x=>'<article class="message-card"><b>'+esc(x.sender_name)+'</b><p>'+esc(x.content)+'</p></article>').join('')||'<div class="mld-empty">لا توجد رسائل</div>'}
async function loadPigeon(){const d=await api('/api/community/pigeon');$('#pigeonList').innerHTML=(d.messages||[]).map(x=>'<article class="message-card"><p>'+esc(x.content)+'</p></article>').join('')||'<div class="mld-empty">لا توجد رسائل</div>'}
async function loadTickets(){const d=await api('/api/community/tickets');$('#ticketList').innerHTML=(d.tickets||[]).map(x=>'<article class="message-card"><b>#'+x.id+' · '+esc(x.subject)+'</b><p>'+esc(x.status)+'</p></article>').join('')||'<div class="mld-empty">لا توجد تذاكر</div>'}
async function renderAdmin(p){const owner=p==='owner-admin';const d=await api('/api/users');let html='<div class="mld-admin-grid"><section class="panel"><h3>👥 الحسابات</h3><div id="usersAdmin">'+(d.users||[]).map(u=>'<div class="admin-row"><span><b>'+esc(u.username)+'</b><small>'+ (u.is_owner?'👑 أونر':u.role==='admin'?'🛡️ إدارة':'عضو')+'</small></span>'+((user.is_owner&&!u.is_owner)?'<button class="btn-secondary" data-admin="'+u.id+'" data-action="'+(u.role==='admin'?'remove':'add')+'">'+(u.role==='admin'?'إزالة الإدارة':'إضافة للإدارة')+'</button>':'')+'</div>').join('')+'</div></section><section class="panel"><h3>🎫 التذاكر</h3><div id="adminTickets">جاري...</div></section></div>';
if(owner)html+='<div class="mld-admin-grid"><section class="panel"><h3>📝 التقديم</h3><div id="ownerApps">جاري...</div></section><section class="panel"><h3>👨‍👩‍👧 القروبات</h3><div id="ownerGroups">جاري...</div></section></div><section class="panel"><h3>📋 سجل الأونر</h3><div id="ownerAudit">جاري...</div></section>';
$('#page-'+p).innerHTML=shell(p,html);
$$('[data-admin]').forEach(b=>b.onclick=async()=>{await api('/api/users/'+b.dataset.admin+'/admin',{method:'POST',body:JSON.stringify({action:b.dataset.action})});toast('تم تحديث الصلاحية ✓');setPage(p)});
const t=await api('/api/community/tickets');$('#adminTickets').innerHTML=(t.tickets||[]).map(x=>'<div class="admin-row"><span>#'+x.id+' · '+esc(x.subject)+'<small>'+esc(x.status)+'</small></span><button class="btn-secondary" onclick="claimTicket('+x.id+')">استلام</button></div>').join('')||'<div class="mld-empty">لا توجد تذاكر</div>';
if(owner){const [a,g,l]=await Promise.all([api('/api/community/applications'),api('/api/community/groups/all'),api('/api/community/audit')]);$('#ownerApps').innerHTML=(a.applications||[]).map(x=>'<div class="admin-row"><span>#'+x.id+' · '+esc(x.status)+'</span><button class="btn-secondary" onclick="ownerStatus('+x.id+',\'accepted\')">قبول</button><button class="btn-secondary" onclick="ownerStatus('+x.id+',\'rejected\')">رفض</button></div>').join('')||'<div class="mld-empty">لا توجد طلبات</div>';$('#ownerGroups').innerHTML=(g.groups||[]).map(x=>'<div class="admin-row"><span>'+esc(x.name)+'<small>'+esc(x.status)+'</small></span>'+(x.status==='pending'?'<button class="btn-secondary" onclick="groupStatus('+x.id+')">اعتماد</button>':'')+'</div>').join('')||'<div class="mld-empty">لا توجد طلبات</div>';$('#ownerAudit').innerHTML=(l.logs||[]).map(x=>'<div class="admin-row"><span>'+esc(x.action)+'<small>'+esc(x.actor_name||'')+' · '+esc(x.target||'')+'</small></span></div>').join('')||'<div class="mld-empty">لا يوجد سجل</div>'}}
window.claimTicket=async id=>{await api('/api/community/tickets/'+id+'/claim',{method:'POST'});toast('تم استلام التذكرة ✓');setPage(privileged('owner')?'owner-admin':'admin')};
window.ownerStatus=async(id,status)=>{await api('/api/community/applications/'+id+'/status',{method:'POST',body:JSON.stringify({status})});toast('تم تحديث الطلب ✓');setPage('owner-admin')};
window.groupStatus=async id=>{await api('/api/community/groups/'+id+'/status',{method:'POST',body:JSON.stringify({status:'approved'})});toast('تم اعتماد القروب ✓');setPage('owner-admin')};

function bindAuth(){
 $('#loginBtn')?.addEventListener('click',e=>{e.preventDefault();$('#authScreen').classList.add('show')});
 $('#topLoginBtn')?.addEventListener('click',()=>$('#authScreen').classList.add('show'));
 $$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');const reg=b.dataset.tab==='register';$('#discordField').style.display=reg?'block':'none';$('#submitBtn').textContent=reg?'تسجيل':'دخول';});
 $('#verifyDiscordBtn')?.addEventListener('click',async()=>{try{const d=await fetch(API+'/api/auth/verify-discord',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({discord_id:$('#discord_id').value.trim()})}).then(r=>r.json());if(d.error)throw Error(d.error);$('#verification_code').style.display='block';$('#authMsg').textContent='تم إرسال كود التحقق إلى Discord ✓'}catch(e){$('#authMsg').textContent=e.message}});
 $('#authForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const mode=$('.tabs button.active')?.dataset.tab||'login';const body={username:$('#username').value,password:$('#password').value};if(mode==='register')Object.assign(body,{discord_id:$('#discord_id').value,verification_code:$('#verification_code').value});const r=await fetch(API+'/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'تعذر الدخول');localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));token=d.token;user=d.user;$('#authScreen').classList.remove('show');syncUserUI();window.dispatchEvent(new Event('mld-auth-changed'));setTimeout(()=>{if(typeof applyAccess==='function')applyAccess();},0);setPage('home');toast('تم تسجيل الدخول ✓')}catch(e){$('#authMsg').textContent=e.message}});
 $('#logoutBtn')?.addEventListener('click',e=>{e.preventDefault();logout()});
}
function bindNav(){
 // Navigation is handled by the single controller below. Do not attach competing link handlers here.
 window.addEventListener('hashchange',()=>setPage((location.hash||'#home').slice(1)));
}
function boot(){syncUserUI();bindAuth();bindNav();loadStats();setInterval(loadStats,15000);const p=(location.hash||'#home').slice(1);setPage(meta[p]?p:'home')}
document.addEventListener('DOMContentLoaded',boot);
// Expose the real session and page controller to the legacy layers below this IIFE.
try {
  Object.defineProperty(window,'user',{configurable:true,get:()=>user,set:v=>{user=v;}});
  Object.defineProperty(window,'token',{configurable:true,get:()=>token,set:v=>{token=v;}});
} catch(e) { window.user=user; window.token=token; }
window.setPage=setPage;
window.mldSetPage=setPage;
window.toast=toast;
})();


/* MLD: single navigation + access controller */
(function(){
  'use strict';
  const adminRoles=new Set(['admin','co-owner','coowner','founder','senior staff','senior_staff','staff','junior staff','junior_staff']);
  const getUser=()=>window.user||null;
  const getToken=()=>window.token||localStorage.getItem('token')||'';
  const owner=()=>{const u=getUser();return !!u&&(!!u.is_owner||String(u.role||'').toLowerCase()==='owner')};
  const admin=()=>{const u=getUser();return owner()||adminRoles.has(String(u?.role||'').toLowerCase())};
  const close=()=>window.closeAppMenu?.();
  function applyAccess(){
    const logged=!!getUser()&&!!getToken();
    const show=(id,on,display='flex')=>{const e=document.getElementById(id);if(e)e.style.display=on?display:'none'};
    show('loginBtn',!logged);show('logoutBtn',logged);show('profileLink',logged);show('addbot',logged);
    show('adminLink',admin());show('ownerLink',owner());show('applicationsLink',true);
    const as=document.getElementById('adminSection'),os=document.getElementById('ownerSection');
    if(as)as.style.display=admin()?'block':'none';
    if(os)os.style.display=owner()?'block':'none';
    const profile=document.querySelector('[data-page="profile"]');
    const addbot=document.querySelector('[data-page="addbot"]');
    if(profile)profile.style.display=logged?'flex':'none';
    if(addbot)addbot.style.display=logged?'flex':'none';
    const name=document.getElementById('homeAccount');
    if(name)name.textContent=getUser()?.username||'زائر';
  }
  window.mldNavigate=function(page){
    const p=String(page||'home').replace(/^#/,'')||'home';
    if(p==='login'){close();document.getElementById('authScreen')?.classList.add('show');return;}
    if(p==='logout'){close();logout();return;}
    if(p==='owner-admin'&&!owner()){toast('هذه الصفحة للأونر فقط');close();return;}
    if(p==='admin'&&!admin()){toast('هذه الصفحة للإدارة فقط');close();return;}
    if(!document.getElementById('page-'+p)){toast('الصفحة غير موجودة');close();return;}
    close();
    if(location.hash!=='#'+p) history.pushState({page:p},'', '#'+p);
    setPage(p);
    document.querySelectorAll('.sidebar a[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===p));
  };
  function bindSingleNavigation(){
    document.addEventListener('click',e=>{
      const link=e.target.closest('.sidebar a[data-page], .app-brand, [data-page-link]');
      if(!link)return;
      e.preventDefault();
      e.stopPropagation();
      const p=link.dataset.page||'home';
      if(link.classList.contains('app-brand')){window.mldNavigate('home');return;}
      window.mldNavigate(p);
    },true);
    window.addEventListener('popstate',()=>setPage((location.hash||'#home').slice(1)));
    applyAccess();
  }
  window.applyAccess=applyAccess;
  document.addEventListener('DOMContentLoaded',bindSingleNavigation);
  window.addEventListener('mld-auth-changed',applyAccess);
  window.addEventListener('storage',e=>{if(e.key==='token'||e.key==='user')setTimeout(applyAccess,0)});
  setInterval(applyAccess,1500);
})();
