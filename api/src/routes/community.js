import express from 'express';
import { query } from '../db.js';
import { requireAuth, requireOwner, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const discordToken = () => process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
const guildId = () => process.env.DISCORD_GUILD_ID;
async function resolveDiscordId(value){
  const input=String(value||'').trim();
  if(/^\d{17,20}$/.test(input)) return input;
  const token=discordToken(), guild=guildId();
  if(!token||!guild) return null;
  const found=await discordApi('/guilds/'+guild+'/members/search?query='+encodeURIComponent(input)+'&limit=10');
  const exact=(found||[]).find(m=>String(m.user?.username||'').toLowerCase()===input.toLowerCase()||String(m.user?.global_name||'').toLowerCase()===input.toLowerCase());
  return exact?.user?.id||null;
}
async function dmDiscord(discordId,content){
  if(!discordId||!discordToken()) return false;
  const ch=await fetch('https://discord.com/api/v10/users/@me/channels',{method:'POST',headers:{Authorization:'Bot '+discordToken(),'Content-Type':'application/json'},body:JSON.stringify({recipient_id:String(discordId)})});
  if(!ch.ok) return false;
  const channel=await ch.json();
  const msg=await fetch('https://discord.com/api/v10/channels/'+channel.id+'/messages',{method:'POST',headers:{Authorization:'Bot '+discordToken(),'Content-Type':'application/json'},body:JSON.stringify({content})});
  return msg.ok;
}
async function discordApi(path, options={}) {
  const r = await fetch('https://discord.com/api/v10'+path,{...options,headers:{Authorization:'Bot '+discordToken(),'Content-Type':'application/json',...(options.headers||{})}});
  const text = await r.text();
  let data; try { data=JSON.parse(text); } catch { data={}; }
  if(!r.ok) throw new Error(data.message || 'Discord API '+r.status);
  return data;
}
async function audit(actor, action, target, meta={}) {
  await query('INSERT INTO audit_logs(actor_id,actor_name,action,target,meta) VALUES($1,$2,$3,$4,$5)',[actor.id,actor.username,action,target,JSON.stringify(meta)]);
}


router.get('/settings/:key',requireAuth,async(req,res)=>{
  if(!['application_questions','ticket_questions'].includes(req.params.key))return res.status(404).json({error:'الإعداد غير موجود'});
  const q=await query('SELECT value FROM site_settings WHERE key=$1',[req.params.key]); res.json({value:q.rows[0]?.value||[]});
});
router.patch('/settings/:key',requireAuth,requireOwner,async(req,res)=>{
  if(!['application_questions','ticket_questions'].includes(req.params.key))return res.status(404).json({error:'الإعداد غير موجود'});
  if(!Array.isArray(req.body.value))return res.status(400).json({error:'القيمة يجب أن تكون قائمة'});
  await query('INSERT INTO site_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()',[req.params.key,JSON.stringify(req.body.value)]);
  await audit(req.user,'settings_update',req.params.key,{});
  res.json({message:'تم الحفظ'});
});
router.get('/audit',requireAuth,requireOwner,async(req,res)=>{const {rows}=await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');res.json({logs:rows});});

router.get('/chat', async (req,res)=>{ const {rows}=await query('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 100'); res.json({messages:rows.reverse()}); });
router.post('/chat', requireAuth, async (req,res)=>{ const content=String(req.body.content||'').trim(); if(!content)return res.status(400).json({error:'اكتب رسالة'}); const {rows}=await query('INSERT INTO chat_messages(user_id,sender_name,sender_avatar,content) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,req.user.username,req.user.avatar||'',content]); res.json({message:rows[0]}); });

router.get('/reviews', async (req,res)=>{ const {rows}=await query('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 100'); res.json({reviews:rows}); });
router.post('/reviews', requireAuth, async (req,res)=>{ const content=String(req.body.content||'').trim(); const rating=Math.max(1,Math.min(5,Number(req.body.rating)||5)); if(!content)return res.status(400).json({error:'اكتب رأيك'}); const {rows}=await query('INSERT INTO reviews(user_id,username,content,rating) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,req.user.username,content,rating]); res.json({review:rows[0]}); });
router.delete('/reviews/:id', requireAuth, requireOwner, async(req,res)=>{await query('DELETE FROM reviews WHERE id=$1',[req.params.id]);res.json({message:'تم الحذف'});});

router.get('/tickets', requireAuth, async(req,res)=>{ const admin=!!req.user.is_owner || ['admin','owner'].includes(String(req.user.role||'').toLowerCase()); const {rows}=await query('SELECT * FROM tickets WHERE user_id=$1 OR $2=true ORDER BY created_at DESC',[req.user.id,admin]); res.json({tickets:rows}); });
router.post('/tickets', requireAuth, async(req,res)=>{const subject=String(req.body.subject||'').trim(),content=String(req.body.content||'').trim();if(!subject||!content)return res.status(400).json({error:'أكمل بيانات التذكرة'});const {rows}=await query('INSERT INTO tickets(user_id,subject,content,status) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,subject,content,'open']);res.json({ticket:rows[0]});});
router.get('/tickets/:id',requireAuth,async(req,res)=>{const admin=!!req.user.is_owner || ['admin','owner'].includes(String(req.user.role||'').toLowerCase()); const t=await query('SELECT * FROM tickets WHERE id=$1 AND (user_id=$2 OR $3=true)',[req.params.id,req.user.id,admin]);if(!t.rows[0])return res.status(404).json({error:'التذكرة غير موجودة'});const m=await query('SELECT * FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at',[req.params.id]);res.json({ticket:t.rows[0],messages:m.rows});});
router.post('/tickets/:id/messages',requireAuth,async(req,res)=>{const admin=!!req.user.is_owner || ['admin','owner'].includes(String(req.user.role||'').toLowerCase()); const c=String(req.body.content||'').trim();if(!c)return res.status(400).json({error:'اكتب رد'});const t=await query('SELECT * FROM tickets WHERE id=$1 AND (user_id=$2 OR $3=true)',[req.params.id,req.user.id,admin]);if(!t.rows[0])return res.status(403).json({error:'غير مصرح'});const {rows}=await query('INSERT INTO ticket_messages(ticket_id,user_id,sender_name,content) VALUES($1,$2,$3,$4) RETURNING *',[req.params.id,req.user.id,req.user.username,c]);res.json({message:rows[0]});});
router.post('/tickets/:id/claim',requireAuth,requireAdmin,async(req,res)=>{const {rows}=await query('UPDATE tickets SET claimed_by=$1 WHERE id=$2 AND status <> \'closed\' RETURNING *',[req.user.id,req.params.id]);if(!rows[0])return res.status(404).json({error:'التذكرة غير متاحة'});await audit(req.user,'ticket_claim',String(req.params.id));res.json({ticket:rows[0]});});
router.post('/tickets/:id/close',requireAuth,requireAdmin,async(req,res)=>{const {rows}=await query('SELECT * FROM tickets WHERE id=$1',[req.params.id]);if(!rows[0])return res.status(404).json({error:'غير موجود'});await query("UPDATE tickets SET status='closed',closed_at=NOW() WHERE id=$1",[req.params.id]);res.json({message:'تم إغلاق التذكرة'});});

router.get('/applications',requireAuth,async(req,res)=>{const owner=!!req.user.is_owner; const {rows}=await query('SELECT * FROM applications WHERE user_id=$1 OR $2=true ORDER BY created_at DESC',[req.user.id,owner]);res.json({applications:rows});});
router.post('/applications',requireAuth,async(req,res)=>{const discord_id=String(req.body.discord_id||req.user.discord_id||'').trim();if(!discord_id)return res.status(400).json({error:'أدخل Discord ID'});const resolved=await resolveDiscordId(discord_id);if(!resolved||String(resolved)!==String(req.user.discord_id))return res.status(400).json({error:'يجب استخدام حساب ديسكورد الموثق المرتبط بحسابك'});const answers=req.body.answers||{};const {rows}=await query("INSERT INTO applications(user_id,discord_id,answers,status) VALUES($1,$2,$3,'pending') RETURNING *",[req.user.id,resolved,JSON.stringify(answers)]);res.json({application:rows[0]});});
router.post('/applications/:id/status',requireAuth,requireOwner,async(req,res)=>{
  const status=String(req.body.status||'pending'); if(!['pending','accepted','rejected'].includes(status))return res.status(400).json({error:'حالة غير صحيحة'});
  const {rows}=await query('SELECT * FROM applications WHERE id=$1',[req.params.id]); if(!rows[0])return res.status(404).json({error:'التقديم غير موجود'});
  await query('UPDATE applications SET status=$1 WHERE id=$2',[status,req.params.id]);
  if(status==='accepted'){
    const roles=await discordApi('/guilds/'+guildId()+'/roles');
    const adminRoles=roles.filter(r=>!r.managed && r.name.toLowerCase().includes('admin')).sort((a,b)=>(a.position||0)-(b.position||0));
    const role=adminRoles[0];
    if(role && /^\d+$/.test(String(rows[0].discord_id))) await discordApi('/guilds/'+guildId()+'/members/'+rows[0].discord_id+'/roles/'+role.id,{method:'PUT',body:'{}'});
    await query("UPDATE users SET role='admin' WHERE id=$1",[rows[0].user_id]);
  }
  await audit(req.user,'application_'+status,String(req.params.id));
  res.json({message:'تم التحديث'});
});

router.get('/groups',async(req,res)=>{const {rows}=await query("SELECT * FROM groups WHERE status='approved' ORDER BY created_at DESC");res.json({groups:rows});});
router.get('/groups/all',requireAuth,requireOwner,async(req,res)=>{const {rows}=await query("SELECT * FROM groups ORDER BY created_at DESC");res.json({groups:rows});});
router.post('/groups',requireAuth,async(req,res)=>{const name=String(req.body.name||'').trim();if(!name)return res.status(400).json({error:'اكتب اسم القروب'});const {rows}=await query("INSERT INTO groups(owner_id,name,description,status) VALUES($1,$2,$3,'pending') RETURNING *",[req.user.id,String(name),String(req.body.description||'')]);try{const ownerId=await resolveDiscordId(process.env.OWNER_DISCORD_ID||'w4px');if(ownerId)await dmDiscord(ownerId,'📥 طلب قروب جديد في MLD\\nالاسم: '+name+'\\nالمقدم: '+req.user.username+'\\nرقم الطلب: '+rows[0].id);}catch(e){console.error('group owner DM:',e.message);}await audit(req.user,'group_created',String(rows[0].id));res.json({group:rows[0],message:'تم إنشاء طلب القروب'});});
router.post('/groups/:id/join',requireAuth,async(req,res)=>{const g=await query("SELECT * FROM groups WHERE id=$1 AND status='approved'",[req.params.id]);if(!g.rows[0])return res.status(404).json({error:'القروب غير موجود'});const {rows}=await query("INSERT INTO group_members(group_id,user_id,status) VALUES($1,$2,'pending') ON CONFLICT DO NOTHING RETURNING *",[req.params.id,req.user.id]);res.json({member:rows[0]||null,message:'تم إرسال طلب الانضمام'});});
router.post('/groups/:id/status',requireAuth,requireOwner,async(req,res)=>{
  const status=String(req.body.status||'pending'); if(!['pending','approved','rejected','deleted'].includes(status))return res.status(400).json({error:'حالة غير صحيحة'});
  const gq=await query('SELECT * FROM groups WHERE id=$1',[req.params.id]); const g=gq.rows[0]; if(!g)return res.status(404).json({error:'القروب غير موجود'});
  if(status==='approved' && g.status!=='approved'){
    const cat=await discordApi('/guilds/'+guildId()+'/channels',{method:'POST',body:JSON.stringify({name:g.name,type:4})});
    const textCh=await discordApi('/guilds/'+guildId()+'/channels',{method:'POST',body:JSON.stringify({name:'chat',type:0,parent_id:cat.id})});
    const voice=await discordApi('/guilds/'+guildId()+'/channels',{method:'POST',body:JSON.stringify({name:'Voice',type:2,parent_id:cat.id})});
    const role=await discordApi('/guilds/'+guildId()+'/roles',{method:'POST',body:JSON.stringify({name:g.name,reason:'MLD group '+g.id})});
    await query('UPDATE groups SET status=$1,discord_category_id=$2,discord_text_channel_id=$3,discord_voice_channel_id=$4,discord_role_id=$5 WHERE id=$6',[status,cat.id,textCh.id,voice.id,role.id,g.id]);
    await query('UPDATE group_members SET status=\'approved\' WHERE group_id=$1 AND user_id=$2',[g.id,g.owner_id]);
    const owner=await query('SELECT discord_id FROM users WHERE id=$1',[g.owner_id]);
    if(owner.rows[0]?.discord_id && /^\d+$/.test(String(owner.rows[0].discord_id))) await discordApi('/guilds/'+guildId()+'/members/'+owner.rows[0].discord_id+'/roles/'+role.id,{method:'PUT',body:'{}'});
    if(owner.rows[0]?.discord_id) await dmDiscord(owner.rows[0].discord_id,'✅ تمت الموافقة على قروبك «'+g.name+'»\\nتم إنشاء الرتبة والقنوات الخاصة به.');
    await audit(req.user,'group_approved',String(g.id),{category:cat.id,text:textCh.id,voice:voice.id,role:role.id});
  } else { await query('UPDATE groups SET status=$1 WHERE id=$2',[status,g.id]); await audit(req.user,'group_'+status,String(g.id)); }
  res.json({message:'تم تحديث القروب'});
});
router.post('/groups/:id/members/:memberId/status',requireAuth,requireOwner,async(req,res)=>{
  const status=String(req.body.status||'approved'); const g=await query('SELECT * FROM groups WHERE id=$1',[req.params.id]); if(!g.rows[0])return res.status(404).json({error:'القروب غير موجود'});
  if(status!=='approved'&&status!=='rejected')return res.status(400).json({error:'حالة غير صحيحة'});
  const gm=await query('UPDATE group_members SET status=$1 WHERE group_id=$2 AND user_id=$3 RETURNING *',[status,req.params.id,req.params.memberId]); if(!gm.rows[0])return res.status(404).json({error:'طلب الانضمام غير موجود'});
  if(status==='approved' && g.rows[0].discord_role_id){ const u=await query('SELECT discord_id FROM users WHERE id=$1',[req.params.memberId]); if(u.rows[0]?.discord_id && /^\d+$/.test(String(u.rows[0].discord_id))) await discordApi('/guilds/'+guildId()+'/members/'+u.rows[0].discord_id+'/roles/'+g.rows[0].discord_role_id,{method:'PUT',body:'{}'}); }
  const applicant=await query('SELECT discord_id FROM users WHERE id=$1',[req.params.memberId]); if(applicant.rows[0]?.discord_id) await dmDiscord(applicant.rows[0].discord_id,status==='approved'?'✅ تمت الموافقة على انضمامك إلى قروب «'+g.rows[0].name+'».':'❌ تم رفض طلب انضمامك إلى قروب «'+g.rows[0].name+'».');
  await audit(req.user,'group_member_'+status,req.params.id+':'+req.params.memberId);
  res.json({member:gm.rows[0]});
});

router.get('/pigeon',requireAuth,async(req,res)=>{const {rows}=await query('SELECT * FROM pigeon_messages WHERE sender_id=$1 OR recipient_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id]);res.json({messages:rows.reverse()});});
router.post('/pigeon',requireAuth,async(req,res)=>{const recipient=String(req.body.recipient_id||'').trim(),content=String(req.body.content||'').trim();if(!recipient||!content)return res.status(400).json({error:'أكمل الرسالة'});const {rows}=await query('INSERT INTO pigeon_messages(sender_id,recipient_id,content,anonymous) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,recipient,content,!!req.body.anonymous]);res.json({message:rows[0]});});

router.get('/cinema',async(req,res)=>{const {rows}=await query("SELECT * FROM cinema_rooms WHERE status IS DISTINCT FROM 'closed' ORDER BY created_at DESC");res.json({rooms:rows});});
router.post('/cinema',requireAuth,async(req,res)=>{const title=String(req.body.title||'').trim(),media_url=String(req.body.media_url||'').trim();if(!title||!media_url)return res.status(400).json({error:'أدخل العنوان والرابط'});const {rows}=await query("INSERT INTO cinema_rooms(owner_id,title,media_url,status) VALUES($1,$2,$3,'open') RETURNING *",[req.user.id,title,media_url]);res.json({room:rows[0]});});
router.post('/cinema/:id/close',requireAuth,async(req,res)=>{const {rows}=await query('SELECT * FROM cinema_rooms WHERE id=$1',[req.params.id]);if(!rows[0])return res.status(404).json({error:'الغرفة غير موجودة'});if(String(rows[0].owner_id)!==String(req.user.id)&&!req.user.is_owner)return res.status(403).json({error:'غير مصرح'});await query("UPDATE cinema_rooms SET status='closed' WHERE id=$1",[req.params.id]);res.json({message:'تم الإغلاق'});});

export default router;
