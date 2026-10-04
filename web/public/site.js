const MLD_API='https://api-production-5bddb.up.railway.app';

const $=id=>document.getElementById(id);
const escMLD=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const closeHomeMenu=()=>{ $('mobile-menu')?.classList.remove('open'); $('menu-backdrop')?.classList.remove('open'); $('mobile-menu')?.setAttribute('aria-hidden','true'); $('menu')?.setAttribute('aria-expanded','false'); document.body.classList.remove('menu-open'); };

function bindHomeMenu(){
  $('menu-close')?.addEventListener('click',closeHomeMenu);
  $('menu-backdrop')?.addEventListener('click',closeHomeMenu);
  document.querySelectorAll('#mobile-menu a').forEach(a=>a.addEventListener('click',()=>setTimeout(closeHomeMenu,80)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeHomeMenu();});
}

async function homeServer(){
  try{
    const r=await fetch(MLD_API+'/api/public/server',{cache:'no-store'});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'server');
    $('server-name').textContent=d.name||'MLD';
    $('server-count').textContent=Number(d.memberCount||0).toLocaleString('ar-SA');
    $('server-online').textContent=Number(d.onlineCount||0).toLocaleString('ar-SA');
    $('server-visits').textContent=Number(d.visits||0).toLocaleString('ar-SA');
    $('server-status').textContent='● متصل';
    $('server-status').classList.add('online');
  }catch(e){
    $('server-name').textContent='MLD';
    $('server-count').textContent='غير متاح';
    $('server-online').textContent='غير متاح';
    $('server-visits').textContent='غير متاح';
    $('server-status').textContent='● تعذر الاتصال';
  }
}

async function homeReviews(){
  const el=$('home-reviews'); if(!el)return;
  try{
    const r=await fetch(MLD_API+'/api/community/reviews',{cache:'no-store'}),d=await r.json();
    const items=d.reviews||[];
    el.innerHTML=items.length?items.slice(0,9).map(x=>'<article class="review-card"><strong>'+escMLD(x.username||'عضو')+'</strong><div class="stars">★'.repeat(Number(x.rating)||5)+'</div><p>'+escMLD(x.content)+'</p></article>').join(''):'<div class="loading">لا توجد آراء منشورة بعد.</div>';
  }catch{el.innerHTML='<div class="loading">تعذر تحميل الآراء حالياً.</div>';}
}

document.addEventListener('DOMContentLoaded',()=>{bindHomeMenu();homeServer();homeReviews();setInterval(homeServer,30000);$('year')&&($('year').textContent=new Date().getFullYear());});
