"use strict";

const API="https://api-production-5bddb.up.railway.app";
let token=localStorage.getItem("token");
let user=JSON.parse(localStorage.getItem("user")||"null");

const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>new Intl.NumberFormat("ar-SA").format(Number(v)||0);

function toast(msg){
  const e=$("#toast"); if(!e)return;
  e.textContent=msg; e.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>e.classList.remove("show"),2600);
}
function isAdmin(){return !!user?.is_owner||["admin","owner"].includes(String(user?.role||"").toLowerCase())}
function isOwner(){return !!user?.is_owner}
function logged(){return !!token&&!!user}

async function api(path,opts={}){
  const r=await fetch(API+(path.startsWith("/")?path:"/"+path),{
    ...opts,
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+(token||""),...(opts.headers||{})},
    cache:"no-store"
  });
  let d={}; try{d=await r.json()}catch{}
  if(!r.ok) throw new Error(d.error||"تعذر تنفيذ الطلب");
  return d;
}

function openAuth(){ $("#authScreen")?.classList.add("show"); }
function closeMenu(){
  $("#sidebar")?.classList.remove("open");
  $("#appMenuBackdrop")?.classList.remove("show");
  document.body.classList.remove("app-menu-open");
  $("#menuBtn")?.setAttribute("aria-expanded","false");
}
function toggleMenu(e){
  e?.preventDefault();e?.stopPropagation();
  const s=$("#sidebar");if(!s)return;
  const open=!s.classList.contains("open");
  s.classList.toggle("open",open);
  $("#appMenuBackdrop")?.classList.toggle("show",open);
  document.body.classList.toggle("app-menu-open",open);
  $("#menuBtn")?.setAttribute("aria-expanded",String(open));
}
window.toggleAppMenu=toggleMenu;
window.closeAppMenu=closeMenu;

function setPage(page){
  if(["chat","pigeon","tickets","applications","bots","addbot","profile"].includes(page)&&!logged()){
    closeMenu();openAuth();toast("هذه الصفحة تتطلب تسجيل الدخول");return;
  }
  if(page==="applications"&&!isOwner()){toast("التقديم للإدارة متاح للأونر فقط");return;}
  if(page==="admin"&&!isAdmin()){toast("لوحة الإدارة للإدارة فقط");return;}
  if(page==="owner-admin"&&!isOwner()){toast("لوحة الأونر للأونر فقط");return;}
  if(page==="logout"){localStorage.clear();location.href="app.html#home";return;}
  if(page==="login"){openAuth();return;}

  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".sidebar a[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  const el=$("#page-"+page);
  if(!el)return;
  el.classList.add("active");
  $("#pageTitle").textContent=({
    home:"الرئيسية",members:"الأعضاء",top:"التوب",leaders:"الرتب القيادية",chat:"الشات العام",
    pigeon:"الزاجل",games:"الألعاب",cinema:"السينما",groups:"القروبات",tickets:"التذاكر",
    applications:"التقديم",reviews:"الآراء",bots:"منصة البوتات",addbot:"إضافة بوت",profile:"بروفايلي",
    admin:"لوحة الإدارة","owner-admin":"لوحة الأونر"
  })[page]||"MLD";
  location.hash=page;
  closeMenu();
  renderPage(page).catch(e=>{el.innerHTML=pageShell(page,"<div class='empty-state'><h3>تعذر تحميل الصفحة</h3><p>"+esc(e.message)+"</p></div>");});
}

