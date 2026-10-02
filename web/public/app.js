const API = location.hostname.includes('railway')
  ? location.origin.replace(/web-/, 'api-').replace(/-web-/, '-api-')
  : 'http://localhost:3000';

let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let mode = 'login';

function toast(t){const el=document.getElementById('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2500)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function initials(n){return (n||'?').slice(0,2).toUpperCase()}

document.querySelectorAll('.tabs button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    mode=b.dataset.tab;
    document.getElementById('discordField').style.display = mode==='register'?'block':'none';
    document.getElementById('submitBtn').textContent = mode==='register'?'تسجيل':'دخول';
  }
});

document.getElementById('authForm').onsubmit = async (e)=>{
  e.preventDefault();
  const msg=document.getElementById('authMsg');
  const username=document.getElementById('username').value.trim();
  const password=document.getElementById('password').value;
  const discord_id=document.getElementById('discord_id').value.trim();
  msg.className='msg show';msg.textContent='جاري...';

  try{
    const r=await fetch(API+'/api/auth/'+mode,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username,password,discord_id})
    });
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'خطأ');

    localStorage.setItem('token',d.token);
    localStorage.setItem('user',JSON.stringify(d.user));
    location.reload();
  }catch(err){
    msg.className='msg show error';msg.textContent=err.message;
  }
};

async function api(path,opts={}){
  const r=await fetch(API+path,{
    ...opts,
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...(opts.headers||{})}
  });
  return r.json();
}

async function initApp(){
  if(!token||!user) return;
  document.body.classList.add('logged');
  document.getElementById('myName').textContent=user.username;
  document.getElementById('myRole').textContent=user.is_owner?'الأونر 👑':'عضو';
  const av=document.getElementById('myAvatar');
  if(user.avatar) av.innerHTML=`<img src="${esc(user.avatar)}">`;
  else av.textContent=initials(user.username);
  if(user.is_owner) document.getElementById('adminLink').style.display='flex';

  document.getElementById('profileName').value=user.username||'';
  document.getElementById('profileBio').value=user.bio||'';

  try{
    const m=await api('/api/discord/members');
    document.getElementById('membersList').innerHTML=(m.members||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  }catch(e){}
  try{
    const g=await api('/api/discord/guilds');
    document.getElementById('guildsList').innerHTML=(g.guilds||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  }catch(e){}

  loadBots();
}

document.querySelectorAll('.sidebar .nav a[data-page]').forEach(a=>{
  a.onclick=()=>{
    const page=a.dataset.page;
    document.querySelectorAll('.sidebar .nav a').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+page).classList.add('active');
    document.getElementById('pageTitle').textContent=a.textContent.trim();
    document.getElementById('sidebar').classList.remove('open');
    if(page==='bots') loadBots();
    if(page==='admin') loadAdmin();
  }
});

document.getElementById('menuBtn').onclick=()=>document.getElementById('sidebar').classList.toggle('open');
document.getElementById('logoutBtn').onclick=()=>{localStorage.clear();location.reload()};

async function loadBots(){
  const d=await api('/api/bots');
  const list=document.getElementById('botsList');
  if(!d.bots||!d.bots.length){list.innerHTML='<p style="color:var(--muted)">ما عندك بوتات بعد.</p>';return}
  list.innerHTML=d.bots.map(b=>`
    <div class="bot-card">
      <h4>🤖 ${esc(b.name)}</h4>
      <p>السيرفر: ${esc(b.guild_id||'—')}</p>
      <p>الحالة: ${b.active?'<span style="color:#70f5b1">● نشط</span>':'<span style="color:#ff8a8d">● متوقف</span>'}</p>
    </div>
  `).join('');
}

document.getElementById('createBotBtn').onclick=async()=>{
  const msg=document.getElementById('botMsg');
  const name=document.getElementById('botName').value.trim();
  const token_=document.getElementById('botToken').value.trim();
  const guild_id=document.getElementById('botGuild').value.trim();
  msg.className='msg show';msg.textContent='جاري...';
  const d=await api('/api/bots',{method:'POST',body:JSON.stringify({name,token:token_,guild_id})});
  if(d.error){msg.className='msg show error';msg.textContent=d.error;return}
  msg.className='msg show success';msg.textContent='تم ✓';
  document.getElementById('botName').value='';
  document.getElementById('botToken').value='';
  document.getElementById('botGuild').value='';
  setTimeout(()=>loadBots(),500);
};

document.getElementById('saveProfileBtn').onclick=async()=>{
  const username=document.getElementById('profileName').value.trim();
  const bio=document.getElementById('profileBio').value.trim();
  const d=await api('/api/users/me',{method:'PATCH',body:JSON.stringify({username,bio})});
  if(d.error) return toast(d.error);
  localStorage.setItem('user',JSON.stringify(d.user));
  user=d.user;
  toast('تم الحفظ ✓');
};

async function loadAdmin(){
  const d=await api('/api/users');
  const list=document.getElementById('ownerUsers');
  if(!d.users) return;
  list.innerHTML=d.users.map(u=>`
    <div class="bot-card">
      <h4>${esc(u.username)}</h4>
      <p>${u.is_owner?'👑 أونر':'عضو'}</p>
      ${!u.is_owner?`<button onclick="banUser('${u.id}')" style="padding:8px 14px;border:0;border-radius:10px;background:#ed4245;color:#fff;font-weight:700;cursor:pointer;margin-top:8px">حظر/فك</button>`:''}
    </div>
  `).join('');
}

window.banUser=async(id)=>{
  const d=await api('/api/users/'+id+'/ban',{method:'POST'});
  toast(d.message||d.error);
  loadAdmin();
};

initApp();
