"use strict";

const API = "https://api-production-5bddb.up.railway.app";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

let token = localStorage.getItem("token") || "";
let user = null;
try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch { user = null; }

const META = {
  home:["🏠","الرئيسية","مركز مجتمع MLD"],
  members:["👥","الأعضاء","أعضاء السيرفر والبحث المباشر"],
  top:["🏆","التوب","ترتيب النشاط داخل المجتمع"],
  leaders:["👑","الرتب القيادية","الرتب المهمة وأعضاءها"],
  chat:["💬","الشات العام","محادثة أعضاء MLD"],
  pigeon:["✉️","الزاجل","رسائلك الخاصة"],
  games:["🎮","الألعاب","جلسات اللعب والألعاب الجماعية"],
  cinema:["🎬","السينما","غرف المشاهدة الجماعية"],
  groups:["👨‍👩‍👧","القروبات","قروبات مرتبطة بمجتمع MLD"],
  tickets:["🎫","التذاكر","الدعم والمتابعة"],
  applications:["📝","التقديم","التقديم للإدارة — للأونر"],
  reviews:["⭐","الآراء","آراء وتجارب أعضاء المجتمع"],
  bots:["🤖","منصة البوتات","إدارة بوتاتك"],
  addbot:["➕","إضافة بوت","ربط بوت جديد"],
  profile:["👤","بروفايلي","بيانات الحساب والأمان"],
  admin:["🛡️","لوحة الإدارة","إدارة الحسابات والتذاكر"],
  "owner-admin":["👑","لوحة الأونر","التحكم الكامل بالمجتمع"]
};

const protectedPages = new Set(["chat","pigeon","tickets","bots","addbot","profile"]);
const ownerOnlyPages = new Set(["applications","owner-admin"]);

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const num = v => new Intl.NumberFormat("ar-SA").format(Number(v) || 0);
const logged = () => !!token && !!user;
const owner = () => !!user?.is_owner;
const admin = () => owner() || ["admin","owner"].includes(String(user?.role || "").toLowerCase());

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__mldToast);
  window.__mldToast = setTimeout(() => el.classList.remove("show"), 2800);
}

function openAuth() { $("#authScreen")?.classList.add("show"); }
function closeAuth() { $("#authScreen")?.classList.remove("show"); }

