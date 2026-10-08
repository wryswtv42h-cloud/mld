import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

async function resolveDiscordId(value) {
  const input = String(value || '').trim();
  if (/^\d{17,20}$/.test(input)) return input;
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) throw new Error('إعدادات ديسكورد ناقصة');
  const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(input)}&limit=10`, { headers: { Authorization: `Bot ${token}` } });
  if (!r.ok) return null;
  const members = await r.json();
  const exact = members.find(m => m.user?.username?.toLowerCase() === input.toLowerCase() || m.user?.global_name?.toLowerCase() === input.toLowerCase());
  return exact?.user?.id || null;
}
async function discordMemberExists(discordId) {
  const id = await resolveDiscordId(discordId);
  if (!id) return false;
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(id)}`, { headers: { Authorization: `Bot ${token}` } });
  return r.ok;
}
const router = express.Router();
const hashVerificationCode=(discordId,code)=>crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:${discordId}:${code}`).digest('hex');
function requireBotSignature(req,res,next){
  const secret=process.env.MLD_BOT_API_SECRET||'',timestamp=String(req.get('X-MLD-Bot-Timestamp')||''),signature=String(req.get('X-MLD-Bot-Signature')||'');
  if(!secret||!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>60_000)return res.status(401).json({error:'طلب البوت غير موثق أو منتهي'});
  const expected=crypto.createHmac('sha256',secret).update(JSON.stringify(req.body||{})).digest();let supplied;
  try{supplied=Buffer.from(signature,'hex')}catch{return res.status(401).json({error:'توقيع البوت غير صالح'});}
  if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return res.status(401).json({error:'توقيع البوت غير صالح'});
  next();
}

router.post('/bot/send-verification',requireBotSignature,async(req,res)=>{
  try{
    const discordId=String(req.body.discord_id||'').trim();
    if(!/^\d{17,20}$/.test(discordId))return res.status(400).json({error:'Discord ID غير صالح'});
    const token=process.env.DISCORD_TOKEN||process.env.DISCORD_BOT_TOKEN,guildId=process.env.DISCORD_GUILD_ID;
    if(!token||!guildId)return res.status(503).json({error:'إعدادات Discord غير مكتملة'});
    await query("DELETE FROM verification_codes WHERE expires_at<NOW()");
    const member=await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,{headers:{Authorization:`Bot ${token}`},signal:AbortSignal.timeout(7000)});
    if(!member.ok)return res.status(403).json({error:'انضم إلى سيرفر MLD أولاً'});
    const linked=await query('SELECT id FROM users WHERE discord_id=$1 LIMIT 1',[discordId]);
    if(linked.rows[0])return res.status(409).json({error:'Discord هذا مرتبط بحساب موقع بالفعل'});
      const previous=await query('SELECT created_at,code_hash,expires_at FROM verification_codes WHERE discord_id=$1',[discordId]);
      if(previous.rows[0]&&Date.now()-new Date(previous.rows[0].created_at).getTime()<60_000)return res.status(429).json({error:'انتظر دقيقة قبل طلب كود آخر'});
    const code=crypto.randomInt(100000,1000000).toString();
      try{
        await query(`INSERT INTO verification_codes(discord_id,code_hash,expires_at,attempts,confirmed_at,registration_ticket_hash) VALUES($1,$2,NOW()+INTERVAL '10 minutes',0,NULL,NULL)
          ON CONFLICT(discord_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,confirmed_at=NULL,registration_ticket_hash=NULL,created_at=NOW()`,[discordId,hashVerificationCode(discordId,code)]);
        const dm=await fetch('https://discord.com/api/v10/users/@me/channels',{method:'POST',headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},body:JSON.stringify({recipient_id:discordId}),signal:AbortSignal.timeout(7000)});
        if(!dm.ok){await query('DELETE FROM verification_codes WHERE discord_id=$1',[discordId]);return res.status(502).json({error:'تعذر فتح الخاص معك؛ فعّل الرسائل الخاصة وحاول مجددًا'});}
        const channel=await dm.json();
        const sent=await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`,{method:'POST',headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},body:JSON.stringify({content:`🔐 كود تسجيل MLD: **${code}**\nاستخدم /verify confirm وأدخل الكود في النافذة الخاصة. صالح لمدة 10 دقائق ولا تشاركه.`}),signal:AbortSignal.timeout(7000)});
        if(!sent.ok){await query('DELETE FROM verification_codes WHERE discord_id=$1',[discordId]);return res.status(502).json({error:'تعذر إرسال رسالة التحقق إلى الخاص'});}
      }catch(error){await query('DELETE FROM verification_codes WHERE discord_id=$1',[discordId]).catch(()=>{});throw error;}
      return res.json({message:'أُرسل كود التحقق إلى الخاص'});
  }catch(error){console.error('bot verification send:',error.message);return res.status(500).json({error:'تعذر إرسال كود التحقق'});}
});

