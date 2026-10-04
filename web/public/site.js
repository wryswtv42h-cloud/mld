"use strict";

const API_BASE = 'https://api-production-5bddb.up.railway.app';

const $=s=>document.querySelector(s);
const content=$("#content"),status=$("#status"),search=$("#search"),searchWrap=$("#search-wrap"),modal=$("#modal"),box=$("#modal-content"),title=$("#view-title"),subtitle=$("#subtitle"),mobile=$("#mobile-menu"),backdrop=$("#menu-backdrop");
let view="members",all=[],roles=[],timer,refreshTimer,selected=null;
const fallback="/logo.svg";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>new Intl.NumberFormat("ar-SA").format(Number(v)||0);
const avatar=m=>m?.avatar||fallback;
function setStatus(x){if(status) status.textContent=x}
function openModal(){if(!modal||!box)return;modal.classList.remove("hidden");document.body.classList.add("modal-open")}
function closeModal(){if(!modal)return;modal.classList.add("hidden");document.body.classList.remove("modal-open")}
window.toggleMLDMenu=function(e){e?.preventDefault();e?.stopPropagation();const m=document.getElementById("mobile-menu");if(m?.classList.contains("open"))closeMenu();else openMenu();};
function closeMenu(){if(!mobile)return;mobile.classList.remove("open");backdrop?.classList.remove("open");mobile.setAttribute("aria-hidden","true");$("#menu")?.setAttribute("aria-expanded","false");document.body.classList.remove("menu-open")}
function openMenu(){if(!mobile)return;mobile.classList.add("open");backdrop?.classList.add("open");mobile.setAttribute("aria-hidden","false");$("#menu")?.setAttribute("aria-expanded","true");document.body.classList.add("menu-open")}
function bind(){document.querySelectorAll("[data-member]").forEach(x=>x.onclick=()=>openMember(x.dataset.member));document.querySelectorAll("[data-role]").forEach(x=>x.onclick=()=>openRole(x.dataset.role))}
function card(m){return `<article class="card" data-member="${esc(m.id)}"><img src="${esc(avatar(m))}" onerror="this.src='${fallback}'"><div><h3>${esc(m.name)}</h3><p>@${esc(m.username||"")}</p><div class="roles">${(m.importantRoles||[]).map(r=>`<span class="role">${esc(r.name)}</span>`).join("")||`<span class="member-tag">عضو</span>`}</div></div><b>↗</b></article>`}
function renderMembers(list){if(!content)return;content.className="grid";content.innerHTML=list.length?list.map(card).join(""):`<div class="empty"><h3>لا توجد نتائج</h3><p>تأكد من تفعيل Server Members Intent.</p></div>`;bind()}
function topSec(t,list,k,l){return `<section class="top-section"><h3>${t}</h3>${list.map((m,i)=>`<article class="top-card" data-member="${esc(m.id)}"><span class="rank">${i+1}</span><img src="${esc(avatar(m))}"><div><small>${l}</small><h4>${esc(m.name)}</h4><strong>${num(m.stats?.[k])}</strong></div></article>`).join("")||`<p class="muted">لا توجد بيانات بعد.</p>`}</section>`}
function renderTop(d){if(!content)return;content.className="top-grid";content.innerHTML=topSec("🏆 أكثر الرسائل",d.messages||[],"messages","رسالة")+topSec("💬 أكثر المنشنات",d.mentions||[],"mentionsReceived","منشن")+topSec("🎙️ وقت الصوت",d.voice||[],"voiceMinutes","دقيقة")+topSec("⚡ دخول صوتي",d.joins||[],"voiceJoins","دخول");bind()}
function renderRoles(){if(!content)return;content.className="role-grid";content.innerHTML=roles.map(r=>`<article class="role-card" data-role="${esc(r.id)}"><div class="role-top"><i style="background:${esc(r.color)}"></i><b>${num(r.membersCount)} عضو</b></div><h3>${esc(r.name)}</h3><div class="roles">${(r.permissions||[]).slice(0,4).map(p=>`<span class="permission">${esc(p)}</span>`).join("")||`<span class="muted">صلاحيات عادية</span>`}</div><small>عرض الأعضاء ↗</small></article>`).join("");bind()}
function gamesView(){if(!content||!title||!subtitle||!searchWrap)return;title.textContent="الألعاب الجماعية";subtitle.textContent="أنشئ جلسة أو انضم لجلسة موجودة";searchWrap.style.display="none";content.className="games-page";content.innerHTML=`<div class="games-grid"><article class="game-card" data-game="uno"><div class="game-icon">🎴</div><h3>أونو</h3><p>2-6 لاعبين</p><button class="primary">إنشاء جلسة</button></article><article class="game-card" data-game="jaccaro"><div class="game-icon">🎲</div><h3>جاكارو</h3><p>2-4 لاعبين</p><button class="primary">إنشاء جلسة</button></article><article class="game-card" data-game="codenames"><div class="game-icon">🕵️</div><h3>كود نيمز</h3><p>4+ لاعبين</p><button class="primary">إنشاء جلسة</button></article><article class="game-card" data-game="baloot"><div class="game-icon">♠️</div><h3>بلوت</h3><p>4 لاعبين</p><button class="primary">إنشاء جلسة</button></article><article class="game-card" data-game="ludo"><div class="game-icon">🎯</div><h3>لودو</h3><p>2-4 لاعبين</p><button class="primary">إنشاء جلسة</button></article><article class="game-card" data-game="monopoly"><div class="game-icon">🏠</div><h3>مونوبولي</h3><p>2-6 لاعبين</p><button class="primary">إنشاء جلسة</button></article><article class="game-card" data-game="maqousar"><div class="game-icon">🃏</div><h3>مقوصر</h3><p>4+ لاعبين</p><button class="primary">إنشاء جلسة</button></article></div><div class="sessions-box"><h3>الجلسات المتاحة</h3><div id="sessions-list" class="sessions-list">جاري التحميل...</div></div>`;document.querySelectorAll("[data-game]").forEach(c=>c.querySelector("button").onclick=()=>{const t=c.dataset.game,n=localStorage.getItem("guestName")||prompt("اسمك؟");if(!n)return;localStorage.setItem("guestName",n);location.href=`game.html?type=${t}&name=${encodeURIComponent(n)}`});loadSessions()}
async function loadSessions(){try{const r=await fetch(API_BASE + '/api/games/sessions'),d=await r.json(),list=$("#sessions-list");if(!list)return;list.innerHTML=d.sessions?.length?d.sessions.map(s=>`<div class="session-item"><div><h4>${esc(s.game_type)}</h4><p>${esc(s.host_name)} · ${s.players?.length||0}/${s.max_players}</p></div><a class="primary" href="game.html?id=${s.id}">انضم</a></div>`).join(""):"<p class='muted'>لا توجد جلسات حالياً</p>"}catch(e){const l=$("#sessions-list");if(l)l.innerHTML="<p class='muted'>تعذر التحميل</p>"}}
function messageView(){if(!content||!title||!subtitle||!searchWrap)return;title.textContent="رسالة خاصة";subtitle.textContent="اختر عضوًا واكتب رسالتك؛ ستصل داخل Embed بعنوان.";searchWrap.style.display="none";content.className="message-page";content.innerHTML=`<div class="message-box"><div class="message-icon">✦</div><h3>إرسال رسالة خاصة</h3><p class="muted">اكتب اسم العضو للبحث ثم اختره من النتائج.</p><input id="recipient-search" class="full" placeholder="ابحث عن المستلم..." autocomplete="off"><div id="recipient-results" class="recipient-results"></div><input id="msg-title" class="full" maxlength="120" placeholder="عنوان الرسالة"><label class="check"><input id="show-name" type="checkbox"> إظهار اسم المرسل</label><input id="sender-name" class="full hidden" maxlength="60" placeholder="اسم المرسل"><textarea id="msg-text" class="full" maxlength="2000" placeholder="اكتب رسالتك..."></textarea><p id="msg-status"></p><button id="send" class="primary wide">إرسال الآن</button></div>`;const rs=$("#recipient-search");rs.oninput=async()=>{const q=rs.value.trim();if(!q){$("#recipient-results").innerHTML="";return}const d=await fetch(API_BASE + `/api/public/members?q=${encodeURIComponent(q)}`).then(r=>r.json());$("#recipient-results").innerHTML=(d.members||[]).slice(0,8).map(m=>`<button class="recipient" data-recipient="${esc(m.id)}"><img src="${esc(avatar(m))}"><span>${esc(m.name)}<small>@${esc(m.username||"")}</small></span></button>`).join("");document.querySelectorAll("[data-recipient]").forEach(x=>x.onclick=()=>{selected={id:x.dataset.recipient,name:x.textContent};rs.value=x.textContent;$("#recipient-results").innerHTML="<b class='selected'>تم اختيار المستلم ✓</b>"})};$("#show-name").onchange=e=>$("#sender-name").classList.toggle("hidden",!e.target.checked);$("#send").onclick=sendMessage}
async function sendMessage(){const st=$("#msg-status"),btn=$("#send"),t=$("#msg-text").value.trim(),show=$("#show-name").checked,n=$("#sender-name").value.trim();if(!selected)return st.textContent="اختر مستلمًا أولًا";if(!t)return st.textContent="اكتب الرسالة أولًا";if(show&&!n)return st.textContent="اكتب اسم المرسل";btn.disabled=true;try{const r=await fetch(API_BASE + '/api/public/message',{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({memberId:selected.id,title:$("#msg-title").value.trim()||"رسالة من إدارة MLD",message:show?`من: ${n}\n\n${t}`:t})}),d=await r.json();if(!r.ok)throw Error(d.error);st.textContent="تم الإرسال بنجاح ✓";$("#msg-text").value=""}catch(e){st.textContent=e.message||"تعذر الإرسال"}finally{btn.disabled=false}}
async function openMember(id){openModal();box.innerHTML="<div class='loading'>جاري التحميل...</div>";const m=await fetch(API_BASE + '/api/public/member/${id}`).then(r=>r.json()),s=m.stats||{};box.innerHTML=`<div class="profile"><div class="profile-head"><img src="${esc(avatar(m))}"><div><p class="eyebrow">ملف العضو</p><h2>${esc(m.name)}</h2><p class="muted">@${esc(m.username||"")}</p><span class="badge">${esc(m.rank||"عضو")}</span></div></div><div class="stats">${[[s.messages,"رسالة"],[s.mentionsReceived,"منشن جاه"],[s.mentionsSent,"منشن أرسله"],[`${Math.floor((s.voiceMinutes||0)/60)}س ${(s.voiceMinutes||0)%60}د`,"وقت صوتي"],[s.voiceJoins,"دخول صوتي"],[s.chatRounds,"نشاط شات"]].map(x=>`<b>${esc(num(x[0]))}<small>${x[1]}</small></b>`).join("")}</div><h3>كل الرتب</h3><div class="roles">${(m.roles||[]).map(x=>`<span class="role">${esc(x.name)}</span>`).join("")||`<span class="muted">لا توجد رتب</span>`}</div><h3>أقوى الصلاحيات</h3><div class="permission-box">${m.permissions?.length?m.permissions.map(x=>`<span class="permission">${esc(x)}</span>`).join(""):`<span class="muted">لا توجد</span>`}</div></div>`}
async function openRole(id){openModal();box.innerHTML="<div class='loading'>جاري تحميل الرتبة...</div>";const d=await fetch(API_BASE + '/api/public/roles/${id}/members`).then(r=>r.json());box.innerHTML=`<p class="eyebrow">دليل الرتبة</p><h2>${esc(d.role.name)}</h2><div class="role-meta"><b>${num(d.role.membersCount)} عضو فعلي</b></div><div class="permission-box">${d.role.permissions?.map(x=>`<span class="permission">${esc(x)}</span>`).join("")||`<span class="muted">لا توجد</span>`}</div><h3>الأعضاء</h3><div class="grid compact">${(d.members||[]).map(card).join("")||`<p class="muted">لا يوجد أعضاء بهذه الرتبة.</p>`}</div>`;bind()}
async function refresh(){if(!content||!status||!search||!searchWrap||!title||!subtitle)return;try{const[sr,rr]=await Promise.all([fetch(API_BASE + '/api/public/server'),fetch(API_BASE + '/api/public/roles')]),s=await sr.json(),rd=await rr.json();$("#server-name").textContent=s.name||"MLD";$("#server-count").textContent=num(s.memberCount);roles=rd.roles||[];if(view==="members"&&!search.value){const d=await fetch(API_BASE + '/api/public/members').then(r=>r.json());all=d.members||[];renderMembers(all);setStatus(`${num(all.length)} عضو`)}else if(view==="roles")renderRoles();else if(view==="top")renderTop(await fetch(API_BASE + '/api/public/top').then(r=>r.json()))}catch(e){setStatus("تعذر تحديث البيانات")}}
async function searchMembers(){if(!search)return;clearTimeout(timer);const q=search.value.trim();if(!q){renderMembers(all);setStatus(`${num(all.length)} عضو`);return}setStatus("جاري البحث...");timer=setTimeout(async()=>{const d=await fetch(API_BASE + `/api/public/members?q=${encodeURIComponent(q)}`).then(r=>r.json());renderMembers(d.members||[]);setStatus(`${num((d.members||[]).length)} نتيجة`)},250)}
async function change(v){if(!content||!title||!subtitle||!searchWrap)return;view=v;closeMenu();if(v==="message")return messageView();if(v==="games")return gamesView();searchWrap.style.display=v==="members"?"flex":"none";title.textContent=v==="members"?"أعضاء المجتمع":v==="roles"?"الرتب القيادية":"لوحة TOP";if(v==="members"||v==="roles")return refresh();renderTop(await fetch(API_BASE + '/api/public/top').then(r=>r.json()));setStatus("تحديث مباشر للنشاط")}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>change(b.dataset.view));
if(search) search.oninput=()=>{if(view!=="members")change("members");searchMembers()};
$("#menu")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();window.toggleMLDMenu(e)});
$("#menu-close")?.addEventListener("click",closeMenu);
backdrop?.addEventListener("click",closeMenu);
mobile?.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));
$("#close")?.addEventListener("click",closeModal);
modal?.addEventListener("click",e=>{if(e.target===modal)closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeMenu()}});
const yearEl=$("#year");
if(yearEl) yearEl.textContent=new Date().getFullYear();
refresh();
refreshTimer=setInterval(()=>{if(!content)return;if(modal&&!modal.classList.contains("hidden")||view==="message")return;refresh()},15000);
/* ===== Homepage live dashboard override ===== */
(async function initHomeDashboard(){
  const serverName=document.getElementById('server-name');
  const count=document.getElementById('server-count');
  const online=document.getElementById('server-online');
  const visits=document.getElementById('server-visits');
  const statusEl=document.getElementById('server-status');
  const track=document.getElementById('home-reviews');
  if(!track)return;

  async function loadServer(){
    try{
      const r=await fetch(API_BASE + '/api/public/server',{cache:'no-store'});
      const d=await r.json();
      if(serverName) serverName.textContent=d.name||'MLD';
      if(count) count.textContent=num(d.memberCount);
      if(online) online.textContent=num(d.onlineCount);
      if(visits) visits.textContent=num(d.visits);
      const discordFloat=document.getElementById('discord-float');
      if(discordFloat && d.invite) discordFloat.href=d.invite;
      if(statusEl) statusEl.textContent='● متصل';
      if(statusEl) statusEl.className='online';
    }catch(e){
      if(statusEl) statusEl.textContent='● غير متاح';
      if(statusEl) statusEl.className='';
    }
  }

  async function loadReviews(){
    try{
      const r=await fetch(API_BASE + '/api/community/reviews',{cache:'no-store'});
      const d=await r.json();
      const list=d.reviews||[];
      if(!list.length){
        track.innerHTML='<div class="review-card"><div class="review-stars">★★★★★</div><h3>كن أول من يترك رأيه</h3><p>شاركنا تجربتك في MLD وسيظهر رأيك هنا بشكل جميل.</p><div class="review-meta"><span>MLD Community</span><span>♡</span></div></div>';
        return;
      }
      const cards=list.map(x=>`<article class="review-card"><div class="review-stars">${'★'.repeat(Math.max(1,Math.min(5,Number(x.rating)||5)))}</div><h3>${esc(x.username||'عضو MLD')}</h3><p>${esc(x.content||'')}</p><div class="review-meta"><span>عضو في MLD</span><span>رأي موثّق</span></div></article>`).join('');
      track.innerHTML=cards+cards;
    }catch(e){
      track.innerHTML='<div class="review-card"><h3>آراء الناس عنّا</h3><p>تعذر تحميل الآراء الآن، جرّب تحديث الصفحة.</p></div>';
    }
  }

  await Promise.all([loadServer(),loadReviews()]);
  setInterval(loadServer,15000);
  setInterval(loadReviews,30000);
})();