async function api(path, opts={}) {
  const headers = { "Content-Type":"application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(/^https?:\/\//.test(path) ? path : API + (path.startsWith("/") ? path : "/" + path), { ...opts, headers, cache: opts.cache || "no-store" });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || "تعذر تنفيذ الطلب");
  return data;
}

function closeMenu() {
  $("#sidebar")?.classList.remove("open");
  $("#appMenuBackdrop")?.classList.remove("show");
  document.body.classList.remove("app-menu-open");
  $("#menuBtn")?.setAttribute("aria-expanded","false");
}
window.closeAppMenu = closeMenu;
window.toggleAppMenu = function(e) {
  e?.preventDefault(); e?.stopPropagation();
  const open = !$("#sidebar")?.classList.contains("open");
  if (open) {
    $("#sidebar")?.classList.add("open");
    $("#appMenuBackdrop")?.classList.add("show");
    document.body.classList.add("app-menu-open");
    $("#menuBtn")?.setAttribute("aria-expanded","true");
  } else closeMenu();
  return false;
};

function syncUI() {
  $("#myName").textContent = user?.username || "زائر";
  $("#myRole").textContent = owner() ? "الأونر 👑" : admin() ? "إدارة 🛡️" : logged() ? "عضو" : "تصفح عام";
  const avatar = $("#myAvatar");
  if (avatar) avatar.innerHTML = user?.avatar ? '<img src="'+esc(user.avatar)+'" alt="">' : esc((user?.username || "ز").slice(0,2).toUpperCase());

  if ($("#logoutBtn")) $("#logoutBtn").style.display = logged() ? "flex" : "none";
  if ($("#loginBtn")) $("#loginBtn").style.display = logged() ? "none" : "flex";
  if ($("#adminSection")) $("#adminSection").style.display = admin() ? "block" : "none";
  if ($("#ownerSection")) $("#ownerSection").style.display = owner() ? "block" : "none";
  if ($("#applicationsLink")) $("#applicationsLink").style.display = owner() ? "flex" : "none";
  if ($("#homeAccount")) $("#homeAccount").textContent = user?.username || "زائر";
}

function shell(page, body, extra="") {
  const m = META[page] || ["✦",page,""];
  return '<section class="mld-page-shell page-specific page-'+esc(page)+'">'+
    '<header class="mld-page-head"><div><span class="mld-kicker">'+m[0]+' MLD COMMUNITY</span><h1>'+m[1]+'</h1><p>'+m[2]+'</p></div>'+extra+'</header>'+
    '<div class="mld-page-body">'+body+'</div></section>';
}

function panel(title, body, cls="") {
  return '<article class="panel '+cls+'"><h3>'+title+'</h3>'+body+'</article>';
}

function empty(text="لا توجد بيانات حالياً.") {
  return '<div class="empty-state"><strong>'+esc(text)+'</strong><span>ستظهر البيانات هنا تلقائياً عند توفرها.</span></div>';
}

function requireLogin() {
  if (logged()) return true;
  closeMenu();
  toast("هذه الصفحة تتطلب تسجيل الدخول");
  openAuth();
  return false;
}

function allowed(page) {
  if (ownerOnlyPages.has(page)) return owner();
  if (page === "admin") return admin();
  if (protectedPages.has(page)) return logged();
  return true;
}

async function loadHome(page) {
  let d;
  try { d = await api("/api/public/server"); } catch { d = {name:"MLD",memberCount:null,onlineCount:null,visits:0}; }
  page.innerHTML = shell("home",
    '<div class="page-grid three">'+
      panel("🌐 السيرفر",'<strong class="metric">'+esc(d.name || "MLD")+'</strong><p class="muted">مجتمع MLD على Discord</p>')+
      panel("👥 الأعضاء",'<strong class="metric">'+(d.memberCount==null?"—":num(d.memberCount))+'</strong><p class="muted">عضو في السيرفر</p>')+
      panel("🟢 المتصلون",'<strong class="metric">'+(d.onlineCount==null?"—":num(d.onlineCount))+'</strong><p class="muted">متصل الآن</p>')+
    '</div><div class="page-grid three page-gap">'+
      panel("👁️ الزيارات",'<strong class="metric">'+num(d.visits)+'</strong><p class="muted">زيارات الموقع</p>')+
      panel("👑 المنشئ",'<strong class="metric">فهد المطيري</strong><p class="muted">@w4px</p>')+
      panel("⚡ الحالة",'<strong class="metric online">'+(d.memberCount==null?"● غير متاح":"● متصل")+'</strong><p class="muted">Discord + API</p>')+
    '</div><div class="page-grid two page-gap">'+
      panel("ابدأ من هنا",'<p class="muted">تصفح الأعضاء والتوب والرتب والألعاب والسينما والقروبات بدون تسجيل. الخدمات الخاصة تظهر بعد تسجيل الدخول.</p><div class="quick-actions"><a class="btn-primary" href="#members">استكشف الأعضاء</a><a class="btn-secondary" href="#games">افتح الألعاب</a></div>')+
      panel("حسابك",'<p class="muted">'+(logged()?"أنت مسجل باسم <b>"+esc(user.username)+"</b>.":"أنت تتصفح كزائر.")+'</p><button class="btn-primary" id="homeAuth">'+(logged()?"بروفايلي":"دخول المنصة")+'</button>')+
    '</div>'
  );
  $("#homeAuth")?.addEventListener("click",()=>logged()?setPage("profile"):openAuth());
}

async function loadMembers(page) {
  page.innerHTML = shell("members",'<div class="toolbar-row"><input id="memberSearch" class="full" placeholder="ابحث بالاسم أو اليوزر أو ID"><span id="memberTotal">جاري...</span></div><div id="memberGrid" class="mld-member-grid"></div>');
  const render = d => {
    $("#memberTotal").textContent = num(d.total || (d.members||[]).length) + " عضو";
    $("#memberGrid").innerHTML = (d.members||[]).map(m =>
      '<article class="mld-member"><img src="'+esc(m.avatar || "/logo.svg")+'" onerror="this.src=\'/logo.svg\'"><span><b>'+esc(m.name)+'</b><small>@'+esc(m.username||"")+'</small><em>'+((m.importantRoles||[]).slice(0,3).map(r=>esc(r.name)).join(" · ") || "عضو")+'</em></span></article>'
    ).join("") || empty("لا توجد نتائج");
  };
  try { render(await api("/api/public/members")); } catch { $("#memberGrid").innerHTML=empty("تعذر تحميل الأعضاء"); }
  let timer;
  $("#memberSearch").oninput = e => {
    clearTimeout(timer); const q=e.target.value.trim();
    timer=setTimeout(async()=>{ try { render(await api("/api/public/members?q="+encodeURIComponent(q))); } catch {} },220);
  };
}

async function loadTop(page) {
  try {
    const d=await api("/api/public/top");
    const rank=(title,list,key,label)=>'<article class="rank-box"><h3>'+title+'</h3>'+
      ((list||[]).map((m,i)=>'<div class="rank-row"><i>'+String(i+1).padStart(2,"0")+'</i><img src="'+esc(m.avatar||"/logo.svg")+'"><span><b>'+esc(m.name)+'</b><small>'+label+'</small></span><strong>'+num(m.stats?.[key])+'</strong></div>').join("") || empty("لا توجد إحصائيات بعد"))+'</article>';
    page.innerHTML=shell("top",'<div class="page-grid">'+rank("💬 أكثر الرسائل",d.messages,"messages","رسالة")+rank("📣 أكثر المنشنات",d.mentions,"mentionsReceived","منشن")+rank("🎙️ وقت الصوت",d.voice,"voiceMinutes","دقيقة")+rank("⚡ الدخول الصوتي",d.joins,"voiceJoins","دخول")+'</div>');
  } catch { page.innerHTML=shell("top",empty("تعذر تحميل التوب")); }
}

async function loadLeaders(page) {
  try {
    const d=await api("/api/public/roles");
    page.innerHTML=shell("leaders",'<div class="role-grid">'+(d.roles||[]).map(r=>'<article class="role-card"><div class="role-top"><i style="background:'+esc(r.color)+'"></i><b>'+num(r.membersCount)+' عضو</b></div><h3>'+esc(r.name)+'</h3><p class="muted">رتبة قيادية داخل MLD</p><button class="btn-secondary role-members" data-id="'+esc(r.id)+'">عرض الأعضاء</button></article>').join("") || empty("لا توجد رتب")+'</div>');
    $$(".role-members",page).forEach(b=>b.onclick=async()=>{try{const d=await api("/api/public/roles/"+encodeURIComponent(b.dataset.id)+"/members");toast((d.members||[]).length+" عضو في "+(d.role?.name||"الرتبة"));}catch{toast("تعذر تحميل أعضاء الرتبة");}});
  } catch { page.innerHTML=shell("leaders",empty("تعذر تحميل الرتب")); }
}

function loadGames(page) {
  const games=[
    ["uno","🎴","أونو","2–6 لاعبين"],["baloot","♠️","بلوت","4 لاعبين"],["jaccaro","🎲","جاكارو","2–4 لاعبين"],
    ["ludo","🎯","لودو","2–4 لاعبين"],["mafia","🕵️","مافيا","5+ لاعبين"],["monopoly","🏠","مونوبولي","2–6 لاعبين"],
    ["codenames","🧩","كود نيمز","4+ لاعبين"],["roulette","🎡","روليت","2+ لاعبين"]
  ];
  page.innerHTML=shell("games",'<div class="page-grid three">'+games.map(g=>'<article class="game-card"><div class="game-icon">'+g[1]+'</div><h3>'+g[2]+'</h3><p class="muted">'+g[3]+'</p><a class="btn-primary" href="game.html?type='+encodeURIComponent(g[0])+'">فتح اللعبة</a><small class="game-note">متاح للتصفح • اللعب حسب حالة الجلسة</small></article>').join("")+'</div>');
}

async function loadReviews(page) {
  try {
    const d=await api("/api/community/reviews");
    page.innerHTML=shell("reviews",'<div class="page-grid">'+((d.reviews||[]).map(x=>panel("⭐ "+esc(x.username||"عضو"),'<p>'+esc(x.content||"")+'</p><small>التقييم: '+num(x.rating)+'/5</small>')).join("") || empty("لا توجد آراء بعد"))+'</div>'+
      (logged()?'<div class="panel page-gap"><h3>أضف رأيك</h3><textarea id="reviewText" class="full" placeholder="اكتب رأيك عن MLD..."></textarea><button id="reviewSend" class="btn-primary">نشر الرأي</button></div>':""));
    $("#reviewSend")?.addEventListener("click",async()=>{const v=$("#reviewText").value.trim();if(!v)return toast("اكتب رأيك أولاً");try{await api("/api/community/reviews",{method:"POST",body:JSON.stringify({content:v,rating:5})});toast("تم نشر رأيك ✓");setPage("reviews")}catch(e){toast(e.message)}});
  } catch { page.innerHTML=shell("reviews",empty("تعذر تحميل الآراء")); }
}

async function loadGroups(page) {
  try {
    const d=await api("/api/community/groups");
    page.innerHTML=shell("groups",'<div class="page-grid">'+((d.groups||[]).map(g=>panel("👨‍👩‍👧 "+esc(g.name),'<p>'+esc(g.description||"")+'</p><span class="status-chip">'+esc(g.status||"متاحة")+'</span><div class="quick-actions"><button class="btn-secondary join-group" data-id="'+esc(g.id)+'">انضمام</button></div>')).join("") || empty("لا توجد قروبات حالياً"))+'</div>'+
      (logged()?'<div class="panel page-gap"><h3>إنشاء قروب</h3><input id="groupName" class="full" placeholder="اسم القروب"><textarea id="groupDesc" class="full" placeholder="الوصف"></textarea><button id="groupCreate" class="btn-primary">إرسال الطلب للأونر</button></div>':""));
    $$(".join-group",page).forEach(b=>b.onclick=async()=>{if(!requireLogin())return;try{await api("/api/community/groups/"+b.dataset.id+"/join",{method:"POST"});toast("تم إرسال طلب الانضمام ✓")}catch(e){toast(e.message)}});
    $("#groupCreate")?.addEventListener("click",async()=>{try{await api("/api/community/groups",{method:"POST",body:JSON.stringify({name:$("#groupName").value.trim(),description:$("#groupDesc").value.trim()})});toast("تم إرسال طلب القروب ✓");setPage("groups")}catch(e){toast(e.message)}});
  } catch { page.innerHTML=shell("groups",empty("تعذر تحميل القروبات")); }
}

async function loadCinema(page) {
  try {
    const d=await api("/api/community/cinema");
    page.innerHTML=shell("cinema",'<div class="page-grid">'+((d.rooms||[]).map(x=>panel("🎬 "+esc(x.title),'<span class="status-chip">'+esc(x.status||"مفتوحة")+'</span><video controls playsinline src="'+esc(x.media_url||"")+'" style="width:100%;margin-top:14px;border-radius:16px;background:#000"></video>')).join("") || empty("لا توجد غرف سينما"))+'</div>'+
      (logged()?'<div class="panel page-gap"><h3>إنشاء غرفة</h3><input id="cinemaTitle" class="full" placeholder="عنوان الغرفة"><input id="cinemaUrl" class="full" placeholder="رابط محتوى تملك حق استخدامه"><button id="cinemaCreate" class="btn-primary">إنشاء الغرفة</button></div>':""));
    $("#cinemaCreate")?.addEventListener("click",async()=>{try{await api("/api/community/cinema",{method:"POST",body:JSON.stringify({title:$("#cinemaTitle").value.trim(),media_url:$("#cinemaUrl").value.trim()})});toast("تم إنشاء الغرفة ✓");setPage("cinema")}catch(e){toast(e.message)}});
  } catch { page.innerHTML=shell("cinema",empty("تعذر تحميل السينما")); }
}

async function loadChat(page) {
  page.innerHTML=shell("chat",'<div id="chatList" class="stack"></div><div class="composer"><input id="chatInput" class="full" placeholder="اكتب رسالتك..."><button id="chatSend" class="btn-primary">إرسال</button></div>');
  const load=async()=>{try{const d=await api("/api/community/chat");$("#chatList").innerHTML=(d.messages||[]).map(m=>'<div class="message-card"><b>'+esc(m.sender_name)+'</b><p>'+esc(m.content)+'</p></div>').join("")||empty("لا توجد رسائل")}catch(e){$("#chatList").innerHTML=empty(e.message)}};
  await load();
  $("#chatSend").onclick=async()=>{const v=$("#chatInput").value.trim();if(!v)return;if(v.length>2000)return toast("الرسالة طويلة جداً");try{await api("/api/community/chat",{method:"POST",body:JSON.stringify({content:v})});$("#chatInput").value="";load()}catch(e){toast(e.message)}};
}

async function loadPigeon(page) {
  page.innerHTML=shell("pigeon",'<div class="page-grid two"><div class="panel"><h3>إرسال رسالة</h3><input id="pigeonTo" class="full" placeholder="Discord ID أو ID العضو"><textarea id="pigeonText" class="full" placeholder="الرسالة"></textarea><button id="pigeonSend" class="btn-primary">إرسال</button></div><div id="pigeonList" class="stack"></div></div>');
  try{const d=await api("/api/community/pigeon");$("#pigeonList").innerHTML=(d.messages||[]).map(x=>'<div class="message-card"><p>'+esc(x.content)+'</p></div>').join("")||empty("لا توجد رسائل")}catch(e){$("#pigeonList").innerHTML=empty(e.message)}
  $("#pigeonSend").onclick=async()=>{const to=$("#pigeonTo").value.trim(),text=$("#pigeonText").value.trim();if(!to||!text)return toast("أكمل البيانات");try{await api("/api/community/pigeon",{method:"POST",body:JSON.stringify({recipient_id:to,content:text})});toast("تم الإرسال ✓");setPage("pigeon")}catch(e){toast(e.message)}};
}

async function loadTickets(page) {
  page.innerHTML=shell("tickets",'<div class="panel"><h3>فتح تذكرة جديدة</h3><input id="ticketSubject" class="full" placeholder="عنوان التذكرة"><textarea id="ticketContent" class="full" placeholder="اشرح مشكلتك بالتفصيل"></textarea><button id="ticketCreate" class="btn-primary">فتح التذكرة</button></div><div id="ticketList" class="stack page-gap"></div>');
  const load=async()=>{try{const d=await api("/api/community/tickets");$("#ticketList").innerHTML=(d.tickets||[]).map(t=>'<div class="message-card"><b>#'+t.id+" · "+esc(t.subject)+'</b><p>'+esc(t.status)+'</p></div>').join("")||empty("لا توجد تذاكر")}catch(e){$("#ticketList").innerHTML=empty(e.message)}};
  await load();
  $("#ticketCreate").onclick=async()=>{const s=$("#ticketSubject").value.trim(),c=$("#ticketContent").value.trim();if(!s||!c)return toast("أكمل عنوان التذكرة والمشكلة");try{await api("/api/community/tickets",{method:"POST",body:JSON.stringify({subject:s,content:c})});toast("تم فتح التذكرة ✓");load()}catch(e){toast(e.message)}};
}

async function loadApplications(page) {
  page.innerHTML=shell("applications",'<div class="panel"><div class="notice-box">التقديم للإدارة مخصص للأونر فقط حسب نظام MLD.</div><h3>إدارة طلبات التقديم</h3><div id="applicationList" class="stack"></div></div>');
  try{const d=await api("/api/community/applications");$("#applicationList").innerHTML=(d.applications||[]).map(a=>'<div class="message-card"><b>#'+a.id+'</b><p>'+esc(a.status)+' · Discord: '+esc(a.discord_id||"—")+'</p><button class="btn-secondary app-status" data-id="'+a.id+'" data-status="accepted">قبول</button> <button class="btn-secondary app-status" data-id="'+a.id+'" data-status="rejected">رفض</button></div>').join("")||empty("لا توجد طلبات");}catch(e){$("#applicationList").innerHTML=empty(e.message)}
  $$(".app-status",page).forEach(b=>b.onclick=async()=>{try{await api("/api/community/applications/"+b.dataset.id+"/status",{method:"POST",body:JSON.stringify({status:b.dataset.status})});toast("تم تحديث الطلب ✓");setPage("applications")}catch(e){toast(e.message)}});
}

async function loadProfile(page) {
  page.innerHTML=shell("profile",'<div class="page-grid two"><div class="panel"><h3>بيانات الحساب</h3><label>اسم المستخدم</label><input id="profileName" class="full" value="'+esc(user?.username||"")+'"><label>النبذة</label><textarea id="profileBio" class="full">'+esc(user?.bio||"")+'</textarea><button id="profileSave" class="btn-primary">حفظ التغييرات</button></div><div class="panel"><h3>الأمان</h3><p class="muted">غيّر كلمة المرور من هنا بعد الدخول.</p><input id="currentPassword" class="full" type="password" placeholder="كلمة المرور الحالية"><input id="newPassword" class="full" type="password" placeholder="كلمة المرور الجديدة"><button id="passwordSave" class="btn-secondary">تغيير كلمة المرور</button></div></div>');
  $("#profileSave").onclick=async()=>{try{const d=await api("/api/users/me",{method:"PATCH",body:JSON.stringify({username:$("#profileName").value.trim(),bio:$("#profileBio").value.trim()})});user=d.user;localStorage.setItem("user",JSON.stringify(user));syncUI();toast("تم حفظ الملف ✓")}catch(e){toast(e.message)}};
  $("#passwordSave").onclick=async()=>{try{await api("/api/auth/change-password",{method:"POST",body:JSON.stringify({current_password:$("#currentPassword").value,new_password:$("#newPassword").value})});toast("تم تغيير كلمة المرور ✓");$("#currentPassword").value="";$("#newPassword").value=""}catch(e){toast(e.message)}};
}

async function loadBots(page) {
  try{
    const d=await api("/api/bots");
    page.innerHTML=shell("bots",'<div class="page-grid three">'+((d.bots||[]).map(b=>panel("🤖 "+esc(b.name),'<p>السيرفر: '+esc(b.guild_id||"—")+'</p><p>الحالة: '+(b.active?"🟢 نشط":"🔴 متوقف")+'</p><button class="btn-secondary bot-toggle" data-id="'+esc(b.id)+'">'+(b.active?"إيقاف البوت":"تشغيل البوت")+'</button>')).join("") || empty("لا توجد بوتات"))+'</div>');
    $$(".bot-toggle",page).forEach(b=>b.onclick=async()=>{try{await api("/api/bots/"+b.dataset.id+"/toggle",{method:"POST"});toast("تم تحديث حالة البوت ✓");setPage("bots")}catch(e){toast(e.message)}});
  }catch(e){page.innerHTML=shell("bots",empty(e.message))}
}

function loadAddBot(page) {
  page.innerHTML=shell("addbot",'<div class="panel form-panel"><h3>ربط بوت جديد</h3><p class="muted">بيانات التوكن تُرسل إلى الخادم ولا توضع داخل ملفات الموقع.</p><input id="botName" class="full" placeholder="اسم البوت"><input id="botToken" class="full" type="password" placeholder="Bot Token"><input id="botGuild" class="full" placeholder="Discord Server ID"><button id="botCreate" class="btn-primary">إضافة البوت</button><div id="botMsg" class="msg"></div></div>');
  $("#botCreate").onclick=async()=>{try{await api("/api/bots",{method:"POST",body:JSON.stringify({name:$("#botName").value.trim(),token:$("#botToken").value.trim(),guild_id:$("#botGuild").value.trim()})});toast("تمت إضافة البوت ✓");setPage("bots")}catch(e){$("#botMsg").textContent=e.message;$("#botMsg").className="msg show error"}};
}

async function loadAdmin(page, ownerPanel=false) {
  if(ownerPanel && !owner()) return;
  if(!ownerPanel && !admin()) return;
  page.innerHTML=shell(ownerPanel?"owner-admin":"admin",'<div class="admin-dashboard"><div class="dashboard-kpis"><div class="kpi">👥<b>الحسابات</b><span id="adminUsersCount">...</span></div><div class="kpi">🎫<b>التذاكر</b><span id="adminTicketsCount">...</span></div><div class="kpi">🛡️<b>الصلاحية</b><span>'+(ownerPanel?"أونر كامل":"إدارة")+'</span></div></div><div id="adminUsers" class="panel"><h3>👥 الحسابات</h3><div class="stack"></div></div><div id="adminTickets" class="panel page-gap"><h3>🎫 التذاكر</h3><div class="stack"></div></div>'+(ownerPanel?'<div id="ownerApplications" class="panel page-gap"><h3>📝 التقديم</h3><div class="stack"></div></div><div id="ownerGroups" class="panel page-gap"><h3>👨‍👩‍👧 القروبات</h3><div class="stack"></div></div><div id="ownerAudit" class="panel page-gap"><h3>📋 سجل الأونر</h3><div class="stack"></div></div>':"")+'</div>');
  try{
    const users=await api("/api/users");
    $("#adminUsersCount").textContent=num((users.users||[]).length);
    $("#adminUsers .stack").innerHTML=(users.users||[]).map(u=>'<div class="message-card"><b>'+esc(u.username)+'</b><p>'+(u.is_owner?"👑 أونر":u.role==="admin"?"🛡️ إداري":"عضو")+'</p>'+(owner()&&!u.is_owner?'<button class="btn-secondary set-admin" data-id="'+esc(u.id)+'" data-action="'+(u.role==="admin"?"remove":"add")+'">'+(u.role==="admin"?"إزالة الإدارة":"تعيين إداري")+'</button>':"")+'</div>').join("")||empty("لا توجد حسابات");
    $$(".set-admin",page).forEach(b=>b.onclick=async()=>{try{await api("/api/users/"+b.dataset.id+"/admin",{method:"POST",body:JSON.stringify({action:b.dataset.action})});toast("تم تحديث الصلاحية ✓");setPage(ownerPanel?"owner-admin":"admin")}catch(e){toast(e.message)}});
  }catch(e){$("#adminUsers .stack").innerHTML=empty(e.message)}
  try{
    const d=await api("/api/community/tickets");
    $("#adminTicketsCount").textContent=num((d.tickets||[]).length);
    $("#adminTickets .stack").innerHTML=(d.tickets||[]).map(t=>'<div class="message-card"><b>#'+t.id+" · "+esc(t.subject)+'</b><p>'+esc(t.status)+' · '+esc(t.claimed_by||"غير مستلمة")+'</p>'+(t.status!=="closed"?'<button class="btn-secondary claim" data-id="'+t.id+'">استلام</button> <button class="btn-secondary close-ticket" data-id="'+t.id+'">إغلاق</button>':"")+'</div>').join("")||empty("لا توجد تذاكر");
    $$(".claim",page).forEach(b=>b.onclick=async()=>{try{await api("/api/community/tickets/"+b.dataset.id+"/claim",{method:"POST"});toast("تم استلام التذكرة ✓");setPage(ownerPanel?"owner-admin":"admin")}catch(e){toast(e.message)}});
    $$(".close-ticket",page).forEach(b=>b.onclick=async()=>{try{await api("/api/community/tickets/"+b.dataset.id+"/close",{method:"POST"});toast("تم إغلاق التذكرة ✓");setPage(ownerPanel?"owner-admin":"admin")}catch(e){toast(e.message)}});
  }catch(e){$("#adminTickets .stack").innerHTML=empty(e.message)}
  if(ownerPanel){
    try{
      const [a,g,l]=await Promise.all([api("/api/community/applications"),api("/api/community/groups/all"),api("/api/community/audit")]);
      $("#ownerApplications .stack").innerHTML=(a.applications||[]).map(x=>'<div class="message-card"><b>#'+x.id+'</b><p>'+esc(x.status)+' · '+esc(x.discord_id||"—")+'</p><button class="btn-secondary owner-app" data-id="'+x.id+'" data-status="accepted">قبول</button> <button class="btn-secondary owner-app" data-id="'+x.id+'" data-status="rejected">رفض</button></div>').join("")||empty("لا توجد طلبات");
      $("#ownerGroups .stack").innerHTML=(g.groups||[]).map(x=>'<div class="message-card"><b>'+esc(x.name)+'</b><p>'+esc(x.status)+'</p>'+(x.status==="pending"?'<button class="btn-secondary owner-group" data-id="'+x.id+'">اعتماد</button>':"")+'</div>').join("")||empty("لا توجد طلبات قروبات");
      $("#ownerAudit .stack").innerHTML=(l.logs||[]).map(x=>'<div class="message-card"><b>'+esc(x.action)+'</b><p>'+esc(x.actor_name||"")+' · '+esc(x.target||"")+'</p></div>').join("")||empty("لا يوجد سجل");
      $$(".owner-app",page).forEach(b=>b.onclick=async()=>{try{await api("/api/community/applications/"+b.dataset.id+"/status",{method:"POST",body:JSON.stringify({status:b.dataset.status})});toast("تم تحديث التقديم ✓");setPage("owner-admin")}catch(e){toast(e.message)}});
      $$(".owner-group",page).forEach(b=>b.onclick=async()=>{try{await api("/api/community/groups/"+b.dataset.id+"/status",{method:"POST",body:JSON.stringify({status:"approved"})});toast("تم اعتماد القروب ✓");setPage("owner-admin")}catch(e){toast(e.message)}});
    }catch(e){toast(e.message)}
  }
}

async function render(pageName) {
  const page=$("#page-"+pageName);
  if(!page) return;
  if(!allowed(pageName)) {
    if(pageName==="admin" || pageName==="owner-admin") toast("ليس لديك صلاحية لهذه اللوحة");
    else requireLogin();
    return;
  }
  closeMenu();
  $$(".page").forEach(p=>p.classList.remove("active"));
  page.classList.add("active");
  $("#pageTitle").textContent = META[pageName]?.[1] || pageName;
  try {
    if(pageName==="home") return loadHome(page);
    if(pageName==="members") return loadMembers(page);
    if(pageName==="top") return loadTop(page);
    if(pageName==="leaders") return loadLeaders(page);
    if(pageName==="games") return loadGames(page);
    if(pageName==="reviews") return loadReviews(page);
    if(pageName==="groups") return loadGroups(page);
    if(pageName==="cinema") return loadCinema(page);
    if(pageName==="chat") return loadChat(page);
    if(pageName==="pigeon") return loadPigeon(page);
    if(pageName==="tickets") return loadTickets(page);
    if(pageName==="applications") return loadApplications(page);
    if(pageName==="profile") return loadProfile(page);
    if(pageName==="bots") return loadBots(page);
    if(pageName==="addbot") return loadAddBot(page);
    if(pageName==="admin") return loadAdmin(page,false);
    if(pageName==="owner-admin") return loadAdmin(page,true);
  } catch(e) {
    page.innerHTML=shell(pageName,empty("حدث خطأ غير متوقع"));
    console.error(e);
  }
}

function setPage(page) {
  if(page==="logout") {
    localStorage.removeItem("token"); localStorage.removeItem("user"); token=""; user=null; syncUI(); toast("تم تسجيل الخروج"); location.hash="#home"; return;
  }
  if(page==="login") { openAuth(); return; }
  if(!allowed(page)) {
    if(page==="admin"||page==="owner-admin") toast("هذه اللوحة غير متاحة لحسابك");
    else requireLogin();
    return;
  }
  location.hash="#"+page;
  render(page);
}

function bindNavigation() {
  $$(".sidebar a[data-page]").forEach(a=>{
    a.onclick=e=>{e.preventDefault();setPage(a.dataset.page);};
  });
  $("#appMenuBackdrop")?.addEventListener("click",closeMenu);
  $("#loginBtn")?.addEventListener("click",e=>{e.preventDefault();openAuth()});
  $("#topLoginBtn")?.addEventListener("click",openAuth);
  $("#logoutBtn")?.addEventListener("click",e=>{e.preventDefault();setPage("logout")});
}

function bindAuth() {
  const form=$("#authForm"), tabs=$$(".tabs button"), discordField=$("#discordField"), submit=$("#submitBtn"), msg=$("#authMsg");
  if(!form) return;
  let mode="login";
  tabs.forEach(b=>b.onclick=()=>{mode=b.dataset.tab;tabs.forEach(x=>x.classList.toggle("active",x===b));discordField.style.display=mode==="register"?"block":"none";submit.textContent=mode==="register"?"تسجيل":"دخول";msg.className="msg";});
  $("#verifyDiscordBtn")?.addEventListener("click",async()=>{
    const id=$("#discord_id").value.trim(); if(!id)return toast("اكتب Discord ID أو اسم المستخدم");
    try{await api("/api/auth/verify-discord",{method:"POST",body:JSON.stringify({discord_id:id})});msg.className="msg show success";msg.textContent="تم إرسال كود التحقق إلى الخاص في Discord ✓";$("#verification_code").style.display="block"}catch(e){msg.className="msg show error";msg.textContent=e.message}
  });
  form.onsubmit=async e=>{
    e.preventDefault();
    msg.className="msg show";msg.textContent="جاري...";
    try{
      const headers={"Content-Type":"application/json"};
      const res=await fetch(API+"/api/auth/"+mode,{method:"POST",headers,body:JSON.stringify({username:$("#username").value.trim(),password:$("#password").value,discord_id:$("#discord_id").value.trim(),verification_code:$("#verification_code")?.value.trim()||""})});
      const d=await res.json(); if(!res.ok)throw Error(d.error||"تعذر تسجيل الدخول");
      token=d.token;user=d.user;localStorage.setItem("token",token);localStorage.setItem("user",JSON.stringify(user));closeAuth();syncUI();toast("تم تسجيل الدخول ✓");setPage("home");
    }catch(e){msg.className="msg show error";msg.textContent=e.message}
  };
  $("#forgotOpenBtn")?.addEventListener("click",()=>$("#forgotScreen")?.classList.add("show"));
  $("#forgotBtn")?.addEventListener("click",async()=>{
    try{const d=await api("/api/auth/forgot-password",{method:"POST",body:JSON.stringify({username:$("#forgotUsername").value.trim(),discord_id:$("#forgotDiscord").value.trim()})});$("#forgotMsg").className="msg show success";$("#forgotMsg").textContent=d.message||"تم الإرسال"}catch(e){$("#forgotMsg").className="msg show error";$("#forgotMsg").textContent=e.message}
  });
}

async function init() {
  if (token) {
    try {
      const fresh = await api("/api/auth/me");
      if (fresh.user) {
        user = fresh.user;
        localStorage.setItem("user", JSON.stringify(user));
      }
    } catch (e) {
      if (e.message && /token|unauth|مصـرح|انته/i.test(e.message)) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        token = "";
        user = null;
      }
    }
  }
  syncUI(); bindNavigation(); bindAuth();
  $("#menuBtn")?.setAttribute("aria-label","فتح القائمة");
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});
  window.addEventListener("resize",()=>{if(innerWidth>900)closeMenu()});
  const requested=(location.hash||"#home").slice(1) || "home";
  if(requested==="login") openAuth(); else await render(requested);
}
window.addEventListener("hashchange",()=>{const p=(location.hash||"#home").slice(1)||"home";if(p!=="login")render(p)});
init();