function pageShell(page,body){
  const meta={
    home:["🏠","الرئيسية","واجهة MLD الرئيسية"],
    members:["👥","الأعضاء","استعرض أعضاء مجتمع MLD وابحث عن أي عضو"],
    top:["🏆","التوب","إحصائيات النشاط داخل المجتمع"],
    leaders:["👑","الرتب القيادية","الرتب وأعداد أعضائها"],
    chat:["💬","الشات العام","محادثة المجتمع"],
    pigeon:["✉️","الزاجل","رسائلك الخاصة داخل MLD"],
    games:["🎮","الألعاب","اختَر لعبة وأنشئ جلسة"],
    cinema:["🎬","السينما","غرف مشاهدة جماعية"],
    groups:["👨‍👩‍👧","القروبات","قروبات المجتمع المرتبطة بـ MLD"],
    tickets:["🎫","التذاكر","الدعم ومتابعة الطلبات"],
    applications:["📝","التقديم","طلبات الانضمام للإدارة"],
    reviews:["⭐","الآراء","آراء وتجارب أعضاء MLD"],
    bots:["🤖","منصة البوتات","إدارة بوتاتك"],
    addbot:["➕","إضافة بوت","ربط بوت جديد"],
    profile:["👤","بروفايلي","إدارة بيانات حسابك"],
    admin:["🛡️","لوحة الإدارة","إدارة التذاكر والحسابات المسموح بها"],
    "owner-admin":["👑","لوحة الأونر","التحكم الكامل بالمجتمع"]
  }[page]||["✦",page,""];
  return '<section class="mld-page-shell"><header class="mld-page-head"><span class="mld-kicker">'+meta[0]+' MLD COMMUNITY</span><h1>'+meta[1]+'</h1><p>'+meta[2]+'</p></header><div class="mld-page-body">'+body+"</div></section>";
}
const panel=(title,body)=>'<div class="panel"><h3>'+title+"</h3>"+body+"</div>";
const memberCard=m=>'<article class="mld-member"><img src="'+esc(m.avatar||"/logo.svg")+'" onerror="this.src=\'/logo.svg\'"><span><b>'+esc(m.name)+'</b><small>@'+esc(m.username||"")+'</small><em>'+((m.importantRoles||[]).slice(0,2).map(r=>esc(r.name)).join(" · ")||"عضو")+"</em></span></article>";

