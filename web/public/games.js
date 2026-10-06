const API_BASE='https://api-production-5bddb.up.railway.app';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const authToken=()=>localStorage.getItem('token')||localStorage.getItem('mld_token');
async function loadSessions(){
 const list=document.getElementById('sessions-list'); if(!list)return;
 try{const r=await fetch(API_BASE+'/api/games/sessions',{cache:'no-store'}),d=await r.json();
 list.innerHTML=d.sessions?.length?d.sessions.map(s=>'<div class="session-item"><div><h4>'+esc(s.name||s.game_type||'لعبة')+'</h4><p>'+esc(s.host_name||'مضيف')+' · '+(s.players?.length||0)+'/'+(s.max_players||'?')+'</p></div><a class="primary" href="game.html?id='+encodeURIComponent(s.id)+'">انضم</a></div>').join(''):'<p class="muted">لا توجد جلسات حالياً</p>';
 }catch(e){list.innerHTML='<p class="muted">تعذر تحميل الجلسات الآن</p>'}
}
document.querySelectorAll('[data-game]').forEach(card=>{
 card.querySelector('button')?.addEventListener('click',async()=>{
  if(!authToken()){location.href='app.html#login';return;}
  const type=card.dataset.game;
  try{
   const r=await fetch(API_BASE+'/api/games/sessions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+authToken()},body:JSON.stringify({game_type:type})});
   const d=await r.json(); if(!r.ok)throw Error(d.error||'تعذر إنشاء الجلسة');
   location.href='game.html?id='+encodeURIComponent(d.session.id);
  }catch(e){alert(e.message)}
 });
});
loadSessions();setInterval(loadSessions,10000);