// ===== تحقق Discord عبر رسالة خاصة من البوت =====
router.get('/discord-suggestions', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ members: [] });
    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!token || !guildId) return res.json({ members: [] });
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(q)}&limit=10`, {
      headers: { Authorization: `Bot ${token}` }
    });
    if (!r.ok) return res.json({ members: [] });
    const members = await r.json();
    return res.json({ members: members.map(m => ({
      id: m.user?.id,
      username: m.user?.username,
      global_name: m.user?.global_name,
      avatar: m.user?.avatar
    })).filter(x => x.username) });
  } catch (e) {
    return res.json({ members: [] });
  }
});

router.post('/verify-discord', async (req, res) => {
  res.status(410).json({error:'أرسل كود التحقق عبر أمر /verify send في بوت MLD الرسمي'});
});

// ===== تأكيد كود Discord من البوت =====
router.post('/confirm-discord',requireBotSignature,async (req,res)=>{
  try{
    const discordId=String(req.body.discord_id||req.body.discordId||'').trim();
    const code=String(req.body.verification_code||req.body.code||'').trim();
    const actorId=String(req.body.actor_discord_id||'').trim();
    if(!discordId||discordId!==actorId||!/^\d{17,20}$/.test(actorId)||!code)return res.status(400).json({error:'بيانات التحقق ناقصة أو لا تطابق مستخدم Discord'});
    const pending=(await query('SELECT code_hash,expires_at,attempts FROM verification_codes WHERE discord_id=$1',[discordId])).rows[0];
    if(!pending||new Date(pending.expires_at).getTime()<Date.now())return res.status(400).json({error:'كود التحقق غير صحيح أو منتهي'});
    if(Number(pending.attempts)>=5)return res.status(429).json({error:'تجاوزت عدد محاولات التحقق. اطلب كودًا جديدًا'});
    const supplied=Buffer.from(hashVerificationCode(discordId,code),'hex'),expected=Buffer.from(pending.code_hash,'hex');
    if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected)){
      await query('UPDATE verification_codes SET attempts=attempts+1 WHERE discord_id=$1',[discordId]);
      return res.status(400).json({error:'كود التحقق غير صحيح أو منتهي'});
    }
    const registrationTicket=crypto.randomBytes(32).toString('base64url');
    await query('UPDATE verification_codes SET confirmed_at=NOW(),registration_ticket_hash=$2 WHERE discord_id=$1',[discordId,crypto.createHash('sha256').update(registrationTicket).digest('hex')]);
    return res.json({verified:true,discord_id:discordId,registration_ticket:registrationTicket});
  }catch(e){console.error(e);res.status(500).json({error:'تعذر تأكيد التحقق'});}
});

router.post('/bot/login-ticket',requireBotSignature,async(req,res)=>{
  try{
    const discordId=String(req.body.discord_id||'').trim();
    const user=(await query('SELECT id FROM users WHERE discord_id=$1 AND COALESCE(banned,FALSE)=FALSE ORDER BY is_owner DESC,created_at ASC LIMIT 1',[discordId])).rows[0];
    if(!user)return res.status(404).json({error:'لا يوجد حساب موقع مرتبط بهذا Discord؛ استخدم /verify send'});
    const ticket=crypto.randomBytes(32).toString('base64url'),hash=crypto.createHash('sha256').update(ticket).digest('hex');
    await query('DELETE FROM bot_login_tickets WHERE expires_at<NOW()');
    await query("INSERT INTO bot_login_tickets(ticket_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '2 minutes')",[hash,user.id]);
    return res.json({ticket});
  }catch(error){console.error('bot login ticket:',error.message);return res.status(500).json({error:'تعذر إنشاء رابط الدخول'});}
});
router.post('/bot/exchange-ticket',async(req,res)=>{
  try{
    const ticket=String(req.body.ticket||'').trim();if(ticket.length<32)return res.status(400).json({error:'تذكرة الدخول غير صالحة'});
    const hash=crypto.createHash('sha256').update(ticket).digest('hex'),connection=await pool.connect();
    try{
      await connection.query('BEGIN');
      const found=await connection.query('DELETE FROM bot_login_tickets WHERE ticket_hash=$1 AND expires_at>NOW() RETURNING user_id',[hash]);
      if(!found.rows[0]){await connection.query('ROLLBACK');return res.status(400).json({error:'انتهت صلاحية رابط الدخول أو استُخدم من قبل'});}
      const {rows}=await connection.query('SELECT id,username,role,is_owner,discord_id,discord_verified,avatar FROM users WHERE id=$1 AND COALESCE(banned,FALSE)=FALSE',[found.rows[0].user_id]);
      if(!rows[0]){await connection.query('ROLLBACK');return res.status(401).json({error:'الحساب غير متاح'});}
      const token=jwt.sign({id:rows[0].id},process.env.JWT_SECRET,{expiresIn:'30d'});
      await connection.query('COMMIT');
      return res.json({token,user:rows[0]});
    }catch(error){await connection.query('ROLLBACK').catch(()=>{});throw error;}finally{connection.release();}
  }catch(error){console.error('exchange login ticket:',error.message);return res.status(500).json({error:'تعذر إنشاء جلسة الدخول'});}
});

// ===== تسجيل الدخول =====
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'أدخل اليوزر والباسورد' });

    const { rows } = await query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username]);
    let dbUser = rows[0];

    // إذا كان حساب الأونر موجودًا باسم المستخدم لكن صلاحية is_owner ضاعت، أصلح السجل عند استخدام بيانات الأونر من Railway.
    if (username === process.env.OWNER_USERNAME && password === process.env.OWNER_PASSWORD) {
      const ownerDiscordId = await resolveDiscordId(process.env.OWNER_DISCORD_ID || dbUser?.discord_id || 'w4px');
      if (!ownerDiscordId || !(await discordMemberExists(ownerDiscordId))) {
        return res.status(403).json({ error: 'حساب الأونر غير موجود في سيرفر MLD' });
      }
      const hash = await bcrypt.hash(password, 12);
      let owner;
      if (dbUser) {
        const updated = await query(
          "UPDATE users SET password=$1, discord_id=$2, discord_verified=TRUE, role='owner', is_owner=TRUE, banned=FALSE, last_seen=NOW(), updated_at=NOW() WHERE id=$3 RETURNING *",
          [hash, ownerDiscordId, dbUser.id]
        );
        owner = updated.rows[0];
      } else {
        const created = await query(
          "INSERT INTO users (username,password,discord_id,discord_verified,role,is_owner) VALUES ($1,$2,$3,TRUE,'owner',TRUE) RETURNING *",
          [username, hash, ownerDiscordId]
        );
        owner = created.rows[0];
      }
      const jwtToken = jwt.sign({id:owner.id}, process.env.JWT_SECRET, {expiresIn:'30d'});
      const {password:_, ...safeOwner} = owner;
      return res.json({token:jwtToken,user:safeOwner});
    }

    // حساب الأونر: كلمة البيئة تعمل كدخول تأسيسي فقط، وبعد إنشاء حساب الأونر تصبح كلمة DB هي الأساسية.
    if (dbUser?.is_owner) {
      const dbValid = dbUser.password ? await bcrypt.compare(password, dbUser.password) : false;
      const envValid = username === process.env.OWNER_USERNAME && password === process.env.OWNER_PASSWORD;
      if (!dbValid && !envValid) return res.status(401).json({ error: 'بيانات غير صحيحة' });

      const ownerDiscordId = await resolveDiscordId(dbUser.discord_id || process.env.OWNER_DISCORD_ID || 'w4px');
      if (!ownerDiscordId || !(await discordMemberExists(ownerDiscordId))) return res.status(403).json({ error: 'حساب الأونر غير موجود في سيرفر MLD' });
      if (String(dbUser.discord_id) !== String(ownerDiscordId) || !dbUser.discord_verified) {
        await query('UPDATE users SET discord_id=$1, discord_verified=TRUE, role=$2, is_owner=TRUE, last_seen=NOW() WHERE id=$3',[''+ownerDiscordId,'owner',dbUser.id]);
        dbUser=(await query('SELECT * FROM users WHERE id=$1',[dbUser.id])).rows[0];
      } else {
        await query('UPDATE users SET last_seen=NOW(), role=$1, is_owner=TRUE WHERE id=$2',['owner',dbUser.id]);
      }
      const jwtToken=jwt.sign({id:dbUser.id},process.env.JWT_SECRET,{expiresIn:'30d'});
      const {password:_,...safeOwner}=dbUser;
      return res.json({token:jwtToken,user:safeOwner});
    }

    // دخول تأسيسي للأونر إذا لم يوجد سجل في DB بعد.
    if (username === process.env.OWNER_USERNAME && password === process.env.OWNER_PASSWORD) {
      const ownerDiscordId = await resolveDiscordId(process.env.OWNER_DISCORD_ID || 'w4px');
      if (!ownerDiscordId || !(await discordMemberExists(ownerDiscordId))) return res.status(403).json({ error: 'حساب الأونر غير موجود في سيرفر MLD' });
      const hash=await bcrypt.hash(password,12);
      const result=await query(
        `INSERT INTO users (username,password,discord_id,discord_verified,role,is_owner)
         VALUES ($1,$2,$3,TRUE,'owner',TRUE) RETURNING *`,
        [username,hash,ownerDiscordId]
      );
      const owner=result.rows[0];
      const jwtToken=jwt.sign({id:owner.id},process.env.JWT_SECRET,{expiresIn:'30d'});
      const {password:_,...safe}=owner;
      return res.json({token:jwtToken,user:safe});
    }

    const user = dbUser;
    if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });
    if (!user.discord_verified) return res.status(403).json({ error: 'الحساب غير موثّق في ديسكورد' });
    let currentDiscordId;
    try { currentDiscordId = await resolveDiscordId(user.discord_id); } catch (e) { return res.status(503).json({ error: e.message }); }
    if (!currentDiscordId || !(await discordMemberExists(currentDiscordId))) return res.status(403).json({ error: 'لم تعد عضوًا في سيرفر MLD' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'بيانات غير صحيحة' });
    await query('UPDATE users SET last_seen=NOW() WHERE id=$1',[user.id]);
    const jwtToken=jwt.sign({id:user.id},process.env.JWT_SECRET,{expiresIn:'30d'});
    const {password:_,...safe}=user;
    return res.json({token:jwtToken,user:safe});
  } catch(err) {
    console.error(err);
    res.status(500).json({error:'خطأ في السيرفر'});
  }
});

// ===== تسجيل جديد =====
router.post('/register', async (req, res) => {
  try {
    const username=String(req.body.username||'').trim(),password=String(req.body.password||''),discord_id=String(req.body.discord_id||'').trim(),verification_code=String(req.body.verification_code||'').trim(),registration_ticket=String(req.body.registration_ticket||'').trim();
    if (!username || !password || !discord_id) return res.status(400).json({ error: 'التسجيل يتطلب يوزر الموقع + الباسورد + التحقق من حساب ديسكورد' });
    if (!/^[\\p{L}\\p{N}_.-]{2,24}$/u.test(username)) return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون من 2 إلى 24 حرفًا أو رقمًا، ويسمح بـ _ . - فقط' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون بين 8 و128 حرفًا' });

    const verifiedDiscordId = await resolveDiscordId(discord_id);
    if (!verifiedDiscordId || !(await discordMemberExists(verifiedDiscordId))) return res.status(400).json({ error: 'حساب ديسكورد غير موجود في سيرفر MLD' });
    const connection=await pool.connect();
    let rows,hash;
    try{
      await connection.query('BEGIN');
      const pending=await connection.query('SELECT code_hash,expires_at,confirmed_at,registration_ticket_hash FROM verification_codes WHERE discord_id=$1 FOR UPDATE',[String(verifiedDiscordId)]);
      if(!pending.rows[0]||new Date(pending.rows[0].expires_at).getTime()<Date.now())throw Object.assign(new Error('انتهت صلاحية التحقق؛ أعد /verify send'),{status:400});
      if(Number(pending.rows[0].attempts)>=5)throw Object.assign(new Error('تجاوزت عدد محاولات التحقق. اطلب كودًا جديدًا'),{status:429});
      if(pending.rows[0].confirmed_at){
        if(!registration_ticket||!pending.rows[0].registration_ticket_hash)throw Object.assign(new Error('أكمل التحقق عبر بوت MLD وأدخل تذكرة التسجيل'),{status:400});
        const saved=Buffer.from(pending.rows[0].registration_ticket_hash,'hex'),submitted=Buffer.from(crypto.createHash('sha256').update(String(registration_ticket)).digest('hex'),'hex');
        if(saved.length!==submitted.length||!crypto.timingSafeEqual(saved,submitted))throw Object.assign(new Error('تذكرة التسجيل غير صحيحة'),{status:400});
      }else{
        const supplied=Buffer.from(hashVerificationCode(verifiedDiscordId,String(verification_code||'')),'hex'),expected=Buffer.from(pending.rows[0].code_hash,'hex');
        if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected)){
          throw Object.assign(new Error('أرسل كود التحقق عبر رسالة Discord أو استخدم /verify confirm في البوت'),{status:422});
        }
      }
      hash=await bcrypt.hash(password,10);
      const exists=await connection.query('SELECT id FROM users WHERE username=$1 OR discord_id=$2 LIMIT 1',[username,verifiedDiscordId]);
      if(exists.rows[0])throw Object.assign(new Error('الاسم أو حساب Discord مستخدم'),{status:409});
      const created=await connection.query('INSERT INTO users(username,password,discord_id,discord_verified) VALUES($1,$2,$3,TRUE) RETURNING *',[username,hash,verifiedDiscordId]);
      rows=created.rows;
      await connection.query('DELETE FROM verification_codes WHERE discord_id=$1',[String(verifiedDiscordId)]);
      await connection.query('COMMIT');
    }catch(error){await connection.query('ROLLBACK').catch(()=>{});if(error.status===422){await query('UPDATE verification_codes SET attempts=attempts+1 WHERE discord_id=$1',[String(verifiedDiscordId)]);return res.status(400).json({error:error.message});}if(error.status)return res.status(error.status).json({error:error.message});if(error.code==='23505')return res.status(409).json({error:'الاسم أو حساب Discord مستخدم'});throw error;}finally{connection.release();}
    const { password: _, ...user } = rows[0];

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== جلب حسابي =====
router.get('/me', requireAuth, (req, res) => {
  const { password, ...user } = req.user;
  res.json({ user });
});

// ===== تسجيل الخروج =====
router.post('/logout', requireAuth, (req, res) => {
  res.json({ message: 'تم تسجيل الخروج' });
});


// ===== تغيير كلمة المرور =====
router.post('/change-password', requireAuth, async (req,res)=>{
  try{
    const current=String(req.body.current_password||'');
    const next=String(req.body.new_password||'');
    if(next.length<6) return res.status(400).json({error:'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'});
    const row=(await query('SELECT id,password FROM users WHERE id=$1 LIMIT 1',[req.user.id])).rows[0];
    if(!row || !(await bcrypt.compare(current,row.password))) return res.status(401).json({error:'كلمة المرور الحالية غير صحيحة'});
    const hash=await bcrypt.hash(next,12);
    await query('UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2',[hash,req.user.id]);
    return res.json({message:'تم تغيير كلمة المرور بنجاح'});
  }catch(e){ console.error(e); res.status(500).json({error:'تعذر تغيير كلمة المرور'}); }
});

// ===== نسيت كلمة المرور: تحقق من حساب الموقع + Discord ثم أرسل مؤقتًا للخاص =====
router.post('/forgot-password', async (req,res)=>{
  try{
    const username=String(req.body.username||'').trim();
    const discordInput=String(req.body.discord_id||'').trim();
    if(!username||!discordInput) return res.status(400).json({error:'أدخل اسم المستخدم وDiscord ID أو اسم المستخدم في ديسكورد'});
    const row=(await query('SELECT * FROM users WHERE username=$1 LIMIT 1',[username])).rows[0];
    if(!row) return res.status(404).json({error:'الحساب غير موجود'});
    const resolved=await resolveDiscordId(discordInput);
    if(!resolved || String(resolved)!==String(row.discord_id)) return res.status(403).json({error:'بيانات Discord لا تطابق الحساب'});
    if(!(await discordMemberExists(resolved))) return res.status(403).json({error:'حساب Discord غير موجود في سيرفر MLD'});
    const temp=Array.from({length:10},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[Math.floor(Math.random()*56)]).join('');
    const hash=await bcrypt.hash(temp,12);
    await query('UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2',[hash,row.id]);
    const botToken=process.env.DISCORD_TOKEN||process.env.DISCORD_BOT_TOKEN;
    const dm=await fetch('https://discord.com/api/v10/users/@me/channels',{method:'POST',headers:{Authorization:`Bot ${botToken}`,'Content-Type':'application/json'},body:JSON.stringify({recipient_id:String(resolved)})});
    if(!dm.ok) return res.status(502).json({error:'تعذر فتح الخاص في ديسكورد'});
    const channel=await dm.json();
    const sent=await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`,{method:'POST',headers:{Authorization:`Bot ${botToken}`,'Content-Type':'application/json'},body:JSON.stringify({content:`🔐 إعادة تعيين كلمة مرور MLD\\nاسم الحساب: **${username}**\\nكلمة المرور المؤقتة: **${temp}**\\nبعد الدخول غيّرها من صفحة بروفايلك فورًا.`})});
    if(!sent.ok) return res.status(502).json({error:'تعذر إرسال كلمة المرور المؤقتة إلى Discord'});
    return res.json({message:'تم إرسال كلمة المرور المؤقتة إلى الخاص في ديسكورد'});
  }catch(e){ console.error(e); res.status(500).json({error:'تعذر تنفيذ استعادة كلمة المرور'}); }
});

export default router;
