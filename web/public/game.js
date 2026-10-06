const API='https://api-production-5bddb.up.railway.app';
const token=()=>localStorage.getItem('mld_token')||localStorage.getItem('token');
const params=new URLSearchParams(location.search);
const id=params.get('id');
const type=params.get('type');
const guest=params.get('name')||localStorage.getItem('guestName')||'زائر';
const titles={uno:'أونو',jaccaro:'جاكارو',codenames:'كود نيمز',baloot:'بلوت',ludo:'لودو',monopoly:'مونوبولي',maqousar:'مقوصر'};
let socket,session,state;

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function createAndJoin(){
  if(id)return;
  if(!type)return fail('لم يتم تحديد اللعبة');
  const r=await fetch(API+'/api/games/sessions',{method:'POST',headers:{'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}: {})},body:JSON.stringify({game_type:type,guest_name:guest})});
  const d=await r.json(); if(!r.ok)throw new Error(d.error||'تعذر إنشاء الجلسة');
  location.replace('game.html?id='+encodeURIComponent(d.session.id));
}
async function loadSession(){
  const r=await fetch(API+'/api/games/sessions/'+encodeURIComponent(id),{cache:'no-store'});
  const d=await r.json(); if(!r.ok)throw new Error(d.error||'الجلسة غير موجودة');
  session=d.session; render();
}
function connect(){
  socket=window.io(API,{transports:['websocket','polling'],auth:{token:token()||undefined}});
  socket.on('connect',()=>socket.emit('game:join',{sessionId:id,asSpectator:false}));
  socket.on('game:update',d=>{session={...session,...d};state=d.state||state;render();});
  socket.on('game:chat',m=>addChat(m));
  socket.on('game:error',e=>toast(e.error));
  socket.on('game:finished',d=>toast('🏆 الفائز: '+(d.winner||'غير محدد')));
}
function render(){
  $('gameTitle').textContent=titles[session?.game_type||session?.type]||'لعبة MLD';
  $('gamePlayers').innerHTML=(session?.players||[]).map(p=>'<span class="player-chip '+(state?.players?.[state.currentIndex]===p.name?'active':'')+'">● '+esc(p.name)+'</span>').join('');
  $('tableStatus').textContent=session?.status==='playing'?'اللعبة شغالة':'بانتظار البدء';
  $('overlayText').textContent=session?.status==='playing'?'اللعبة بدأت — استمتع!':'بانتظار صاحب الجلسة لبدء اللعبة';
  $('startBtn').style.display=session?.status==='playing'?'none':canStart()?'inline-flex':'none';
  if(session?.status==='playing')$('startOverlay').style.display='none'; else $('startOverlay').style.display='grid';
  renderGame();
}
function canStart(){return token() && String(session?.host_id||'')===String(JSON.parse(localStorage.getItem('user')||'{}').id||'');}
function renderGame(){
  const type=state?.game||session?.game_type||session?.type;
  const box=$('gameActions'); if(!box)return;
  if(!state){box.innerHTML='<span class="muted">تبدأ الطاولة بعد بدء الجلسة.</span>';return;}
  if(type==='uno')box.innerHTML=renderUno();
  else if(type==='codenames')box.innerHTML=renderCodenames();
  else if(type==='maqousar')box.innerHTML=renderMaqousar();
  else box.innerHTML='<button class="action-btn" data-action="roll">🎲 رمية / حركة</button>';
  box.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>sendAction(JSON.parse(b.dataset.action)));
}
function renderUno(){
 const me=JSON.parse(localStorage.getItem('mld_user')||'{}').username||guest,hand=state.hands?.[me]||[];
 return '<div class="game-hand">'+hand.map((c,i)=>'<button class="action-btn card-btn" data-action=\''+JSON.stringify({type:'play',card:c,color:c.color==='wild'?'red':undefined})+'\'>'+esc(c.value)+'<small>'+esc(c.color)+'</small></button>').join('')+'</div><button class="action-btn secondary" data-action=\'{"type":"draw"}\'>سحب ورقة</button>';
}
function renderCodenames(){
 return '<div class="codenames-board">'+(state.words||[]).map((w,i)=>'<button class="codenames-word '+(w.revealed?w.color:'hidden')+'" data-action=\''+JSON.stringify({type:'guess',index:i})+'\'>'+esc(w.word)+'</button>').join('')+'</div><button class="action-btn secondary" data-action=\'{"type":"end-turn"}\'>إنهاء الدور</button>';
}
function renderMaqousar(){
 const me=JSON.parse(localStorage.getItem('mld_user')||'{}').username||guest,hand=state.hands?.[me];
 if(!hand)return '<span class="muted">بانتظار دورك.</span>';
 return '<div class="game-hand">'+(hand.top||[]).map((c,i)=>'<button class="action-btn card-btn" data-action=\''+JSON.stringify({type:'swap-top',index:i})+'\'>'+esc(c.rank)+'</button>').join('')+'</div><button class="action-btn" data-action=\'{"type":"draw"}\'>سحب</button><button class="action-btn secondary" data-action=\'{"type":"discard"}\'>طش</button>';
}
function sendAction(action){if(!socket)return;socket.emit('game:action',{sessionId:id,action});}
function addChat(m){const e=document.createElement('div');e.className='chat-msg';e.innerHTML='<b>'+esc(m.name)+'</b><div>'+esc(m.message)+'</div>'; $('chatBody').appendChild(e);$('chatBody').scrollTop=$('chatBody').scrollHeight;}
function toast(t){const e=document.createElement('div');e.className='mld-toast';e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),2600);}
function fail(t){document.body.innerHTML='<main class="wrap" style="padding:80px 20px;text-align:center"><section class="panel"><h2>'+esc(t)+'</h2><a class="primary" href="games.html">العودة للألعاب</a></section></main>';}
$('startBtn').onclick=()=>socket?.emit('game:start',{sessionId:id});
$('chatSend').onclick=()=>{const i=$('chatInput');if(i.value.trim())socket?.emit('game:chat',{sessionId:id,message:i.value.trim()});i.value='';};
$('chatInput').onkeydown=e=>{if(e.key==='Enter')$('chatSend').click();};
(async()=>{try{await createAndJoin();await loadSession();connect();}catch(e){fail(e.message);}})();