async function loadServerStats(){
  try{
    const r=await fetch(API+'/api/public/server',{cache:'no-store'});
    const d=await r.json();
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v==null?'—':String(v)};
    set('homeServerName',d.name||'MLD');
    set('homeMemberCount',d.memberCount);
    set('homeOnlineCount',d.onlineCount);
    set('homeVisits',d.visits);
    const status=document.querySelector('#page-home .mld-stats b.online');
    if(status) status.textContent=d.error?'● تعذر الاتصال':'● متصل';
  }catch(e){}
}

/* MLD unified navigation */
const FEATURE_META={members:['👥','الأعضاء','استكشف أعضاء مجتمع MLD وابحث بالاسم أو اليوزر.'],top:['🏆','التوب','أعلى أعضاء المجتمع حسب النشاط المسجل.'],leaders:['👑','الرتب القيادية','الرتب القيادية وأعضاء كل رتبة.'],chat:['💬','الشات العام','محادثة مجتمع MLD للأعضاء المسجلين.'],pigeon:['✉️','الزاجل','رسائلك الخاصة داخل المنصة.'],games:['🎮','الألعاب','استكشف الألعاب والجلسات المتاحة.'],cinema:['🎬','السينما','غرف مشاهدة جماعية ومزامنة.'],groups:['👨‍👩‍👧','القروبات','استكشف القروبات وأنشئ قروبًا بعد تسجيل الدخول.'],tickets:['🎫','التذاكر','افتح وتابع تذاكرك.'],applications:['📝','التقديم','طلبات التقديم — للأونر فقط.'],reviews:['⭐','الآراء','آراء وتجارب أعضاء MLD.'],profile:['👤','بروفايلي','بيانات حسابك وإعداداته.'],bots:['🤖','منصة البوتات','إدارة بوتاتك المرتبطة بحسابك.'],addbot:['➕','إضافة بوت','إضافة بوت جديد للمنصة.'],admin:['🛡️','لوحة الإدارة','إدارة التذاكر والحسابات المسموح بها.'],'owner-admin':['👑','لوحة الأونر','التحكم الكامل بإدارة المجتمع.']};
const PROTECTED=['chat','pigeon','tickets','bots','addbot','profile'], OWNER_ONLY=['applications','owner-admin'];
function canOpen(p){if(!token||!user)return !PROTECTED.includes(p)&&!OWNER_ONLY.includes(p)&&p!=='admin';if(OWNER_ONLY.includes(p))return !!user.is_owner;if(p==='admin')return !!user.is_owner||['admin','owner'].includes(String(user.role||'').toLowerCase());return true}
function setMenu(o){const s=document.getElementById('sidebar'),b=document.getElementById('appMenuBackdrop'),btn=document.getElementById('menuBtn');s?.classList.toggle('open',o);b?.classList.toggle('show',o);document.body.classList.toggle('app-menu-open',o);btn?.setAttribute('aria-expanded',String(o))}
window.toggleAppMenu=e=>{e?.preventDefault();e?.stopPropagation();setMenu(!document.getElementById('sidebar')?.classList.contains('open'));return false};window.closeAppMenu=()=>setMenu(false);
function shell(p,b){const m=FEATURE_META[p]||['✦',p,''];return '<section class="mld-page-shell"><header class="mld-page-head"><span class="mld-kicker">'+m[0]+' MLD COMMUNITY</span><h1>'+m[1]+'</h1><p>'+m[2]+'</p></header><div class="mld-page-body">'+b+'</div></section>'}
function card(m){return '<article class="mld-member"><img src="'+esc(m.avatar||'/logo.svg')+'"><div><b>'+esc(m.name)+'</b><small>@'+esc(m.username||'')+'</small><span>'+esc((m.importantRoles||[]).map(x=>x.name).slice(0,2).join(' · ')||'عضو')+'</span></div></article>'}
function active(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById('page-'+p)?.classList.add('active');document.querySelectorAll('.sidebar a[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));document.getElementById('pageTitle').textContent=(FEATURE_META[p]||['',p])[1]||'الرئيسية';setMenu(false)}
function auth(){document.getElementById('authScreen')?.classList.add('show')}
async function renderPage(p){if(p==='home'){active('home');return}if(p==='login'){auth();return}if(p==='logout'){localStorage.clear();location.reload();return}if(!canOpen(p)){toast(OWNER_ONLY.includes(p)?'هذه الصفحة للأونر فقط':'سجّل دخول أولاً');if(!token||!user)auth();location.hash='home';active('home');return}active(p);const page=document.getElementById('page-'+p);if(!page)return;
try{
if(p==='members'){const d=await fetch(API+'/api/public/members?x='+Date.now(),{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-toolbar"><input id="memberSearch" class="full" placeholder="ابحث عن عضو..."><b>'+num(d.total||0)+' عضو</b></div><div id="memberGrid" class="mld-member-grid">'+(d.members||[]).map(card).join('')+'</div>');memberSearch.oninput=async e=>{const x=await fetch(API+'/api/public/members?q='+encodeURIComponent(e.target.value),{cache:'no-store'}).then(r=>r.json());memberGrid.innerHTML=(x.members||[]).map(card).join('')||'<div class="mld-empty">لا توجد نتائج.</div>'}}
else if(p==='top'){const d=await fetch(API+'/api/public/top?x='+Date.now(),{cache:'no-store'}).then(r=>r.json());const box=(t,k,l)=>'<div class="panel"><h3>'+t+'</h3>'+((d[k]||[]).map((x,i)=>'<div class="mld-rank"><i>'+String(i+1).padStart(2,'0')+'</i><img src="'+esc(x.avatar||'/logo.svg')+'"><span><b>'+esc(x.name)+'</b><small>'+l+'</small></span><strong>'+num(x.stats?.[k==='messages'?'messages':k==='voice'?'voiceMinutes':k==='mentions'?'mentionsReceived':'voiceJoins'])+'</strong></div>').join('')||'<div class="mld-empty">لا توجد بيانات نشاط بعد.</div>')+'</div>';page.innerHTML=shell(p,'<div class="page-grid">'+box('💬 أكثر الرسائل','messages','رسالة')+box('🎙️ النشاط الصوتي','voice','دقيقة')+box('📣 أكثر المنشنات','mentions','منشن')+box('➕ دخول صوتي','joins','دخول')+'</div>')}
else if(p==='leaders'){const d=await fetch(API+'/api/public/roles?x='+Date.now(),{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-role-grid">'+(d.roles||[]).map(r=>'<article class="panel"><h3>'+esc(r.name)+'</h3><b>'+num(r.membersCount)+' عضو</b><button class="btn-primary" onclick="openRolePage(\''+r.id+'\')">عرض الأعضاء</button></article>').join('')+'</div>')}
else if(p==='reviews'){const d=await fetch(API+'/api/community/reviews?x='+Date.now(),{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-card-grid">'+(d.reviews||[]).map(x=>'<article class="panel"><b>⭐ '+num(x.rating)+'</b><h3>'+esc(x.username)+'</h3><p>'+esc(x.content)+'</p></article>').join('')||'<div class="mld-empty">لا توجد آراء بعد.</div>')+(token?'<div class="panel" style="margin-top:16px"><textarea id="reviewText" class="full" placeholder="اكتب رأيك"></textarea><button id="reviewAdd" class="btn-primary">إضافة رأي</button></div>':'');reviewAdd?.addEventListener('click',async()=>{const d=await api('/api/community/reviews',{method:'POST',body:JSON.stringify({content:reviewText.value,rating:5})});toast(d.error||'تمت الإضافة ✓');renderPage('reviews')})}
else if(p==='groups'){const d=await fetch(API+'/api/community/groups?x='+Date.now(),{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-card-grid">'+(d.groups||[]).map(x=>'<article class="panel"><h3>👨‍👩‍👧 '+esc(x.name)+'</h3><p>'+esc(x.description||'')+'</p><button class="btn-primary" onclick="joinGroup('+x.id+')">انضمام</button></article>').join('')||'<div class="mld-empty">لا توجد قروبات.</div>')+(token?'<div class="panel" style="margin-top:16px"><h3>إنشاء قروب</h3><input id="groupName" class="full" placeholder="اسم القروب"><textarea id="groupDesc" class="full" placeholder="الوصف"></textarea><button id="groupCreate" class="btn-primary">إرسال الطلب</button></div>':'');groupCreate?.addEventListener('click',async()=>{const d=await api('/api/community/groups',{method:'POST',body:JSON.stringify({name:groupName.value,description:groupDesc.value})});toast(d.error||'تم إرسال الطلب ✓');renderPage('groups')})}
else if(p==='chat'){page.innerHTML=shell(p,'<div id="chatList" class="mld-card-grid">جاري...</div><div class="panel"><input id="chatText" class="full" placeholder="اكتب رسالتك..."><button id="chatSend" class="btn-primary">إرسال</button></div>');const d=await api('/api/community/chat');chatList.innerHTML=(d.messages||[]).map(x=>'<article class="panel"><b>'+esc(x.sender_name)+'</b><p>'+esc(x.content)+'</p></article>').join('')||'<div class="mld-empty">لا توجد رسائل.</div>';chatSend.onclick=async()=>{const x=await api('/api/community/chat',{method:'POST',body:JSON.stringify({content:chatText.value})});toast(x.error||'تم الإرسال ✓');renderPage('chat')}}
else if(p==='tickets'){page.innerHTML=shell(p,'<div class="panel"><input id="ticketSubject" class="full" placeholder="عنوان التذكرة"><textarea id="ticketContent" class="full" placeholder="اشرح مشكلتك"></textarea><button id="ticketCreate" class="btn-primary">فتح تذكرة</button></div><div id="ticketList" class="mld-card-grid"></div>');const d=await api('/api/community/tickets');ticketList.innerHTML=(d.tickets||[]).map(x=>'<article class="panel"><b>#'+x.id+' · '+esc(x.subject)+'</b><p>'+esc(x.status)+'</p></article>').join('')||'<div class="mld-empty">لا توجد تذاكر.</div>';ticketCreate.onclick=async()=>{const x=await api('/api/community/tickets',{method:'POST',body:JSON.stringify({subject:ticketSubject.value,content:ticketContent.value})});toast(x.error||'تم فتح التذكرة ✓');renderPage('tickets')}}
else if(p==='pigeon'){page.innerHTML=shell(p,'<div class="panel"><input id="pigeonRecipient" class="full" placeholder="معرف المستلم"><textarea id="pigeonText" class="full" placeholder="الرسالة"></textarea><button id="pigeonSend" class="btn-primary">إرسال</button></div><div id="pigeonList" class="mld-card-grid"></div>');const d=await api('/api/community/pigeon');pigeonList.innerHTML=(d.messages||[]).map(x=>'<article class="panel"><p>'+esc(x.content)+'</p></article>').join('')||'<div class="mld-empty">لا توجد رسائل.</div>';pigeonSend.onclick=async()=>{const x=await api('/api/community/pigeon',{method:'POST',body:JSON.stringify({recipient_id:pigeonRecipient.value,content:pigeonText.value})});toast(x.error||'تم الإرسال ✓');renderPage('pigeon')}}
else if(p==='cinema'){const d=await fetch(API+'/api/community/cinema?x='+Date.now(),{cache:'no-store'}).then(r=>r.json());page.innerHTML=shell(p,'<div class="mld-card-grid">'+(d.rooms||[]).map(x=>'<article class="panel"><h3>🎬 '+esc(x.title)+'</h3><p>'+esc(x.status)+'</p><video controls playsinline style="width:100%;max-height:420px;border-radius:16px;background:#000" src="'+esc(x.media_url)+'"></video></article>').join('')||'<div class="mld-empty">لا توجد غرف.</div>')+(token?'<div class="panel" style="margin-top:16px"><h3>إنشاء غرفة</h3><input id="cinemaTitle" class="full" placeholder="اسم العرض"><input id="cinemaUrl" class="full" placeholder="رابط المحتوى"><button id="cinemaCreate" class="btn-primary">إنشاء</button></div>':'');cinemaCreate?.addEventListener('click',async()=>{const x=await api('/api/community/cinema',{method:'POST',body:JSON.stringify({title:cinemaTitle.value,media_url:cinemaUrl.value})});toast(x.error||'تم الإنشاء ✓');renderPage('cinema')})}
else if(p==='profile'){page.innerHTML=shell(p,'<div class="panel"><input id="profileName" class="full" value="'+esc(user.username||'')+'"><textarea id="profileBio" class="full">'+esc(user.bio||'')+'</textarea><button id="profileSave" class="btn-primary">حفظ</button></div>');profileSave.onclick=async()=>{const x=await api('/api/users/me',{method:'PATCH',body:JSON.stringify({username:profileName.value,bio:profileBio.value})});if(x.error)return toast(x.error);user=x.user;localStorage.setItem('user',JSON.stringify(user));toast('تم الحفظ ✓')}}
else if(p==='bots'){page.innerHTML=shell(p,'<div id="botsList" class="mld-card-grid"></div>');await loadBots()}
else if(p==='addbot'){page.innerHTML=shell(p,'<div class="panel"><input id="botName" class="full" placeholder="اسم البوت"><input id="botToken" type="password" class="full" placeholder="Bot Token"><input id="botGuild" class="full" placeholder="Discord Server ID"><button id="createBotBtn" class="btn-primary">إضافة البوت</button><div id="botMsg"></div></div>');createBotBtn.onclick=async()=>{const x=await api('/api/bots',{method:'POST',body:JSON.stringify({name:botName.value,token:botToken.value,guild_id:botGuild.value})});toast(x.error||'تم ✓');renderPage('bots')}}
else if(p==='admin'||p==='owner-admin'){page.innerHTML=shell(p,p==='admin'?'<div id="adminUsers" class="page-grid"></div><div id="adminTickets" class="panel" style="margin-top:16px"></div>':'<div class="page-grid"><div id="ownerApplications" class="panel"></div><div id="ownerGroups" class="panel"></div><div id="ownerAudit" class="panel"></div></div>');await loadAdminPanel(p)}
else if(p==='applications'){page.innerHTML=shell(p,'<div class="panel"><h3>التقديم</h3><p>التقديم متاح للأونر فقط.</p></div>')}
else if(p==='games'){location.href='/game.html'}
}catch(e){console.error(e);page.innerHTML=shell(p,'<div class="mld-empty">تعذر تحميل الصفحة حاليًا.</div>')}}
window.openRolePage=async id=>{const d=await fetch(API+'/api/public/roles/'+encodeURIComponent(id)+'/members?x='+Date.now(),{cache:'no-store'}).then(r=>r.json());const p=document.getElementById('page-leaders');p.innerHTML=shell('leaders','<button class="btn-primary" onclick="renderPage(\'leaders\')">← رجوع</button><div class="panel"><h2>'+esc(d.role?.name||'الرتبة')+'</h2><p>'+num(d.role?.membersCount)+' عضو</p></div><div class="mld-member-grid">'+(d.members||[]).map(card).join('')+'</div>');active('leaders')};
async function loadAdminPanel(p){const d=await api('/api/users');if(p==='admin'){adminUsers.innerHTML=(d.users||[]).map(u=>'<article class="panel"><h3>'+esc(u.username)+'</h3><p>'+ (u.is_owner?'👑 أونر':u.role==='admin'?'🛡️ إدارة':'عضو')+'</p>'+(user?.is_owner&&!u.is_owner?'<button class="btn-primary" onclick="setAdmin(\''+u.id+'\',\''+(u.role==='admin'?'remove':'add')+'\')">'+(u.role==='admin'?'إزالة الإدارة':'إضافة للإدارة')+'</button>':'')+'</article>').join('')||'<div class="mld-empty">لا يوجد مستخدمون.</div>';const t=await api('/api/community/tickets');adminTickets.innerHTML='<h3>🎫 التذاكر</h3>'+(t.tickets||[]).map(x=>'<div class="panel"><b>#'+x.id+' · '+esc(x.subject)+'</b><p>'+esc(x.status)+'</p></div>').join('')||'<p>لا توجد تذاكر.</p>'}else{const [a,g,l]=await Promise.all([api('/api/community/applications'),api('/api/community/groups/all'),api('/api/community/audit')]);ownerApplications.innerHTML='<h3>📝 التقديم</h3>'+((a.applications||[]).map(x=>'<div class="panel"><b>#'+x.id+'</b><p>'+esc(x.status)+'</p><button class="btn-primary" onclick="applicationStatus(\''+x.id+'\',\'accepted\')">قبول</button> <button class="btn-primary" onclick="applicationStatus(\''+x.id+'\',\'rejected\')">رفض</button></div>').join('')||'<p>لا توجد طلبات.</p>');ownerGroups.innerHTML='<h3>👨‍👩‍👧 القروبات</h3>'+((g.groups||[]).map(x=>'<div class="panel"><b>#'+x.id+' · '+esc(x.name)+'</b><p>'+esc(x.status)+'</p></div>').join('')||'<p>لا توجد طلبات.</p>');ownerAudit.innerHTML='<h3>📋 السجل</h3>'+((l.logs||[]).map(x=>'<div class="panel"><b>'+esc(x.action)+'</b><p>'+esc(x.actor_name||'')+'</p></div>').join('')||'<p>لا يوجد سجل.</p>')}}
window.setAdmin=async(id,a)=>{const x=await api('/api/users/'+id+'/admin',{method:'POST',body:JSON.stringify({action:a})});toast(x.message||x.error);renderPage('admin')};window.applicationStatus=async(id,s)=>{const x=await api('/api/community/applications/'+id+'/status',{method:'POST',body:JSON.stringify({status:s})});toast(x.message||x.error);renderPage('owner-admin')};
document.querySelectorAll('.sidebar a[data-page]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();renderPage(a.dataset.page);history.replaceState(null,'','#'+a.dataset.page)}));window.addEventListener('hashchange',()=>renderPage((location.hash||'#home').slice(1)));document.getElementById('appMenuBackdrop')?.addEventListener('click',()=>setMenu(false));
setTimeout(()=>renderPage((location.hash||'#home').slice(1)),0);
