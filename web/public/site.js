(()=>{'use strict';
const API=(window.MLD_API||'https://api-production-5bddb.up.railway.app').replace(/\/$/,'');
let token=localStorage.getItem('token')||'',user=null;
try{user=JSON.parse(localStorage.getItem('user')||'null')}catch{}
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logged=()=>!!token&&!!user;
const owner=()=>!!user&&(user.is_owner===true||user.role==='owner');
const admin=()=>owner()||String(user?.role||'').toLowerCase()==='admin';
const toast=t=>{const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(window._toast);window._toast=setTimeout(()=>e.classList.remove('show'),2200)};
async function api(path,opt={}){const r=await fetch(API+path,{...opt,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(opt.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'تعذر الاتصال بالخدمة');return d}
function closeMenu(){$('#sidebar')?.classList.remove('open');$('#shade')?.classList.remove('show');document.body.style.overflow=''}
function openMenu(){$('#sidebar')?.classList.add('open');$('#shade')?.classList.add('show');document.body.style.overflow='hidden'}
function sync(){const name=user?.username||'زائر';if($('#topUser'))$('#topUser').textContent=name;if($('#sideName'))$('#sideName').textContent=name;if($('#sideRole'))$('#sideRole').textContent=owner()?'الأونر 👑':admin()?'إدارة 🛡️':logged()?'عضو':'زائر';if($('#sideAvatar'))$('#sideAvatar').textContent=name.slice(0,2);if($('#loginBtn'))$('#loginBtn').style.display=logged()?'none':'block';document.querySelectorAll('[data-member]').forEach(e=>e.style.display=logged()?'flex':'none');renderRoleLinks()}
function renderRoleLinks(){document.querySelectorAll('[data-role-admin]').forEach(e=>e.style.display=admin()?'flex':'none');document.querySelectorAll('[data-role-owner]').forEach(e=>e.style.display=owner()?'flex':'none')}
function openLogin(){$('#loginModal')?.classList.add('show');$('#loginModal')?.setAttribute('aria-hidden','false');setTimeout(()=>$('#username')?.focus(),80)}
function closeLogin(){$('#loginModal')?.classList.remove('show');$('#loginModal')?.setAttribute('aria-hidden','true')}
function card(icon,title,text,button=''){return '<article class="card"><div class="icon">'+icon+'</div><h3>'+title+'</h3><p>'+text+'</p>'+button+'</article>'}
function page(title,sub,body){return '<section class="page"><div class="page-head"><span>MLD · COMMUNITY</span><h1>'+title+'</h1><p>'+sub+'</p></div>'+body+'</section>'}
const pages={
home:()=>'<section class="hero"><div><span class="eyebrow">MLD · COMMUNITY</span><h1>مجتمع <em>ملاذ</em><br>بطريقة مختلفة.</h1><p>منصة مجتمع MLD المرتبطة بالديسكورد. اكتشف الأعضاء والرتب والتوب والخدمات في واجهة واحدة مرتبة.</p><div class="actions"><button class="primary" data-page="members">استكشف المجتمع</button><button class="btn" data-page="games">استكشف الألعاب</button></div><span class="hero-note">Discord Owner: <b>w4px</b></span></div><div class="hero-art"><div class="logo-orbit"><img src="/logo.svg.JPG"></div></div></section><section class="stats"><div class="stat"><b id="sMembers">—</b><span>أعضاء السيرفر</span></div><div class="stat"><b id="sOnline">—</b><span>متصلون الآن</span></div><div class="stat"><b id="sVisits">—</b><span>زيارات المنصة</span></div><div class="stat"><b>24/7</b><span>مجتمع MLD</span></div></section><section class="section"><span class="section-kicker">DISCOVER MLD</span><h2>كل شيء في مكان واحد</h2><div class="grid">'+card('◉','الأعضاء','تصفح أعضاء مجتمع MLD والبيانات العامة.','<button class="btn" data-page="members">الأعضاء</button>')+card('♛','التوب','تابع أفضل الأعضاء والنشاط والنقاط.','<button class="btn" data-page="top">التوب</button>')+card('✦','الرتب','تعرف على الرتب القيادية في المجتمع.','<button class="btn" data-page="roles">الرتب</button>')+'</div></section>',
members:()=>page('الأعضاء','أعضاء مجتمع MLD','<div id="memberList" class="grid"><div class="empty">جاري تحميل الأعضاء…</div></div>'),
top:()=>page('التوب','أفضل أعضاء المجتمع','<div id="topList" class="list"><div class="empty">جاري تحميل التوب…</div></div>'),
roles:()=>page('الرتب القيادية','رتب مجتمع MLD','<div class="grid">'+['👑 الأونر','💎 Co-Owner','🏅 Founder','🛡️ Senior Staff','🔰 Staff','🎖️ Junior Staff'].map(x=>card(x.slice(0,2),x.slice(2),'صلاحيات الرتبة مرتبطة بسيرفر الديسكورد.')).join('')+'</div>'),
chat:()=>page('الشات العام','أي شخص مسجل دخول يقدر يرسل هنا','<div class="chat-wrap"><div class="chat-head"><div><b>الشات العام</b><span>منطقة التراسل العامة لمجتمع MLD</span></div><button class="primary" id="privateBtn">＋ إنشاء خاص</button></div><div id="chatMessages" class="chat-messages"><div class="empty">جاري تحميل الرسائل…</div></div><form id="chatForm" class="chat-form"><input id="chatInput" maxlength="2000" placeholder="اكتب رسالتك..." autocomplete="off"><button class="primary">إرسال</button></form></div>'),
games:()=>page('الألعاب','أنظمة الألعاب ستُربط بالأنظمة التي سترسلها','<div class="grid">'+[['🎴','أونو','2–6 لاعبين'],['🎲','جاكارو','2–4 لاعبين'],['🎯','لودو','2–4 لاعبين'],['♠','بلوت','4 لاعبين'],['🕵','مافيا','4+ لاعبين'],['🏠','مونوبولي','2–6 لاعبين']].map(g=>card(g[0],g[1],g[2],'<button class="primary" data-game="'+g[1]+'">إنشاء جلسة</button>')).join('')+'</div>'),
groups:()=>page('القروبات','مجتمع القروبات','<div class="grid">'+card('◇','طلب قروب','أرسل طلب قروب مرتبط بالديسكورد.','<button class="btn" data-login-action>طلب جديد</button>')+card('◈','قروباتي','تابع القروبات التي تملكها أو انضممت إليها.')+card('🔗','Discord','القروبات المقبولة ترتبط بعناصر السيرفر.')+'</div>'),
cinema:()=>page('السينما','غرف مشاهدة جماعية','<div id="cinemaList" class="grid"><div class="empty">جاري تحميل الغرف…</div></div>'),
tickets:()=>page('التذاكر','الدعم والخدمات','<div class="grid">'+card('🎫','تذكرة جديدة','افتح تذكرة للدعم والمتابعة.','<button class="primary" data-action="ticket">فتح تذكرة</button>')+card('▤','تذاكري','تابع التذاكر المفتوحة والمغلقة.','<button class="btn" id="loadTickets">عرض التذاكر</button>')+'</div><div id="ticketList" class="list" style="margin-top:15px"></div>'),
reviews:()=>page('الآراء','آراء أعضاء MLD','<div id="reviewList" class="grid"><div class="empty">جاري تحميل الآراء…</div></div>'),
bots:()=>page('منصة البوتات','أدوات مجتمع MLD','<div id="botList" class="grid"><div class="empty">جاري تحميل البوتات…</div></div>'),
profile:()=>page('بروفايلي','حسابك في MLD','<div class="card" style="text-align:center"><div class="avatar" style="margin:auto">'+esc((user?.username||'ز').slice(0,2))+'</div><h2>'+esc(user?.username||'')+'</h2><p>'+esc(user?.role||'member')+'</p></div>'),
admin:()=>page('لوحة الإدارة','متاحة للأونر والإدارة فقط','<div id="adminPanel"><div class="empty">جاري تحميل لوحة الإدارة…</div></div>'),
owner:()=>page('لوحة الأونر','تحكم كامل بالموقع','<div id="ownerPanel"><div class="empty">جاري تحميل لوحة الأونر…</div></div>')
};
async function loadAnnouncement(){try{const d=await api('/api/community/announcement');const a=d.announcement;if(!a||!a.enabled||!a.text)return;let e=document.querySelector('#siteAnnouncement');if(!e){e=document.createElement('div');e.id='siteAnnouncement';e.style.cssText='position:sticky;top:0;z-index:60;text-align:center;padding:9px 14px;font-weight:700';document.body.prepend(e)}e.textContent=a.text;e.style.background=a.color||'#ff9cdc';e.style.color='#160d1d'}catch{}}
function go(p='home'){p=String(p).replace(/^#/,'');if(!pages[p])p='home';if(['chat','tickets','profile','admin','owner'].includes(p)&&!logged()){openLogin();return}if(p==='admin'&&!admin()){toast('لوحة الإدارة للإدارة والأونر فقط');return}if(p==='owner'&&!owner()){toast('لوحة الأونر للأونر فقط');return}history.replaceState(null,'','#'+p);closeMenu();$('#app').innerHTML=pages[p]();document.querySelectorAll('.sidebar nav a[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===p));if(p==='home')loadStats();if(p==='members')loadMembers();if(p==='top')loadTop();if(p==='chat')initChat();if(p==='cinema')loadCinema();if(p==='reviews')loadReviews();if(p==='bots')loadBots();if(p==='tickets')loadTickets();if(p==='admin')loadAdmin();if(p==='owner')loadOwner()}
async function loadStats(){try{const d=await api('/api/public/server');$('#sMembers').textContent=d.memberCount??'—';$('#sOnline').textContent=d.onlineCount??'—';$('#sVisits').textContent=d.visits??'—'}catch{}}
async function loadMembers(){const e=$('#memberList');try{const d=await api('/api/public/members');const a=d.members||d||[];e.innerHTML=a.slice(0,24).map(m=>'<article class="card member-card"><div class="avatar">'+(m.avatar?'<img src="'+esc(m.avatar)+'">':'👤')+'</div><h3>'+esc(m.displayName||m.username||'عضو')+'</h3><p>'+esc(m.role||'عضو')+'</p></article>').join('')||'<div class="empty">لا توجد بيانات حالياً.</div>'}catch{e.innerHTML='<div class="empty">تعذر تحميل الأعضاء من الـAPI حالياً.</div>'}}
async function loadTop(){const e=$('#topList');try{const d=await api('/api/public/top');const a=d.users||d.top||d||[];e.innerHTML=a.slice(0,20).map((x,i)=>'<div class="row"><b>#'+(i+1)+'</b><span>'+esc(x.username||x.name||'عضو')+'</span><strong>'+esc(x.points??x.score??0)+'</strong></div>').join('')||'<div class="empty">لا توجد بيانات توب حالياً.</div>'}catch{e.innerHTML='<div class="empty">تعذر تحميل التوب من الـAPI حالياً.</div>'}}
async function login(){const u=$('#username').value.trim(),p=$('#password').value;if(!u||!p)return toast('اكتب اسم المستخدم وكلمة المرور');$('#submitLogin').disabled=true;$('#loginError').textContent='';try{const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:u,password:p})});token=d.token||d.accessToken||'';user=d.user||d.account||null;if(!token||!user)throw Error('بيانات الدخول غير مكتملة');localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify(user));sync();closeLogin();toast('تم تسجيل الدخول');go('home')}catch(e){$('#loginError').textContent=e.message||'فشل تسجيل الدخول'}finally{$('#submitLogin').disabled=false}}
function logout(){token='';user=null;localStorage.removeItem('token');localStorage.removeItem('user');sync();go('home');toast('تم تسجيل الخروج')}
function chatRow(m){return '<div class="chat-msg"><div class="avatar">'+esc((m.sender_name||'ز').slice(0,2))+'</div><div><b>'+esc(m.sender_name||'عضو')+'</b><span>'+esc(m.content||'')+'</span></div></div>'}
async function initChat(){const box=$('#chatMessages');try{const d=await api('/api/community/chat');const a=d.messages||[];box.innerHTML=a.length?a.map(chatRow).join(''):'<div class="empty">لا توجد رسائل بعد. كن أول من يكتب.</div>';box.scrollTop=box.scrollHeight}catch{box.innerHTML='<div class="empty">تعذر تحميل الشات.</div>'}$('#chatForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!logged())return openLogin();const input=$('#chatInput'),content=input.value.trim();if(!content)return;try{const d=await api('/api/community/chat',{method:'POST',body:JSON.stringify({content})});input.value='';box.querySelector('.empty')?.remove();box.insertAdjacentHTML('beforeend',chatRow(d.message));box.scrollTop=box.scrollHeight}catch(err){toast(err.message)}});$('#privateBtn')?.addEventListener('click',async()=>{if(!logged())return openLogin();try{const d=await api('/api/users');const users=(d.users||[]).filter(x=>String(x.id)!==String(user.id));if(!users.length)return toast('لا يوجد أعضاء متاحون');const names=users.slice(0,30).map((x,i)=>(i+1)+'. '+x.username).join('\\n');const choice=prompt('اختر رقم العضو لإنشاء خاص:\\n'+names);const n=Number(choice)-1;if(!Number.isInteger(n)||!users[n])return;const target=users[n];const html='<div class="private-box card"><div class="chat-head"><div><b>خاص مع '+esc(target.username)+'</b><span>رسائل خاصة بينكما</span></div><button class="btn" id="closePrivate">إغلاق</button></div><div id="privateMessages" class="chat-messages"></div><form id="privateForm" class="chat-form"><input id="privateInput" maxlength="2000" placeholder="اكتب رسالة خاصة..."><button class="primary">إرسال</button></form></div>';box.innerHTML=html;const pm=$('#privateMessages');const loadPrivate=async()=>{const x=await api('/api/community/pigeon');const arr=(x.messages||[]).filter(m=>(String(m.sender_id)===String(user.id)&&String(m.recipient_id)===String(target.id))||(String(m.sender_id)===String(target.id)&&String(m.recipient_id)===String(user.id)));pm.innerHTML=arr.length?arr.map(m=>'<div class="chat-msg"><div class="avatar">'+esc((m.sender_id===user.id?user.username:target.username).slice(0,2))+'</div><div><b>'+esc(m.sender_id===user.id?user.username:target.username)+'</b><span>'+esc(m.content)+'</span></div></div>').join(''):'<div class="empty">لا توجد رسائل خاصة بعد.</div>';pm.scrollTop=pm.scrollHeight};await loadPrivate();$('#closePrivate')?.addEventListener('click',()=>initChat());$('#privateForm')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('#privateInput'),content=input.value.trim();if(!content)return;try{await api('/api/community/pigeon',{method:'POST',body:JSON.stringify({recipient_id:target.id,content})});input.value='';await loadPrivate()}catch(err){toast(err.message)}})}catch(e){toast(e.message||'تعذر إنشاء الخاص')}})}async function loadCinema(){try{const d=await api('/api/community/cinema');const a=d.rooms||[];$('#cinemaList').innerHTML=a.length?a.map(r=>card('▶',r.title||'غرفة مشاهدة','غرفة مشاهدة مشتركة','<button class="btn">دخول</button>')).join(''):'<div class="empty">لا توجد غرف مشاهدة حاليًا.</div>'}catch{}}
async function loadReviews(){try{const d=await api('/api/community/reviews');const a=d.reviews||[];$('#reviewList').innerHTML=a.length?a.map(r=>card('★',r.username||'عضو',esc(r.content||''),'★'.repeat(Number(r.rating||5)))).join(''):'<div class="empty">لا توجد آراء حاليًا.</div>'}catch{}}
async function loadBots(){try{const d=await api('/api/bots/public');const a=d.bots||[];$('#botList').innerHTML=a.length?a.map(b=>card('⚙',b.name||'بوت',b.active?'يعمل الآن':'متوقف')).join(''):'<div class="empty">لا توجد بوتات معروضة.</div>'}catch{}}
async function loadTickets(){const e=$('#ticketList');if(!e)return;try{const d=await api('/api/community/tickets');const a=d.tickets||[];e.innerHTML=a.length?a.map(t=>'<div class="row"><b>#'+t.id+'</b><span>'+esc(t.subject||'تذكرة')+'</span><strong>'+esc(t.status||'open')+'</strong></div>').join(''):'<div class="empty">لا توجد تذاكر.</div>'}catch(err){e.innerHTML='<div class="empty">'+esc(err.message)+'</div>'}}
async function loadAdmin(){
const box=$('#adminPanel');try{
const [t,a]=await Promise.all([api('/api/community/tickets'),api('/api/community/applications')]);
const tickets=t.tickets||[],apps=a.applications||[];
box.innerHTML='<div class="grid">'+
card('🎫','التذاكر','التذاكر المفتوحة: '+tickets.filter(x=>x.status!=='closed').length,'<button class="primary" data-admin-section="tickets">فتح التذاكر</button>')+
card('📝','التقديمات','طلبات الإدارة: '+apps.filter(x=>x.status==='pending').length,'<button class="primary" data-admin-section="applications">فتح التقديمات</button>')+
'</div><div id="adminSection" class="section" style="margin-top:15px"><div class="empty">اختر التذاكر أو التقديمات.</div></div>';
}catch(e){box.innerHTML='<div class="empty">تعذر تحميل لوحة الإدارة: '+esc(e.message)+'</div>'}}
async function showAdminTickets(){
const box=$('#adminSection');try{const d=await api('/api/community/tickets'),a=(d.tickets||[]).filter(x=>x.status!=='closed');
box.innerHTML='<h2>التذاكر المفتوحة</h2><div class="list">'+(a.length?a.map(x=>'<div class="row"><b>#'+x.id+'</b><span>'+esc(x.subject||'تذكرة')+'</span><button class="btn" data-ticket-open="'+x.id+'">فتح المحادثة</button></div>').join(''):'<div class="empty">لا توجد تذاكر مفتوحة.</div>')+'</div><div id="ticketThread" style="margin-top:15px"></div>';
}catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
async function showApplications(){
const box=$('#adminSection');try{const d=await api('/api/community/applications');const a=d.applications||[];
box.innerHTML='<h2>التقديمات</h2><div class="list">'+(a.length?a.map(x=>'<div class="row"><b>#'+x.id+' · '+esc(x.username||'عضو')+'</b><span>'+esc(x.status||'pending')+'</span>'+(x.status==='pending'?'<span><button class="btn" data-app-status="'+x.id+'" data-status="accepted">قبول</button> <button class="btn danger" data-app-status="'+x.id+'" data-status="rejected">رفض</button></span>':'')+'</div>').join(''):'<div class="empty">لا توجد تقديمات.</div>')+'</div>';
}catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
async function openTicketThread(id){
const box=$('#ticketThread');try{const d=await api('/api/community/tickets/'+id),t=d.ticket,m=d.messages||[];
box.innerHTML='<div class="card"><div class="chat-head"><div><b>تذكرة #'+t.id+' · '+esc(t.subject||'')+'</b><span>محادثة مباشرة مع '+esc(t.user_id)+'</span></div><button class="btn danger" data-ticket-close="'+id+'">إغلاق</button></div><div class="chat-messages" id="ticketMsgs">'+(m.length?m.map(chatRow).join(''):'<div class="empty">لا توجد ردود.</div>')+'</div><form id="ticketReplyForm" class="chat-form"><input id="ticketReplyInput" maxlength="2000" placeholder="اكتب ردك لصاحب التذكرة..."><button class="primary">إرسال</button></form></div>';
$('#ticketReplyForm')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('#ticketReplyInput'),content=input.value.trim();if(!content)return;await api('/api/community/tickets/'+id+'/messages',{method:'POST',body:JSON.stringify({content})});input.value='';openTicketThread(id)});
}catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}

async function loadOwner(){
const box=$('#ownerPanel');try{
const [u,l,b]=await Promise.all([api('/api/users'),api('/api/community/audit'),api('/api/community/owner/bot-subscriptions')]);const users=u.users||[],logs=l.logs||[],bots=b.bots||[];
box.innerHTML='<div class="grid">'+
card('📢','شريط الإعلان','تحكم بالنص واللون','<button class="primary" data-owner-section="announcement">إدارة الإعلان</button>')+
card('📣','برودكاست Discord','إرسال رسالة خاصة لأعضاء السيرفر','<button class="primary" data-owner-section="broadcast">إرسال رسالة</button>')+
card('👥','الحسابات',users.length+' حساب','<button class="primary" data-owner-section="accounts">إدارة الحسابات</button>')+
card('📋','اللوقات',logs.length+' عملية','<button class="primary" data-owner-section="logs">عرض اللوقات</button>')+
card('🤖','اشتراكات البوتات',bots.length+' بوت','<button class="primary" data-owner-section="subscriptions">إدارة الاشتراكات</button>')+
'</div><div id="ownerSection" class="section" style="margin-top:15px"><div class="empty">اختر قسمًا من لوحة الأونر.</div></div>';
}catch(e){box.innerHTML='<div class="empty">تعذر تحميل لوحة الأونر: '+esc(e.message)+'</div>'}}
async function ownerAnnouncement(){
const box=$('#ownerSection');const d=await api('/api/community/owner/announcement'),a=d.announcement||{};
box.innerHTML='<h2>شريط الإعلان</h2><div class="card"><label>النص<input id="annText" value="'+esc(a.text||'')+'"></label><label>اللون<input id="annColor" type="color" value="'+esc(a.color||'#ff9cdc')+'"></label><label><input id="annEnabled" type="checkbox" '+(a.enabled!==false?'checked':'')+'> مفعل</label><button class="primary" id="saveAnnouncement">حفظ</button></div>';
$('#saveAnnouncement')?.addEventListener('click',async()=>{await api('/api/community/owner/announcement',{method:'PATCH',body:JSON.stringify({text:$('#annText').value,color:$('#annColor').value,enabled:$('#annEnabled').checked})});toast('تم تحديث شريط الإعلان');loadAnnouncement()});
}
async function ownerBroadcast(){
const box=$('#ownerSection');box.innerHTML='<h2>برودكاست Discord</h2><div class="card"><textarea id="broadcastText" maxlength="2000" placeholder="اكتب الرسالة التي ستصل خاص للأعضاء..."></textarea><button class="primary" id="sendBroadcast">إرسال للأعضاء</button><p>سيتم تجاهل حسابات البوتات.</p></div>';
$('#sendBroadcast')?.addEventListener('click',async()=>{const content=$('#broadcastText').value.trim();if(!content)return toast('اكتب الرسالة');const d=await api('/api/community/owner/broadcast',{method:'POST',body:JSON.stringify({content})});toast(d.message||'بدأ الإرسال')});
}
async function ownerAccounts(){
const box=$('#ownerSection'),d=await api('/api/users'),users=d.users||[];
box.innerHTML='<h2>الحسابات</h2><div class="list">'+(users.map(x=>'<div class="row"><b>'+esc(x.username)+'</b><span>'+esc(x.role||'member')+'</span><span><button class="btn" data-account-view="'+x.id+'">المعلومات</button> <button class="btn" data-account-private="'+x.id+'">الخاص</button> '+(!x.is_owner?'<button class="btn" data-account-edit="'+x.id+'">تعديل</button> <button class="btn danger" data-account-delete="'+x.id+'">حذف</button>':'')+'</span></div>').join('')||'<div class="empty">لا توجد حسابات.</div>')+'</div><div id="accountDetail" style="margin-top:15px"></div>';
}
async function ownerAccountDetail(id){
const d=await api('/api/users/'+id+'/private');const u=d.user,m=d.messages||[];const box=$('#accountDetail');
box.innerHTML='<div class="card"><h2>'+esc(u.username)+'</h2><p>الدور: '+esc(u.role)+' · Discord: '+esc(u.discord_id||'غير مرتبط')+'</p><p>البايو: '+esc(u.bio||'')+'</p><div class="chat-messages">'+(m.length?m.map(chatRow).join(''):'<div class="empty">لا توجد رسائل خاصة.</div>')+'</div></div>';
}
async function ownerEditAccount(id){
const username=prompt('اسم المستخدم الجديد (اتركه كما هو إذا لا تريد تغييره):');if(username===null)return;
const avatar=prompt('رابط الصورة الجديدة:');if(avatar===null)return;const bio=prompt('البايو الجديد:');if(bio===null)return;
await api('/api/users/'+id,{method:'PATCH',body:JSON.stringify({username,avatar,bio})});toast('تم تعديل الحساب');ownerAccounts();
}
async function ownerSubscriptions(){
const box=$('#ownerSection'),d=await api('/api/community/owner/bot-subscriptions'),bots=d.bots||[];
box.innerHTML='<h2>اشتراكات البوتات</h2><div class="list">'+(bots.length?bots.map(b=>'<div class="row"><b>'+esc(b.name)+'</b><span>'+esc(b.expires_at?'ينتهي '+new Date(b.expires_at).toLocaleString('ar-SA'):'بدون اشتراك')+'</span><button class="btn" data-sub-bot="'+b.id+'">إعطاء اشتراك</button></div>').join(''):'<div class="empty">لا توجد بوتات.</div>')+'</div>';
}
document.addEventListener('click',e=>{
const p=e.target.closest('[data-page]');if(p){e.preventDefault();go(p.dataset.page);return}
if(e.target.closest('#menuBtn')){e.preventDefault();$('#sidebar')?.classList.contains('open')?closeMenu():openMenu();return}
if(e.target.closest('#shade')){closeMenu();return}
if(e.target.closest('#loginBtn')||e.target.closest('[data-login-action]')){openLogin();return}
if(e.target.closest('#closeLogin')){closeLogin();return}
if(e.target.closest('#submitLogin')){login();return}
if(e.target.closest('[data-action="logout"]')){logout();return}
if(e.target.closest('[data-game]')){if(!logged())openLogin();else toast('سيتم تشغيل '+e.target.closest('[data-game]').dataset.game+' من نظام الألعاب.');return}
if(e.target.closest('[data-action="ticket"]')){if(!logged())openLogin();else toast('تم فتح منطقة التذاكر');return}
const as=e.target.closest('[data-admin-section]');if(as){as.dataset.adminSection==='tickets'?showAdminTickets():showApplications();return}
const to=e.target.closest('[data-ticket-open]');if(to){openTicketThread(to.dataset.ticketOpen);return}
const tc=e.target.closest('[data-ticket-close]');if(tc){api('/api/community/tickets/'+tc.dataset.ticketClose+'/close',{method:'POST'}).then(()=>showAdminTickets()).catch(err=>toast(err.message));return}
const ap=e.target.closest('[data-app-status]');if(ap){api('/api/community/applications/'+ap.dataset.appStatus+'/status',{method:'POST',body:JSON.stringify({status:ap.dataset.status})}).then(()=>showApplications()).catch(err=>toast(err.message));return}
const os=e.target.closest('[data-owner-section]');if(os){
const k=os.dataset.ownerSection;
if(k==='announcement')ownerAnnouncement();else if(k==='broadcast')ownerBroadcast();else if(k==='accounts')ownerAccounts();else if(k==='logs')api('/api/community/audit').then(d=>$('#ownerSection').innerHTML='<h2>اللوقات</h2><div class="list">'+(d.logs||[]).map(x=>'<div class="row"><b>'+esc(x.actor_name||'')+'</b><span>'+esc(x.action||'')+'</span><small>'+esc(new Date(x.created_at).toLocaleString('ar-SA'))+'</small></div>').join('')+'</div>');else if(k==='subscriptions')ownerSubscriptions();return}
const av=e.target.closest('[data-account-view]');if(av){ownerAccountDetail(av.dataset.accountView);return}
const apr=e.target.closest('[data-account-private]');if(apr){ownerAccountDetail(apr.dataset.accountPrivate);return}
const ae=e.target.closest('[data-account-edit]');if(ae){ownerEditAccount(ae.dataset.accountEdit);return}
const ad=e.target.closest('[data-account-delete]');if(ad){if(confirm('حذف الحساب نهائيًا؟'))api('/api/users/'+ad.dataset.accountDelete,{method:'DELETE'}).then(()=>ownerAccounts()).catch(err=>toast(err.message));return}
const sb=e.target.closest('[data-sub-bot]');if(sb){const days=prompt('مدة الاشتراك بالأيام:','30');if(days)api('/api/community/owner/bot-subscriptions/'+sb.dataset.subBot,{method:'POST',body:JSON.stringify({days:Number(days)})}).then(()=>ownerSubscriptions()).catch(err=>toast(err.message));return}
});
$('#loginModal')?.addEventListener('click',e=>{if(e.target.id==='loginModal')closeLogin()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();closeLogin()}if(e.key==='Enter'&&document.activeElement===$('#password'))login()});
window.addEventListener('hashchange',()=>go(location.hash||'home'));
window.addEventListener('DOMContentLoaded',()=>{sync();loadAnnouncement();setTimeout(()=>$('#intro')?.classList.add('hide'),750);go(location.hash||'home')});