async function renderPage(p){
  const el=$("#page-"+p); if(!el)return;
  if(p==="home"){
    const d=await api("/api/public/server");
    el.innerHTML=pageShell(p,'<div class="page-grid three">'+panel("السيرفر","<strong class="metric">"+esc(d.name||"MLD")+"</strong><p class="muted">مجتمع MLD</p>")+panel("الأعضاء","<strong class="metric">"+num(d.memberCount)+"</strong><p class="muted">عضو في ديسكورد</p>")+panel("المتصلون الآن","<strong class="metric">"+num(d.onlineCount)+"</strong><p class="muted">متصل</p>")+"</div><div class="page-grid three" style="margin-top:16px">"+panel("الزيارات","<strong class="metric">"+num(d.visits)+"</strong><p class="muted">زيارات الموقع</p>")+panel("المنشئ","<strong class="metric">فهد المطيري</strong><p class="muted">@w4px</p>")+panel("الحالة","<strong class="metric online">● متصل</strong><p class="muted">Discord + API</p>")+"</div>");
    return;
  }
  if(p==="members"){
    const d=await fetch(API+"/api/public/members",{cache:"no-store"}).then(r=>r.json());
    el.innerHTML=pageShell(p,'<div class="toolbar-row"><input id="memberSearch" class="full" placeholder="ابحث بالاسم أو اليوزر..."><span>'+num(d.total||0)+' عضو</span></div><div id="memberGrid" class="mld-member-grid">'+(d.members||[]).map(memberCard).join("")+"</div>");
    $("#memberSearch").oninput=async e=>{const q=e.target.value.trim();const x=await fetch(API+"/api/public/members?q="+encodeURIComponent(q),{cache:"no-store"}).then(r=>r.json());$("#memberGrid").innerHTML=(x.members||[]).map(memberCard).join("")||'<div class="empty-state">لا توجد نتائج.</div>'};
    return;
  }
  if(p==="top"){
    const d=await fetch(API+"/api/public/top",{cache:"no-store"}).then(r=>r.json());
    const box=(title,list,key,label)=>'<div class="rank-box"><h3>'+title+'</h3>'+((list||[]).map((m,i)=>'<div class="rank-row"><i>'+String(i+1).padStart(2,"0")+'</i><img src="'+esc(m.avatar||"/logo.svg")+'"><span><b>'+esc(m.name)+'</b><small>'+label+'</small></span><strong>'+num(m.stats?.[key])+"</strong></div>").join("")||'<div class="empty-state">لا توجد بيانات نشاط بعد.</div>')+"</div>";
    el.innerHTML=pageShell(p,'<div class="page-grid">'+box("💬 أكثر الرسائل",d.messages,"messages","رسالة")+box("💬 أكثر المنشنات",d.mentions,"mentionsReceived","منشن")+box("🎙️ وقت الصوت",d.voice,"voiceMinutes","دقيقة")+box("⚡ دخول صوتي",d.joins,"voiceJoins","دخول")+"</div>");
    return;
  }
  if(p==="leaders"){
    const d=await fetch(API+"/api/public/roles",{cache:"no-store"}).then(r=>r.json());
    el.innerHTML=pageShell(p,'<div class="role-grid">'+(d.roles||[]).map(r=>'<article class="role-card"><div class="role-top"><i style="background:'+esc(r.color)+'"></i><b>'+num(r.membersCount)+' عضو</b></div><h3>'+esc(r.name)+'</h3><button class="btn-secondary" onclick="location.hash=\'leaders\'">عرض الرتبة</button></article>').join("")+"</div>");
    return;
  }
  if(p==="games"){
    const games=[["uno","🎴","أونو","2–6 لاعبين"],["baloot","♠️","بلوت","4 لاعبين"],["jaccaro","🎲","جاكارو","2–4 لاعبين"],["ludo","🎯","لودو","2–4 لاعبين"],["mafia","🕵️","مافيا","5+ لاعبين"],["monopoly","🏠","مونوبولي","2–6 لاعبين"],["codenames","🧩","كود نيمز","4+ لاعبين"],["roulette","🎡","روليت","2+ لاعبين"]];
    el.innerHTML=pageShell(p,'<div class="page-grid three">'+games.map(g=>'<article class="game-card"><div class="game-icon">'+g[1]+'</div><h3>'+g[2]+'</h3><p class="muted">'+g[3]+'</p><a class="btn-primary" href="game.html?type='+g[0]+'">فتح اللعبة</a></article>').join("")+"</div>");
    return;
  }
  if(p==="chat"){
    el.innerHTML=pageShell(p,'<div id="chatList" class="stack">جاري التحميل...</div><div class="composer"><input id="chatInput" class="full" placeholder="اكتب رسالتك..."><button id="chatSend" class="btn-primary">إرسال</button></div>');
    const load=async()=>{const d=await api("/api/community/chat");$("#chatList").innerHTML=(d.messages||[]).map(m=>'<div class="message-card"><b>'+esc(m.sender_name)+'</b><p>'+esc(m.content)+'</p></div>').join("")||'<div class="empty-state">لا توجد رسائل.</div>'};
    $("#chatSend").onclick=async()=>{const i=$("#chatInput");if(!i.value.trim())return;try{await api("/api/community/chat",{method:"POST",body:JSON.stringify({content:i.value.trim()})});i.value="";load()}catch(e){toast(e.message)}};await load();return;
  }
  if(p==="reviews"){
    const d=await fetch(API+"/api/community/reviews",{cache:"no-store"}).then(r=>r.json());
    el.innerHTML=pageShell(p,'<div id="reviewsList" class="page-grid">'+(d.reviews||[]).map(x=>panel("★ "+esc(x.username||"عضو"),"<p>"+esc(x.content)+"</p><small>"+num(x.rating)+"/5</small>")).join("")||'<div class="empty-state">لا توجد آراء.</div>'+"</div>"+(logged()?'<div class="panel" style="margin-top:16px"><textarea id="reviewText" class="full" placeholder="اكتب رأيك..."></textarea><button id="reviewSend" class="btn-primary">إضافة رأي</button></div>':""));
    $("#reviewSend")?.addEventListener("click",async()=>{try{await api("/api/community/reviews",{method:"POST",body:JSON.stringify({content:$("#reviewText").value,rating:5})});toast("تمت إضافة رأيك ✓");setPage("reviews")}catch(e){toast(e.message)}});
    return;
  }
  if(p==="groups"){
    const d=await fetch(API+"/api/community/groups",{cache:"no-store"}).then(r=>r.json());
    el.innerHTML=pageShell(p,'<div class="page-grid">'+(d.groups||[]).map(g=>panel(esc(g.name),"<p>"+esc(g.description||"")+"</p><button class="btn-secondary" onclick="joinGroup("+g.id+")">انضمام</button>")).join("")||'<div class="empty-state">لا توجد قروبات.</div>'+"</div>"+(logged()?'<div class="panel" style="margin-top:16px"><h3>إنشاء قروب</h3><input id="groupName" class="full" placeholder="اسم القروب"><textarea id="groupDesc" class="full" placeholder="الوصف"></textarea><button id="groupCreate" class="btn-primary">إرسال الطلب</button></div>':""));
    $("#groupCreate")?.addEventListener("click",async()=>{try{await api("/api/community/groups",{method:"POST",body:JSON.stringify({name:$("#groupName").value,description:$("#groupDesc").value})});toast("تم إرسال الطلب ✓");setPage("groups")}catch(e){toast(e.message)}});
    return;
  }
  if(p==="cinema"){
    const d=await fetch(API+"/api/community/cinema",{cache:"no-store"}).then(r=>r.json());
    el.innerHTML=pageShell(p,'<div class="page-grid">'+(d.rooms||[]).map(x=>panel("🎬 "+esc(x.title),"<p>"+esc(x.status||"مفتوحة")+"</p><video controls playsinline src=""+esc(x.media_url)+"" style="width:100%;border-radius:16px"></video>")).join("")||'<div class="empty-state">لا توجد غرف.</div>'+"</div>"+(logged()?'<div class="panel" style="margin-top:16px"><h3>إنشاء غرفة</h3><input id="cinemaTitle" class="full" placeholder="العنوان"><input id="cinemaUrl" class="full" placeholder="رابط المحتوى المصرح لك باستخدامه"><button id="cinemaCreate" class="btn-primary">إنشاء</button></div>':""));
    $("#cinemaCreate")?.addEventListener("click",async()=>{try{await api("/api/community/cinema",{method:"POST",body:JSON.stringify({title:$("#cinemaTitle").value,media_url:$("#cinemaUrl").value})});toast("تم إنشاء الغرفة ✓");setPage("cinema")}catch(e){toast(e.message)}});
    return;
  }
  if(p==="tickets"){
    el.innerHTML=pageShell(p,'<div class="panel"><input id="ticketSubject" class="full" placeholder="عنوان التذكرة"><textarea id="ticketContent" class="full" placeholder="اشرح مشكلتك"></textarea><button id="ticketCreate" class="btn-primary">فتح تذكرة</button></div><div id="ticketList" class="stack" style="margin-top:16px"></div>');
    const load=async()=>{const d=await api("/api/community/tickets");$("#ticketList").innerHTML=(d.tickets||[]).map(t=>'<div class="message-card"><b>#'+t.id+" · "+esc(t.subject)+"</b><p>"+esc(t.status)+"</p></div>").join("")||'<div class="empty-state">لا توجد تذاكر.</div>'};
    $("#ticketCreate").onclick=async()=>{try{await api("/api/community/tickets",{method:"POST",body:JSON.stringify({subject:$("#ticketSubject").value,content:$("#ticketContent").value})});toast("تم فتح التذكرة ✓");load()}catch(e){toast(e.message)}};await load();return;
  }
  if(p==="applications"){
    el.innerHTML=pageShell(p,'<div class="panel"><h3>التقديم للإدارة</h3><input id="appDiscord" class="full" placeholder="Discord ID"><textarea id="appAnswers" class="full" placeholder="اكتب إجاباتك"></textarea><button id="appSend" class="btn-primary">إرسال التقديم</button></div>');
    $("#appSend").onclick=async()=>{try{await api("/api/community/applications",{method:"POST",body:JSON.stringify({discord_id:$("#appDiscord").value,answers:{text:$("#appAnswers").value}})});toast("تم إرسال التقديم ✓")}catch(e){toast(e.message)}};return;
  }
  if(p==="pigeon"){
    el.innerHTML=pageShell(p,'<div class="panel"><input id="pigeonTo" class="full" placeholder="ID المستلم"><textarea id="pigeonText" class="full" placeholder="الرسالة"></textarea><button id="pigeonSend" class="btn-primary">إرسال</button></div><div id="pigeonList" class="stack" style="margin-top:16px"></div>');
    const load=async()=>{const d=await api("/api/community/pigeon");$("#pigeonList").innerHTML=(d.messages||[]).map(x=>'<div class="message-card"><p>'+esc(x.content)+"</p></div>").join("")||'<div class="empty-state">لا توجد رسائل.</div>'};
    $("#pigeonSend").onclick=async()=>{try{await api("/api/community/pigeon",{method:"POST",body:JSON.stringify({recipient_id:$("#pigeonTo").value,content:$("#pigeonText").value})});toast("تم الإرسال ✓");load()}catch(e){toast(e.message)}};await load();return;
  }
  if(p==="profile"){
    el.innerHTML=pageShell(p,'<div class="panel"><label>اسم المستخدم</label><input id="profileName" class="full" value="'+esc(user?.username||"")+'"><label>النبذة</label><textarea id="profileBio" class="full">'+esc(user?.bio||"")+'</textarea><button id="profileSave" class="btn-primary">حفظ التغييرات</button></div>');
    $("#profileSave").onclick=async()=>{try{const d=await api("/api/users/me",{method:"PATCH",body:JSON.stringify({username:$("#profileName").value.trim(),bio:$("#profileBio").value.trim()})});user=d.user;localStorage.setItem("user",JSON.stringify(user));syncUI();toast("تم الحفظ ✓")}catch(e){toast(e.message)}};return;
  }
  if(p==="bots"){
    const d=await api("/api/bots");
    el.innerHTML=pageShell(p,'<div class="page-grid">'+(d.bots||[]).map(b=>panel("🤖 "+esc(b.name),"<p>السيرفر: "+esc(b.guild_id||"—")+"</p><p>الحالة: "+(b.active?"🟢 نشط":"🔴 متوقف")+"</p><button class="btn-secondary" onclick="toggleBot('"+esc(b.id)+"')">"+(b.active?"إيقاف":"تشغيل")+"</button>")).join("")||'<div class="empty-state">لا توجد بوتات.</div>'+"</div>");
    return;
  }
  if(p==="addbot"){
    el.innerHTML=pageShell(p,'<div class="panel"><input id="botName" class="full" placeholder="اسم البوت"><input id="botToken" class="full" type="password" placeholder="Bot Token"><input id="botGuild" class="full" placeholder="Discord Server ID"><button id="botCreate" class="btn-primary">إضافة البوت</button><p id="botMsg"></p></div>');
    $("#botCreate").onclick=async()=>{try{await api("/api/bots",{method:"POST",body:JSON.stringify({name:$("#botName").value,token:$("#botToken").value,guild_id:$("#botGuild").value})});toast("تمت إضافة البوت ✓");setPage("bots")}catch(e){$("#botMsg").textContent=e.message}};return;
  }
  if(p==="admin"){return renderAdmin(el,false)}
  if(p==="owner-admin"){return renderAdmin(el,true)}
}

