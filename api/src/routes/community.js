import express from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { requireAuth, requireOwner, requireAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();
const cinemaTokenKey=crypto.createHash('sha256').update(process.env.JWT_SECRET||'mld').digest();
function encryptCinemaToken(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',cinemaTokenKey,iv),data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return 'enc:'+iv.toString('base64url')+':'+cipher.getAuthTag().toString('base64url')+':'+data.toString('base64url')}
function decryptCinemaToken(value){if(!String(value||'').startsWith('enc:'))return value;const [,iv,tag,data]=String(value).split(':');const decipher=crypto.createDecipheriv('aes-256-gcm',cinemaTokenKey,Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8')}

const activeBroadcasts = new Set();
const discordToken = () => process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
const guildId = () => process.env.DISCORD_GUILD_ID;
function requireBotSignature(req,res,next){
  const secret=process.env.MLD_BOT_API_SECRET||'',timestamp=String(req.get('X-MLD-Bot-Timestamp')||''),signature=String(req.get('X-MLD-Bot-Signature')||'');
  if(!secret||!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>60_000)return res.status(401).json({error:'طلب البوت غير موثق أو منتهي'});
  const expected=crypto.createHmac('sha256',secret).update(JSON.stringify(req.body||{})).digest();
  let supplied;try{supplied=Buffer.from(signature,'hex')}catch{return res.status(401).json({error:'توقيع البوت غير صالح'});}
  if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return res.status(401).json({error:'توقيع البوت غير صالح'});
  next();
}
async function botUser(discordId){
  const {rows}=await query('SELECT id,username,discord_id,role,is_owner FROM users WHERE discord_id=$1 AND COALESCE(banned,FALSE)=FALSE ORDER BY is_owner DESC,created_at ASC LIMIT 1',[String(discordId||'')]);
  return rows[0]||null;
}
function isPlatformOwner(user){return !!user?.is_owner;}
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
  const ch=await fetch('https://discord.com/api/v10/users/@me/channels',{method:'POST',headers:{Authorization:'Bot '+discordToken(),'Content-Type':'application/json'},body:JSON.stringify({recipient_id:String(discordId)}),signal:AbortSignal.timeout(7000)});
  if(!ch.ok) return false;
  const channel=await ch.json();
  const msg=await fetch('https://discord.com/api/v10/channels/'+channel.id+'/messages',{method:'POST',headers:{Authorization:'Bot '+discordToken(),'Content-Type':'application/json'},body:JSON.stringify({content}),signal:AbortSignal.timeout(7000)});
  return msg.ok;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function sendDiscordChannelMessage(channelId,content){
  for(let attempt=0;attempt<5;attempt++){
    const response=await fetch('https://discord.com/api/v10/channels/'+encodeURIComponent(messageChannel.id)+'/messages',{method:'POST',headers:{Authorization:'Bot '+discordToken(),'Content-Type':'application/json'},body:JSON.stringify({content,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(15000)});
    if(response.status===429){const limited=await response.json().catch(()=>({}));await pause(Math.max(250,Number(limited.retry_after||1)*1000));continue;}
    if(!response.ok)throw new Error('تعذر الإرسال إلى قناة الإعلان (Discord '+response.status+')');
    return response.json();
  }
  throw new Error('انتهت محاولات انتظار حد Discord');
}
async function runBroadcastJob(id,{title,content,channelId,actor}){
  if(activeBroadcasts.has(String(id)))return;
  activeBroadcasts.add(String(id));
  try{
    await query("UPDATE broadcast_jobs SET status='running' WHERE id=$1",[id]);
    const message=await sendDiscordChannelMessage(channelId,`**${title}**\n${content}`);
    await query("UPDATE broadcast_jobs SET status='completed',total_count=1,sent_count=1,failed_count=0 WHERE id=$1",[id]);
    await audit(actor,'broadcast_sent',String(channelId),{title,message_id:message.id});
  }catch(error){
    console.error('broadcast job',id,error.message);
    await query("UPDATE broadcast_jobs SET status='failed',failed_count=1 WHERE id=$1",[id]).catch(()=>{});
  }finally{activeBroadcasts.delete(String(id));}
}
export async function resumeBroadcastJobs(){
  const channelId=process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
  if(!channelId)return;
  await query("UPDATE broadcast_jobs SET status='failed',failed_count=GREATEST(failed_count,1) WHERE status='running'");
  const {rows}=await query("SELECT id,title,message,created_by FROM broadcast_jobs WHERE status='queued' ORDER BY created_at");
  for(const job of rows){
    const actor=(await query('SELECT id,username FROM users WHERE id::text=$1::text',[job.created_by])).rows[0];
    if(!actor){await query("UPDATE broadcast_jobs SET status='failed' WHERE id=$1",[job.id]);continue;}
    runBroadcastJob(job.id,{title:job.title,content:job.message,channelId,actor}).catch(error=>console.error('resume broadcast:',error.message));
  }
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


router.get('/announcement',async(req,res)=>{const q=await query("SELECT value FROM site_settings WHERE key='announcement'");res.json({announcement:q.rows[0]?.value||{text:'',color:'#ff9cdc',enabled:true}});});
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

router.post('/bot/chat',requireBotSignature,async(req,res)=>{
  try{const user=await botUser(req.body.discord_id);if(!user)return res.status(403).json({error:'اربط حساب الموقع أولاً قبل استخدام شات ملاذ'});const content=String(req.body.content||'').trim();if(!content||content.length>2000)return res.status(400).json({error:'الرسالة فارغة أو أطول من المسموح'});const {rows}=await query("INSERT INTO messages(room_id,sender_id,sender_name,content,type) VALUES('public',$1,$2,$3,'public') RETURNING id,created_at",[user.id,user.username,content]);res.status(201).json({message:'وصلت رسالتك إلى الشات العام',id:rows[0].id});}catch(error){console.error('bot chat:',error.message);res.status(500).json({error:'تعذر إرسال الرسالة'});}
});
router.post('/bot/zajel',requireBotSignature,async(req,res)=>{
  try{const sender=await botUser(req.body.discord_id);if(!sender)return res.status(403).json({error:'اربط حساب الموقع أولاً قبل استخدام الزاجل'});const recipient=String(req.body.recipient||'').trim(),content=String(req.body.content||'').trim().slice(0,2000);if(!recipient||!content)return res.status(400).json({error:'أدخل المستلم والرسالة'});const target=await query('SELECT id,username FROM users WHERE (username=$1 OR discord_id=$1 OR id::text=$1) AND id<>$2 AND banned=FALSE LIMIT 1',[recipient,sender.id]);if(!target.rows[0])return res.status(404).json({error:'المستلم غير موجود أو ليس لديه حساب موقع'});await query('INSERT INTO secret_messages(sender_id,recipient_id,content,anonymous) VALUES($1,$2,$3,$4)',[sender.id,target.rows[0].id,content,!!req.body.anonymous]);res.status(201).json({message:`تم تسليم الزاجل إلى ${target.rows[0].username}`});}catch(error){console.error('bot pigeon:',error.message);res.status(500).json({error:'تعذر إرسال الزاجل'});}
});
router.post('/bot/room',requireBotSignature,async(req,res)=>{
  try{
    const owner=await botUser(req.body.discord_id);if(!owner||!isPlatformOwner(owner))return res.status(403).json({error:'إنشاء الغرف محصور بأونر MLD'});
    const guild=String(req.body.discord_guild_id||''),name=String(req.body.name||'').trim().slice(0,80),isPrivate=!!req.body.is_private;
    if(!name)return res.status(400).json({error:'اكتب اسم الغرفة'});
    if(!guild||guild!==guildId())return res.status(403).json({error:'السيرفر غير مصرح به'});
    const channelOverwrites=isPrivate?[{id:guild,type:0,deny:'1024'},{id:req.body.discord_id,type:1,allow:'1051648'}]:[];
    const category=await discordApi('/guilds/'+guild+'/channels',{method:'POST',body:JSON.stringify({name:name.slice(0,100),type:4,permission_overwrites:channelOverwrites})});
    let textChannel;
    try{textChannel=await discordApi('/guilds/'+guild+'/channels',{method:'POST',body:JSON.stringify({name:'chat',type:0,parent_id:category.id,permission_overwrites:channelOverwrites})});}
    catch(error){await fetch('https://discord.com/api/v10/channels/'+category.id,{method:'DELETE',headers:{Authorization:'Bot '+discordToken()}}).catch(()=>{});throw error;}
    let voiceChannel=null;
    try{voiceChannel=await discordApi('/guilds/'+guild+'/channels',{method:'POST',body:JSON.stringify({name:'Voice',type:2,parent_id:category.id,permission_overwrites:channelOverwrites})});}catch(error){console.warn('room voice channel:',error.message);}
    try{
      const {rows}=await query('INSERT INTO community_rooms(name,voice_name,is_private,created_by,discord_category_id,discord_text_channel_id,discord_voice_channel_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,voice_name,is_private,created_at,discord_text_channel_id,discord_voice_channel_id',[name,voiceChannel?.name||null,isPrivate,owner.id,category.id,textChannel.id,voiceChannel?.id||null]);
      await query('INSERT INTO community_room_members(room_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[rows[0].id,owner.id]);
      await audit(owner,'bot_room_created',String(rows[0].id),{discord_category_id:category.id,discord_text_channel_id:textChannel.id});
      return res.status(201).json({message:'تم إنشاء الشات والروم في Discord والموقع',...rows[0]});
    }catch(error){for(const channel of [voiceChannel,textChannel,category])if(channel?.id)await fetch('https://discord.com/api/v10/channels/'+channel.id,{method:'DELETE',headers:{Authorization:'Bot '+discordToken()}}).catch(()=>{});throw error;}
  }catch(error){console.error('bot room:',error.message);res.status(500).json({error:'تعذر إنشاء الغرفة في Discord'});}
});
router.post('/bot/broadcast',requireBotSignature,async(req,res)=>{
  try{
    const owner=await botUser(req.body.discord_id);if(!owner||!isPlatformOwner(owner))return res.status(403).json({error:'البرودكاست محصور بأونر MLD'});
    const guild=String(req.body.discord_guild_id||''),title=String(req.body.title||'').trim(),content=String(req.body.content||'').trim(),channelId=process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
    if(!title||!content)return res.status(400).json({error:'أدخل العنوان والرسالة'});
    if(!channelId||!discordToken())return res.status(503).json({error:'إعداد قناة الإعلان أو توكن Discord ناقص'});
    if(!guild||guild!==guildId())return res.status(403).json({error:'السيرفر غير مصرح به'});
    const job=await query("INSERT INTO broadcast_jobs(title,message,created_by,status,total_count) VALUES($1,$2,$3,'queued',0) RETURNING id",[title,content,owner.id]);
    runBroadcastJob(job.rows[0].id,{title,content,channelId,actor:owner}).catch(error=>console.error('bot broadcast:',error.message));
    res.status(202).json({message:'تم وضع الإعلان في قائمة الإرسال',job_id:job.rows[0].id});
  }catch(error){console.error('bot broadcast:',error.message);res.status(500).json({error:'تعذر بدء البرودكاست'});}
});
router.post('/owner/broadcast',requireAuth,requireOwner,async(req,res)=>{
  const title=String(req.body.title||'').trim(),content=String(req.body.content||'').trim(),channelId=process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
  if(!title||!content)return res.status(400).json({error:'أدخل العنوان والرسالة'});
  if(!channelId||!discordToken())return res.status(503).json({error:'إعداد قناة إعلان Discord ناقص'});
  const job=await query("INSERT INTO broadcast_jobs(title,message,created_by,status,total_count) VALUES($1,$2,$3,'queued',0) RETURNING id",[title,content,req.user.id]);
  runBroadcastJob(job.rows[0].id,{title,content,channelId,actor:req.user}).catch(error=>console.error('owner broadcast:',error.message));
  res.status(202).json({message:'وُضع الإعلان في قائمة الإرسال',job_id:job.rows[0].id});
});

router.get('/chat',optionalAuth,async(req,res)=>{try{const roomId=String(req.query.room_id||'public');if(roomId!=='public'){if(!req.user)return res.status(401).json({error:'سجّل الدخول لعرض الغرفة'});const allowed=await query('SELECT 1 FROM community_room_members WHERE room_id=$1 AND user_id=$2',[roomId,req.user.id]);if(!allowed.rows.length)return res.status(403).json({error:'انضم إلى الغرفة أولًا'});}const {rows}=await query(`SELECT m.id,m.room_id,m.sender_id,m.sender_name,m.content,m.type,m.reply_to,m.deleted_at,m.created_at,u.avatar,u.role,u.is_owner,reply.content AS reply_content,reply.sender_name AS reply_sender FROM messages m LEFT JOIN users u ON u.id::text=m.sender_id::text LEFT JOIN messages reply ON reply.id::text=m.reply_to::text WHERE m.room_id=$1 ORDER BY m.created_at DESC LIMIT 100`,[roomId]);res.set('Cache-Control','private, no-store').json({messages:rows.reverse()});}catch(e){console.error('public chat get',e);res.status(500).json({error:'تعذر تحميل الشات'});}});
router.post('/chat',requireAuth,async(req,res)=>{try{const content=String(req.body.content||'').trim(),roomId=String(req.body.room_id||'public');if(!content)return res.status(400).json({error:'اكتب رسالة'});if(content.length>2000)return res.status(400).json({error:'الرسالة طويلة'});if(roomId!=='public'){const allowed=await query('SELECT 1 FROM community_room_members WHERE room_id=$1 AND user_id=$2',[roomId,req.user.id]);if(!allowed.rows.length)return res.status(403).json({error:'انضم إلى الغرفة أولًا'});}const replyTo=req.body.reply_to?String(req.body.reply_to):null; if(replyTo){const parent=await query('SELECT id FROM messages WHERE id::text=$1 AND room_id=$2',[replyTo,roomId]);if(!parent.rows[0])return res.status(404).json({error:'الرسالة الأصلية غير موجودة'});}const {rows}=await query('INSERT INTO messages(room_id,sender_id,sender_name,content,type,reply_to) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[roomId,req.user.id,req.user.username,content,'public',replyTo]);res.status(201).json({message:rows[0]});}catch(e){console.error('public chat post',e);res.status(500).json({error:'تعذر إرسال الرسالة'});}});

router.delete('/chat/:id',requireAuth,async(req,res)=>{try{const found=await query('SELECT id,sender_id,room_id FROM messages WHERE id::text=$1',[String(req.params.id)]);const m=found.rows[0];if(!m)return res.status(404).json({error:'الرسالة غير موجودة'});const admin=!!req.user.is_owner||['admin','owner'].includes(String(req.user.role||'').toLowerCase());if(String(m.sender_id)!==String(req.user.id)&&!admin)return res.status(403).json({error:'تقدر تحذف رسائلك فقط'});await query('DELETE FROM messages WHERE id::text=$1',[String(req.params.id)]);res.json({message:'تم حذف الرسالة'});}catch(e){console.error('chat delete',e);res.status(500).json({error:'تعذر حذف الرسالة'});}});
router.get('/owner/rooms',requireAuth,requireOwner,async(req,res)=>{const {rows}=await query('SELECT r.*,COUNT(m.user_id)::int AS members FROM community_rooms r LEFT JOIN community_room_members m ON m.room_id=r.id GROUP BY r.id ORDER BY r.created_at DESC LIMIT 200');res.set('Cache-Control','private, no-store').json({rooms:rows});});
router.delete('/owner/rooms/:id',requireAuth,requireOwner,async(req,res)=>{const room=(await query('SELECT * FROM community_rooms WHERE id=$1',[req.params.id])).rows[0];if(!room)return res.status(404).json({error:'الغرفة غير موجودة'});for(const id of [room.discord_voice_channel_id,room.discord_text_channel_id,room.discord_category_id])if(id&&discordToken())await fetch('https://discord.com/api/v10/channels/'+id,{method:'DELETE',headers:{Authorization:'Bot '+discordToken()}}).catch(()=>{});await query('DELETE FROM community_rooms WHERE id=$1',[room.id]);await audit(req.user,'room_deleted',String(room.id),{name:room.name});res.json({message:'تم حذف الغرفة'});});
router.get('/rooms',requireAuth,async(req,res)=>{
  const {rows}=await query(`SELECT r.id,r.name,r.voice_name,r.is_private,r.created_at,COUNT(m.user_id)::int AS members,
    EXISTS(SELECT 1 FROM community_room_members mine WHERE mine.room_id=r.id AND mine.user_id=$1) AS joined
    FROM community_rooms r LEFT JOIN community_room_members m ON m.room_id=r.id
    WHERE NOT r.is_private OR r.created_by=$1 OR EXISTS(SELECT 1 FROM community_room_members mine WHERE mine.room_id=r.id AND mine.user_id=$1)
    GROUP BY r.id ORDER BY r.created_at DESC LIMIT 100`,[req.user.id]);
  res.set('Cache-Control','private, no-store').json({rooms:rows});
});
router.post('/rooms',requireAuth,async(req,res)=>{
  const name=String(req.body.name||'').trim().slice(0,60),voiceName=String(req.body.voice_name||'').trim().slice(0,60),isPrivate=!!req.body.is_private;
  if(!name)return res.status(400).json({error:'اكتب اسم الغرفة'});
  const {rows}=await query('INSERT INTO community_rooms(name,voice_name,is_private,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,voice_name,is_private,created_at',[name,voiceName||null,isPrivate,req.user.id]);
  await query('INSERT INTO community_room_members(room_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[rows[0].id,req.user.id]);
  res.status(201).json({room:{...rows[0],members:1,joined:true}});
});
router.post('/rooms/:id/join',requireAuth,async(req,res)=>{
  const room=await query('SELECT id,is_private,created_by FROM community_rooms WHERE id=$1',[req.params.id]);
  if(!room.rows[0])return res.status(404).json({error:'الغرفة غير موجودة'});
  if(room.rows[0].is_private&&String(room.rows[0].created_by)!==String(req.user.id))return res.status(403).json({error:'هذه غرفة خاصة'});
  await query('INSERT INTO community_room_members(room_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.user.id]);
  res.json({message:'انضممت إلى الغرفة'});
});

router.get('/reviews', async (req,res)=>{ const {rows}=await query('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 100'); res.json({reviews:rows}); });
router.post('/reviews', requireAuth, async (req,res)=>{ const content=String(req.body.content||'').trim(); const rating=Math.max(1,Math.min(5,Number(req.body.rating)||5)); if(!content)return res.status(400).json({error:'اكتب رأيك'}); const {rows}=await query('INSERT INTO reviews(user_id,username,content,rating) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,req.user.username,content,rating]); res.json({review:rows[0]}); });
router.delete('/reviews/:id', requireAuth, requireOwner, async(req,res)=>{await query('DELETE FROM reviews WHERE id=$1',[req.params.id]);res.json({message:'تم الحذف'});});

router.get('/tickets', requireAuth, async(req,res)=>{ const admin=!!req.user.is_owner || ['admin','owner'].includes(String(req.user.role||'').toLowerCase()); const {rows}=await query('SELECT * FROM tickets WHERE user_id=$1 OR $2=true ORDER BY created_at DESC',[req.user.id,admin]); res.json({tickets:rows}); });
router.post('/tickets', requireAuth, async(req,res)=>{const subject=String(req.body.subject||'').trim(),content=String(req.body.content||'').trim();if(!subject||!content)return res.status(400).json({error:'أكمل بيانات التذكرة'});const {rows}=await query('INSERT INTO tickets(user_id,subject,content,status) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,subject,content,'open']);res.json({ticket:rows[0]});});
router.get('/tickets/:id',requireAuth,async(req,res)=>{const admin=!!req.user.is_owner || ['admin','owner'].includes(String(req.user.role||'').toLowerCase()); const t=await query('SELECT * FROM tickets WHERE id=$1 AND (user_id=$2 OR $3=true)',[req.params.id,req.user.id,admin]);if(!t.rows[0])return res.status(404).json({error:'التذكرة غير موجودة'});const m=await query('SELECT * FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at',[req.params.id]);res.json({ticket:t.rows[0],messages:m.rows});});
router.post('/tickets/:id/messages',requireAuth,async(req,res)=>{const admin=!!req.user.is_owner || ['admin','owner'].includes(String(req.user.role||'').toLowerCase()); const c=String(req.body.content||'').trim();if(!c)return res.status(400).json({error:'اكتب رد'});const t=await query('SELECT * FROM tickets WHERE id=$1 AND (user_id=$2 OR $3=true)',[req.params.id,req.user.id,admin]);if(!t.rows[0])return res.status(403).json({error:'غير مصرح'});const {rows}=await query('INSERT INTO ticket_messages(ticket_id,user_id,sender_name,content) VALUES($1,$2,$3,$4) RETURNING *',[req.params.id,req.user.id,req.user.username,c]);res.json({message:rows[0]});});
router.post('/tickets/:id/claim',requireAuth,requireAdmin,async(req,res)=>{const {rows}=await query('UPDATE tickets SET claimed_by=$1 WHERE id=$2 AND status <> \'closed\' RETURNING *',[req.user.id,req.params.id]);if(!rows[0])return res.status(404).json({error:'التذكرة غير متاحة'});await audit(req.user,'ticket_claim',String(req.params.id));res.json({ticket:rows[0]});});
router.post('/tickets/:id/close',requireAuth,requireAdmin,async(req,res)=>{const {rows}=await query('SELECT * FROM tickets WHERE id=$1',[req.params.id]);if(!rows[0])return res.status(404).json({error:'غير موجود'});await query("UPDATE tickets SET status='closed',closed_at=NOW() WHERE id=$1",[req.params.id]);res.json({message:'تم إغلاق التذكرة'});});

router.get('/applications',requireAuth,requireOwner,async(req,res)=>{const {rows}=await query('SELECT a.*,u.username,u.avatar FROM applications a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC');res.set('Cache-Control','private, no-store').json({applications:rows});});
router.post('/applications',requireAuth,async(req,res)=>{const discord_id=String(req.body.discord_id||req.user.discord_id||'').trim();if(!discord_id)return res.status(400).json({error:'أدخل Discord ID'});const resolved=await resolveDiscordId(discord_id);if(!resolved||String(resolved)!==String(req.user.discord_id))return res.status(400).json({error:'يجب استخدام حساب ديسكورد الموثق المرتبط بحسابك'});const answers=req.body.answers||{};const {rows}=await query("INSERT INTO applications(user_id,discord_id,answers,status) VALUES($1,$2,$3,'pending') RETURNING *",[req.user.id,resolved,JSON.stringify(answers)]);res.json({application:rows[0]});});
router.post('/applications/:id/status',requireAuth,requireOwner,async(req,res)=>{const status=String(req.body.status||'pending');if(!['pending','accepted','rejected'].includes(status))return res.status(400).json({error:'حالة غير صحيحة'});const {rows}=await query('SELECT * FROM applications WHERE id=$1',[req.params.id]);if(!rows[0])return res.status(404).json({error:'التقديم غير موجود'});await query('UPDATE applications SET status=$1 WHERE id=$2',[status,req.params.id]);if(status==='accepted'){const roles=await discordApi('/guilds/'+guildId()+'/roles');const adminRoles=roles.filter(r=>!r.managed&&/admin|إدارة|ادارة/i.test(String(r.name||''))).sort((a,b)=>(a.position||0)-(b.position||0));const role=adminRoles[0];if(role&&/^\d+$/.test(String(rows[0].discord_id)))await discordApi('/guilds/'+guildId()+'/members/'+rows[0].discord_id+'/roles/'+role.id,{method:'PUT',body:'{}'});await query("UPDATE users SET role='admin' WHERE id=$1",[rows[0].user_id]);try{await dmDiscord(rows[0].discord_id,'✅ تمت الموافقة على تقديمك في MLD.\nتم منحك رتبة الإدارة الأدنى المعتمدة في السيرفر.')}catch{}}else if(status==='rejected'){try{await dmDiscord(rows[0].discord_id,'❌ تم رفض تقديمك للإدارة في MLD.')}catch{}}await audit(req.user,'application_'+status,String(req.params.id),{user_id:rows[0].user_id});res.json({message:'تم التحديث'});});

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

router.get('/pigeon',requireAuth,async(req,res)=>{const {rows}=await query(`SELECT sm.id,sm.sender_id,sm.recipient_id,sm.content,sm.anonymous,sm.delivered,sm.created_at,CASE WHEN sm.recipient_id::text IN ($1::text,$2::text) AND sm.anonymous THEN NULL ELSE sender.username END AS sender_name,COALESCE(recipient.username,sm.recipient_name,sm.recipient_id) AS recipient_name FROM secret_messages sm LEFT JOIN users sender ON sender.id::text=sm.sender_id::text LEFT JOIN users recipient ON recipient.id::text=sm.recipient_id::text WHERE sm.sender_id::text=$1::text OR sm.recipient_id::text IN ($1::text,$2::text) ORDER BY sm.created_at DESC LIMIT 100`,[req.user.id,String(req.user.discord_id||'')]);res.set('Cache-Control','private, no-store').json({messages:rows.reverse()});});
router.post('/pigeon',requireAuth,async(req,res)=>{try{const recipient=String(req.body.recipient_id||'').trim(),content=String(req.body.content||'').trim().slice(0,2000);if(!/^\d{17,20}$/.test(recipient)||!content)return res.status(400).json({error:'اختر عضوًا من اقتراحات Discord واكتب الرسالة'});if(recipient===String(req.user.discord_id||''))return res.status(400).json({error:'ما تقدر ترسل زاجل لنفسك'});const token=discordToken(),guild=guildId();if(!token||!guild)return res.status(503).json({error:'ربط Discord غير جاهز'});const memberResponse=await fetch('https://discord.com/api/v10/guilds/'+encodeURIComponent(guild)+'/members/'+encodeURIComponent(recipient),{headers:{Authorization:'Bot '+token},signal:AbortSignal.timeout(7000)});if(!memberResponse.ok)return res.status(400).json({error:'العضو غير موجود في سيرفر MLD'});const member=await memberResponse.json(),recipientName=String(member.nick||member.user?.global_name||member.user?.username||recipient);const anonymous=!!req.body.anonymous;const {rows}=await query('INSERT INTO secret_messages(sender_id,recipient_id,recipient_name,content,anonymous,delivered) VALUES($1,$2,$3,$4,$5,FALSE) RETURNING id,sender_id,recipient_id,recipient_name,content,anonymous,delivered,created_at',[req.user.id,recipient,recipientName,content,anonymous]);const message=rows[0];let delivered=false;try{delivered=await dmDiscord(recipient,"**زاجل من "+(anonymous?"مجهول":req.user.username)+"**\n"+content);if(delivered)await query('UPDATE secret_messages SET delivered=TRUE WHERE id=$1',[message.id]);}catch(error){console.error('pigeon discord delivery:',error.message);}res.status(201).json({message:delivered?'تم إرسال الزاجل إلى Discord وحفظه':'حُفظ الزاجل، لكن تعذر تسليمه إلى الخاص في Discord',saved_message:{...message,delivered}});}catch(error){console.error('pigeon send:',error.message);res.status(500).json({error:'تعذر إرسال الزاجل'});}});
router.get('/cinema',async(req,res)=>{try{const {rows}=await query("SELECT id,owner_id,title,media_url,status,created_at,discord_channel_id,cinema_bot_id,movie_id FROM cinema_rooms WHERE status IS DISTINCT FROM 'closed' ORDER BY created_at DESC");res.json({rooms:rows});}catch(error){console.error('cinema list:',error.message);res.status(503).json({error:'تعذر تحميل غرف السينما'});}});
router.get('/cinema/catalog',async(req,res)=>{try{const {rows}=await query('SELECT id,title,type,year,genre,description,poster_url,video_url,duration,rating FROM movies ORDER BY title');res.json({movies:rows});}catch(error){console.error('cinema catalog:',error.message);res.status(503).json({error:'تعذر تحميل قائمة الأفلام'});}});
router.get('/cinema/discord-rooms',requireAuth,async(req,res)=>{try{const botId=String(req.query.bot_id||'');const bot=(await query('SELECT token,active FROM cinema_bots WHERE id=$1',[botId])).rows[0];if(!bot||!bot.active)return res.status(400).json({error:'اختر بوت سينما مفعّلًا أولًا'});const r=await fetch('https://discord.com/api/v10/guilds/'+encodeURIComponent(guildId())+'/channels',{headers:{Authorization:'Bot '+decryptCinemaToken(bot.token)},signal:AbortSignal.timeout(8000)});if(!r.ok)return res.status(502).json({error:'البوت غير موجود في سيرفر MLD أو لا يستطيع قراءة القنوات'});const channels=await r.json();res.json({rooms:channels.filter(x=>[0,2,5,13].includes(x.type)).map(x=>({id:x.id,name:x.name,type:x.type,parent_id:x.parent_id})).sort((a,b)=>a.name.localeCompare(b.name))});}catch(error){console.error('cinema channels:',error.message);res.status(502).json({error:'تعذر تحميل رومات Discord'});}});
router.post('/cinema/session',requireAuth,async(req,res)=>{try{const botId=String(req.body.bot_id||''),channelId=String(req.body.channel_id||''),movieId=String(req.body.movie_id||'');if(!botId||!channelId||!movieId)return res.status(400).json({error:'اختر البوت والروم والفيلم'});const bot=(await query('SELECT id,name,token,active FROM cinema_bots WHERE id=$1',[botId])).rows[0];if(!bot||!bot.active)return res.status(400).json({error:'بوت السينما غير مفعّل'});const movie=(await query('SELECT id,title,type,year,description,video_url,poster_url FROM movies WHERE id=$1',[movieId])).rows[0];if(!movie||!movie.video_url)return res.status(400).json({error:'الفيلم غير موجود أو لا يحتوي رابط مشاهدة'});const channelResponse=await fetch('https://discord.com/api/v10/guilds/'+encodeURIComponent(guildId())+'/channels',{headers:{Authorization:'Bot '+decryptCinemaToken(bot.token)},signal:AbortSignal.timeout(8000)});if(!channelResponse.ok)return res.status(502).json({error:'البوت غير قادر على قراءة قنوات السيرفر؛ تأكد أنه داخل السيرفر'});const channels=await channelResponse.json(),channel=channels.find(x=>String(x.id)===channelId&&[0,2,5,13].includes(x.type));if(!channel)return res.status(400).json({error:'الروم غير موجود أو البوت لا يستطيع الوصول إليه'});const messageChannel=([2,13].includes(channel.type)?channels.find(x=>x.type===0&&x.parent_id===channel.parent_id)||channels.find(x=>x.type===0&&/general|chat|عام|شات/i.test(String(x.name||''))):channel);if(!messageChannel)return res.status(400).json({error:'ما فيه روم كتابي يستطيع البوت إرسال رابط المشاهدة فيه. أضف رومًا كتابيًا تحت نفس التصنيف أو اختر رومًا كتابيًا.'});const title=(movie.type==='series'?'مسلسل':'فيلم')+': '+movie.title+(movie.year?' ('+movie.year+')':'');const message='🎬 **سينما MLD | '+title+'**\\n'+(movie.description?movie.description+'\\n':'')+'🔗 رابط المشاهدة: '+movie.video_url+'\\n🎧 ادخلوا الروم المحدد وشغّلوا الرابط. مشاركة الشاشة المباشرة لا تدعمها واجهة بوتات Discord الرسمية؛ يلزم شخص يشارك الشاشة من داخل الروم.';const sent=await fetch('https://discord.com/api/v10/channels/'+encodeURIComponent(channelId)+'/messages',{method:'POST',headers:{Authorization:'Bot '+decryptCinemaToken(bot.token),'Content-Type':'application/json'},body:JSON.stringify({content:message,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)});if(!sent.ok){const err=await sent.json().catch(()=>({}));return res.status(502).json({error:'تعذر إرسال الفيلم إلى الروم. تأكد أن البوت لديه صلاحية عرض الروم وإرسال الرسائل.'});}const {rows}=await query("INSERT INTO cinema_rooms(owner_id,title,media_url,status,discord_channel_id,cinema_bot_id,movie_id) VALUES($1,$2,$3,'open',$4,$5,$6) RETURNING id,owner_id,title,media_url,status,created_at,discord_channel_id,cinema_bot_id,movie_id",[req.user.id,title,movie.video_url,channelId,botId,movieId]);await audit(req.user,'cinema_session_started',String(rows[0].id),{channel_id:channelId,message_channel_id:messageChannel.id,bot_id:botId,movie_id:movieId,discord_message_id:(await sent.json().catch(()=>({}))).id||null});res.status(201).json({message:'أرسل البوت رابط المشاهدة إلى الروم المحدد. مشاركة الشاشة تحتاج شخصًا داخل Discord.',room:rows[0]});}catch(error){console.error('cinema session:',error.message);res.status(500).json({error:'تعذر تشغيل جلسة السينما'});}});
router.post('/cinema',requireAuth,async(req,res)=>{const title=String(req.body.title||'').trim(),media_url=String(req.body.media_url||'').trim();if(!title||!/^https?:[/][/]/i.test(media_url))return res.status(400).json({error:'أدخل العنوان ورابط مشاهدة صالحًا'});const {rows}=await query("INSERT INTO cinema_rooms(owner_id,title,media_url,status) VALUES($1,$2,$3,'open') RETURNING *",[req.user.id,title,media_url]);res.json({room:rows[0]});});
router.post('/cinema/:id/close',requireAuth,async(req,res)=>{const {rows}=await query('SELECT * FROM cinema_rooms WHERE id=$1',[req.params.id]);if(!rows[0])return res.status(404).json({error:'الغرفة غير موجودة'});if(String(rows[0].owner_id)!==String(req.user.id)&&!req.user.is_owner)return res.status(403).json({error:'غير مصرح'});await query("UPDATE cinema_rooms SET status='closed' WHERE id=$1",[req.params.id]);res.json({message:'تم الإغلاق'});});
router.get('/cinema/bots',requireAuth,async(req,res)=>{const {rows}=await query('SELECT id,name,bot_id,avatar,invite_url,active,runtime_status,last_seen_at,last_error FROM cinema_bots WHERE active=true ORDER BY created_at DESC');res.json({bots:rows});});
router.get('/cinema/owner/bots',requireAuth,requireOwner,async(req,res)=>{const {rows}=await query('SELECT id,name,bot_id,avatar,invite_url,active,runtime_status,last_seen_at,last_error,created_at FROM cinema_bots ORDER BY created_at DESC');res.set('Cache-Control','private, no-store').json({bots:rows});});
router.get('/cinema/owner/catalog',requireAuth,requireOwner,async(req,res)=>{const {rows}=await query('SELECT id,title,type,year,genre,description,poster_url,video_url,duration,rating FROM movies ORDER BY created_at DESC');res.set('Cache-Control','private, no-store').json({movies:rows});});
router.post('/cinema/catalog',requireAuth,requireOwner,async(req,res)=>{const title=String(req.body.title||'').trim(),type=String(req.body.type||'movie'),videoUrl=String(req.body.video_url||'').trim();if(!title||!/^https?:[/][/]/i.test(videoUrl)||!['movie','series'].includes(type))return res.status(400).json({error:'أدخل اسمًا ونوعًا ورابط HTTP/HTTPS صحيحًا'});const {rows}=await query('INSERT INTO movies(title,type,year,genre,description,poster_url,video_url,duration,rating) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,title,type,year,genre,description,poster_url,video_url,duration,rating',[title,type,req.body.year?Number(req.body.year):null,String(req.body.genre||'').slice(0,80),String(req.body.description||'').slice(0,1000),String(req.body.poster_url||'').trim()||null,videoUrl,req.body.duration?Number(req.body.duration):null,0]);await audit(req.user,'cinema_catalog_add',String(rows[0].id),{title,type});res.status(201).json({movie:rows[0],message:'تمت إضافة المحتوى'});});
router.delete('/cinema/catalog/:id',requireAuth,requireOwner,async(req,res)=>{const {rows}=await query('DELETE FROM movies WHERE id=$1 RETURNING id,title',[req.params.id]);if(!rows[0])return res.status(404).json({error:'المحتوى غير موجود'});await audit(req.user,'cinema_catalog_delete',String(rows[0].id),{title:rows[0].title});res.json({message:'تم حذف المحتوى'});});
router.post('/cinema/bots',requireAuth,requireOwner,async(req,res)=>{const name=String(req.body.name||'').trim(),token=String(req.body.token||'').trim();if(!name||!token)return res.status(400).json({error:'أدخل اسم البوت والتوكن'});const r=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bot '+token},signal:AbortSignal.timeout(8000)});if(!r.ok)return res.status(400).json({error:'توكن البوت غير صالح'});const info=await r.json();const invite=`https://discord.com/api/oauth2/authorize?client_id=${info.id}&permissions=84992&scope=bot%20applications.commands`;const existing=await query('SELECT id FROM cinema_bots WHERE bot_id=$1 LIMIT 1',[info.id]);if(existing.rows[0])return res.status(409).json({error:'هذا البوت مضاف مسبقًا'});const {rows}=await query('INSERT INTO cinema_bots(name,token,bot_id,avatar,invite_url,active) VALUES($1,$2,$3,$4,$5,TRUE) RETURNING id,name,bot_id,avatar,invite_url,active',[name,encryptCinemaToken(token),info.id,info.avatar?`https://cdn.discordapp.com/avatars/${info.id}/${info.avatar}.png?size=128`:'/logo.svg.JPG',invite]);await audit(req.user,'cinema_bot_add',String(rows[0].id),{bot_id:info.id});res.status(201).json({bot:rows[0],message:'تمت إضافة البوت؛ أضفه للسيرفر ثم فعّله'});});
router.post('/cinema/bots/:id/toggle',requireAuth,requireOwner,async(req,res)=>{const q=await query('SELECT id,active FROM cinema_bots WHERE id=$1',[req.params.id]);if(!q.rows[0])return res.status(404).json({error:'بوت السينما غير موجود'});const active=typeof req.body.active==='boolean'?req.body.active:!q.rows[0].active;await query('UPDATE cinema_bots SET active=$1 WHERE id=$2',[active,req.params.id]);await audit(req.user,'cinema_bot_toggle',String(req.params.id),{active});res.json({message:active?'تم تشغيل البوت':'تم إيقاف البوت',active});});

router.patch('/tickets/:id/messages', requireAuth, async (req,res)=>{res.status(405).json({error:'استخدم POST لإرسال الرد'});});

router.get('/owner/announcement',requireAuth,requireOwner,async(req,res)=>{
  const q=await query("SELECT value FROM site_settings WHERE key='announcement'");
  res.json({announcement:q.rows[0]?.value||{text:'',color:'#ff9cdc',enabled:true}});
});
router.patch('/owner/announcement',requireAuth,requireOwner,async(req,res)=>{
  const value={text:String(req.body.text||'').slice(0,500),color:String(req.body.color||'#ff9cdc'),enabled:req.body.enabled!==false};
  await query("INSERT INTO site_settings(key,value,updated_at) VALUES('announcement',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[JSON.stringify(value)]);
  await audit(req.user,'announcement_update','announcement',value); res.json({announcement:value});
});
router.get('/owner/stats',requireAuth,requireOwner,async(req,res)=>{
  try{const [users,bots,rooms,messages,activeSessions]=await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM users'),
    query('SELECT COUNT(*)::int AS count FROM bots'),
    query('SELECT COUNT(*)::int AS count FROM cinema_rooms WHERE status IS DISTINCT FROM \'closed\''),
    query('SELECT COUNT(*)::int AS count FROM messages'),
    query('SELECT COUNT(*)::int AS count FROM games WHERE status IN (\'open\',\'waiting\',\'playing\')')
  ]);res.set('Cache-Control','private, no-store').json({users:users.rows[0]?.count||0,bots:bots.rows[0]?.count||0,sessions:activeSessions.rows[0]?.count||0,messages:messages.rows[0]?.count||0,cinema:rooms.rows[0]?.count||0});}
  catch(error){console.error('owner stats:',error.message);res.status(503).json({error:'تعذر تحميل إحصائيات الأونر'});}
});
router.get('/owner/broadcast/jobs',requireAuth,requireOwner,async(req,res)=>{const {rows}=await query('SELECT * FROM broadcast_jobs ORDER BY created_at DESC LIMIT 20');res.json({jobs:rows});});
router.get('/owner/bot-subscriptions',requireAuth,requireOwner,async(req,res)=>{
  const {rows}=await query(`SELECT b.id,b.name,b.avatar,b.guild_id,b.active,bs.id AS subscription_id,bs.started_at,bs.expires_at,bs.active AS subscription_active,bs.features
    FROM bots b LEFT JOIN LATERAL (SELECT * FROM bot_subscriptions WHERE bot_id=b.id ORDER BY expires_at DESC LIMIT 1) bs ON true ORDER BY b.created_at DESC`);
  res.json({bots:rows});
});
router.post('/owner/bot-subscriptions/:botId',requireAuth,requireOwner,async(req,res)=>{
  const days=Math.max(1,Math.min(3650,Number(req.body.days)||0)); if(!days)return res.status(400).json({error:'حدد مدة الاشتراك بالأيام'});
  const b=await query('SELECT id,user_id,name FROM bots WHERE id=$1',[req.params.botId]); if(!b.rows[0])return res.status(404).json({error:'البوت غير موجود'});
  await query('UPDATE bot_subscriptions SET active=false WHERE bot_id=$1 AND active=true',[req.params.botId]);
  const {rows}=await query("INSERT INTO bot_subscriptions(bot_id,user_id,expires_at,active,features) VALUES($1,$2,NOW()+($3::text||' days')::interval,true,$4) RETURNING *",[req.params.botId,b.rows[0].user_id,days,JSON.stringify({all:true})]);
  await audit(req.user,'bot_subscription_granted',String(req.params.botId),{days,expires_at:rows[0].expires_at});
  res.json({subscription:rows[0]});
});
router.get('/owner/account/:id/private',requireAuth,requireOwner,async(req,res)=>{
  const q=await query(`SELECT id,sender_id,recipient_id,content,anonymous,delivered,created_at FROM secret_messages WHERE sender_id::text=$1::text OR recipient_id::text=$1::text ORDER BY created_at DESC LIMIT 500`,[req.params.id]);
  res.json({messages:q.rows.reverse()});
});

export default router;
