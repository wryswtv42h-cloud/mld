"use strict";
const API_BASE="https://api-production-5bddb.up.railway.app";
const $=s=>document.querySelector(s), num=v=>new Intl.NumberFormat("ar-SA").format(Number(v)||0);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function closeMenu(){const m=$("#mobile-menu"),b=$("#menu-backdrop");m?.classList.remove("open");b?.classList.remove("open");document.body.classList.remove("menu-open");$("#menu")?.setAttribute("aria-expanded","false")}
function openMenu(){const m=$("#mobile-menu"),b=$("#menu-backdrop");m?.classList.add("open");b?.classList.add("open");document.body.classList.add("menu-open");$("#menu")?.setAttribute("aria-expanded","true")}
document.addEventListener("DOMContentLoaded",()=>{
 $("#menu")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();m=$("#mobile-menu");m?.classList.contains("open")?closeMenu():openMenu()});
 $("#menu-close")?.addEventListener("click",closeMenu);$("#menu-backdrop")?.addEventListener("click",closeMenu);
 document.querySelectorAll("#mobile-menu a").forEach(a=>a.addEventListener("click",closeMenu));
 loadMLDStats();loadReviews();setInterval(loadMLDStats,15000);
});
async function loadMLDStats(){try{const d=await fetch(API_BASE+"/api/public/server",{cache:"no-store"}).then(r=>r.json());$("#server-name")&&( $("#server-name").textContent=d.name||"MLD");$("#server-count")&&($("#server-count").textContent=d.memberCount==null?"—":num(d.memberCount));$("#server-online")&&($("#server-online").textContent=d.onlineCount==null?"—":num(d.onlineCount));$("#server-visits")&&($("#server-visits").textContent=d.visits==null?"—":num(d.visits));$("#server-status")&&($("#server-status").textContent=d.error?"● غير متاح":"● متصل")}catch(e){$("#server-status")&&($("#server-status").textContent="● غير متاح")}}
async function loadReviews(){try{const d=await fetch(API_BASE+"/api/community/reviews",{cache:"no-store"}).then(r=>r.json()),e=$("#home-reviews");if(!e)return;e.innerHTML=(d.reviews||[]).slice(0,6).map(x=>'<article class="review-card"><div class="stars">★★★★★</div><h3>'+esc(x.username||"عضو MLD")+'</h3><p>'+esc(x.content||"")+"</p></article>").join("")||'<div class="loading">لا توجد آراء حتى الآن.</div>'}catch{}}