async function renderAdmin(el,ownerPanel){
  if(!isAdmin())throw Error("غير مصرح");
  const users=await api("/api/users");
  let body='<div class="page-grid"><div class="panel"><h3>👥 الحسابات</h3><div class="stack">'+(users.users||[]).map(u=>'<div class="message-card"><b>'+esc(u.username)+'</b><p>'+((u.is_owner)?"👑 أونر":u.role==="admin"?"🛡️ إدارة":"عضو")+'</p>'+(!u.is_owner&&isOwner()?'<button class="btn-secondary" onclick="setAdmin(\''+esc(u.id)+'\',\''+(u.role==="admin"?"remove":"add")+'\')">'+(u.role==="admin"?"إزالة الإدارة":"تعيين كإداري")+"</button>":"")+"</div>").join("")+"</div></div>";
  const tickets=await api("/api/community/tickets");
  body+='<div class="panel"><h3>🎫 التذاكر</h3><div class="stack">'+(tickets.tickets||[]).map(t=>'<div class="message-card"><b>#'+t.id+" · "+esc(t.subject)+"</b><p>"+esc(t.status)+"</p>"+(t.status!=="closed"?"<button class="btn-secondary" onclick="claimTicket('"+t.id+"')">استلام</button> <button class="btn-secondary" onclick="closeTicket('"+t.id+"')">إغلاق</button>":"")+"</div>").join("")||'<div class="empty-state">لا توجد تذاكر.</div>'+"</div></div></div>";
  if(ownerPanel){
    const apps=await api("/api/community/applications"), groups=await api("/api/community/groups/all"), audit=await api("/api/community/audit");
    body+='<div class="panel" style="margin-top:16px"><h3>📝 التقديم</h3><div class="stack">'+(apps.applications||[]).map(a=>'<div class="message-card"><b>#'+a.id+"</b><p>"+esc(a.status)+" · "+esc(a.discord_id||"—")+'</p><button class="btn-secondary" onclick="applicationStatus(''+a.id+"','accepted')">قبول</button> <button class="btn-secondary" onclick="applicationStatus('"+a.id+"','rejected')">رفض</button></div>").join("")||'<div class="empty-state">لا توجد طلبات.</div>'+"</div></div>";
    body+='<div class="panel" style="margin-top:16px"><h3>👨‍👩‍👧 القروبات</h3><div class="stack">'+(groups.groups||[]).map(g=>'<div class="message-card"><b>'+esc(g.name)+'</b><p>'+esc(g.status)+'</p>'+((g.status==="pending")?'<button class="btn-secondary" onclick="groupStatus(\''+g.id+"','approved')">اعتماد</button>":"")+"</div>").join("")||'<div class="empty-state">لا توجد طلبات.</div>'+"</div></div>";
    body+='<div class="panel" style="margin-top:16px"><h3>📋 سجل الأونر</h3><div class="stack">'+(audit.logs||[]).map(x=>'<div class="message-card"><b>'+esc(x.action)+'</b><p>'+esc(x.actor_name||"")+" · "+esc(x.target||"")+"</p></div>").join("")||'<div class="empty-state">لا يوجد سجل.</div>'+"</div></div>";
  }
  el.innerHTML=pageShell(ownerPanel?"owner-admin":"admin",body);
}

window.setAdmin=async(id,action)=>{try{const d=await api("/api/users/"+id+"/admin",{method:"POST",body:JSON.stringify({action})});toast(d.message||"تم");setPage("admin")}catch(e){toast(e.message)}};
window.claimTicket=async id=>{try{await api("/api/community/tickets/"+id+"/claim",{method:"POST"});toast("تم استلام التذكرة ✓");setPage("admin")}catch(e){toast(e.message)}};
window.closeTicket=async id=>{try{await api("/api/community/tickets/"+id+"/close",{method:"POST"});toast("تم إغلاق التذكرة ✓");setPage("admin")}catch(e){toast(e.message)}};
window.applicationStatus=async(id,status)=>{try{await api("/api/community/applications/"+id+"/status",{method:"POST",body:JSON.stringify({status})});toast("تم تحديث التقديم ✓");setPage("owner-admin")}catch(e){toast(e.message)}};
window.groupStatus=async(id,status)=>{try{await api("/api/community/groups/"+id+"/status",{method:"POST",body:JSON.stringify({status})});toast("تم تحديث القروب ✓");setPage("owner-admin")}catch(e){toast(e.message)}};
window.joinGroup=async id=>{if(!logged()){openAuth();return}try{await api("/api/community/groups/"+id+"/join",{method:"POST"});toast("تم الانضمام ✓")}catch(e){toast(e.message)}};
window.toggleBot=async id=>{try{await api("/api/bots/"+id+"/toggle",{method:"POST"});toast("تم تحديث البوت ✓");setPage("bots")}catch(e){toast(e.message)}};

function syncUI(){
  $("#myName").textContent=user?.username||"زائر";
  $("#myRole").textContent=isOwner()?"الأونر 👑":isAdmin()?"إدارة 🛡️":"عضو";
  const av=$("#myAvatar");if(av){av.innerHTML=user?.avatar?'<img src="'+esc(user.avatar)+'">':esc((user?.username||"ز").slice(0,2).toUpperCase())}
  $("#logoutBtn").style.display=logged()?"flex":"none";
  $("#loginBtn").style.display=logged()?"none":"flex";
  $("#adminSection").style.display=isAdmin()?"block":"none";
  $("#ownerSection").style.display=isOwner()?"block":"none";
  $("#applicationsLink").style.display=isOwner()?"flex":"none";
}
function bindAuth(){
  const auth=$("#authScreen"), form=$("#authForm"), tabs=document.querySelectorAll(".tabs button"), discordField=$("#discordField"), submit=$("#submitBtn"), msg=$("#authMsg");
  let mode="login";
  tabs.forEach(b=>b.onclick=()=>{mode=b.dataset.tab;tabs.forEach(x=>x.classList.toggle("active",x===b));discordField.style.display=mode==="register"?"block":"none";submit.textContent=mode==="register"?"تسجيل":"دخول"});
  $("#verifyDiscordBtn")?.addEventListener("click",async()=>{try{const id=$("#discord_id").value.trim();if(!id)throw Error("اكتب Discord ID");await fetch(API+"/api/auth/verify-discord",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({discord_id:id})});msg.textContent="تم إرسال كود التحقق إلى الخاص في Discord ✓";msg.className="msg show success";$("#verification_code").style.display="block"}catch(e){msg.textContent=e.message;msg.className="msg show error"}});
  form.onsubmit=async e=>{e.preventDefault();try{const d=await fetch(API+"/api/auth/"+mode,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:$("#username").value.trim(),password:$("#password").value,discord_id:$("#discord_id").value.trim(),verification_code:$("#verification_code")?.value.trim()||""})});const x=await d.json();if(!d.ok)throw Error(x.error||"خطأ");token=x.token;user=x.user;localStorage.setItem("token",token);localStorage.setItem("user",JSON.stringify(user));auth.classList.remove("show");syncUI();setPage("home");toast("تم تسجيل الدخول ✓")}catch(e){msg.textContent=e.message;msg.className="msg show error"}};
  $("#loginBtn").onclick=openAuth;
  $("#topLoginBtn").onclick=openAuth;
}
function init(){
  syncUI();bindAuth();
  $("#menuBtn").addEventListener("click",toggleMenu);
  $("#appMenuBackdrop").addEventListener("click",closeMenu);
  document.querySelectorAll(".sidebar a[data-page]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();setPage(a.dataset.page)}));
  const requested=(location.hash||"#home").slice(1)||"home";
  setPage(requested);
}
window.addEventListener("hashchange",()=>{const p=(location.hash||"#home").slice(1)||"home";if(p!== "home")setPage(p)});
window.addEventListener("resize",()=>{if(innerWidth>900)closeMenu()});
init();
