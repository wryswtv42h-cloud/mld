const API_BASE='https://api-production-5bddb.up.railway.app';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const authToken=()=>localStorage.getItem('token')||localStorage.getItem('mld_token');
const guestName=()=>{let n=localStorage.getItem('mld_guest_name');if(!n){n='زائر-'+Math.random().toString(36).slice(2,7);localStorage.setItem('mld_guest_name',n)}return n};
async function loadSessions(){
 const list=document.getElementById('sessions-list'); if(!list)return;
 try{const r=await fetch(API_BASE+'/api/games/sessions',{cache:'no-store'}),d=await r.json();
 list.innerHTML=d.sessions?.length?d.sessions.map(s=>'<div class="session-item"><div><h4>'+esc(s.name||s.game_type||'لعبة')+'</h4><p>'+esc(s.host_name||'زائر')+' · '+(s.players?.length||0)+'/'+(s.max_players||'?')+'</p></div><a class="primary" href="game.html?id='+encodeURIComponent(s.id)+'">انضم</a></div>').join(''):'<p class="muted">لا توجد جلسات حالياً</p>';
 }catch(e){list.innerHTML='<p class="muted">تعذر تحميل الجلسات الآن</p>'}
}
document.querySelectorAll('[data-game]').forEach(card=>{
 card.querySelector('button')?.addEventListener('click',async()=>{
  const type=card.dataset.game;
  try{
   const headers={'Content-Type':'application/json'};
   if(authToken())headers.Authorization='Bearer '+authToken();
   const r=await fetch(API_BASE+'/api/games/sessions',{method:'POST',headers,body:JSON.stringify({game_type:type,guest_name:guestName()})});
   const d=await r.json(); if(!r.ok)throw Error(d.error||'تعذر إنشاء الجلسة');
   location.href='game.html?id='+encodeURIComponent(d.session.id);
  }catch(e){alert(e.message)}
 });
});
loadSessions();setInterval(loadSessions,10000);