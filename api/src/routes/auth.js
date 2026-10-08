import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
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
async function sendVerificationCode(discordId) {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const dm = await fetch('https://discord.com/api/v10/users/@me/channels', { method:'POST', headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({recipient_id:String(discordId)}) });
  if (!dm.ok) throw new Error('تعذر فتح الخاص مع حسابك في ديسكورد');
  const channel = await dm.json();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const sent = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, { method:'POST', headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({content:`🔐 كود التحقق الخاص بـ MLD Community: **${code}**\\nلا تشارك هذا الكود مع أي شخص.`}) });
  if (!sent.ok) throw new Error('تعذر إرسال كود التحقق');
  verificationCodes.set(String(discordId), { code, expires: Date.now() + 10 * 60 * 1000 });
  return code;
}

const router = express.Router();
const verificationCodes = new Map();

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
  try {
    const { discord_id } = req.body;
    if (!discord_id) return res.status(400).json({ error: 'أدخل Discord ID أو اسم المستخدم' });
    const resolvedId = await resolveDiscordId(discord_id);
    if (!resolvedId || !(await discordMemberExists(resolvedId))) return res.status(400).json({ error: 'هذا الحساب ليس عضوًا في سيرفر MLD' });
    const linked = await query('SELECT id FROM users WHERE discord_id=$1 LIMIT 1',[resolvedId]);
    if (linked.rows[0]) return res.status(400).json({ error: 'حساب ديسكورد هذا مرتبط بحساب موقع آخر' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    const dm = await fetch('https://discord.com/api/v10/users/@me/channels', { method:'POST', headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({recipient_id:String(resolvedId)}) });
    if (!dm.ok) return res.status(502).json({ error: 'تعذر فتح الخاص مع حسابك في ديسكورد' });
    const channel = await dm.json();
    const sent = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, { method:'POST', headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({content:`🔐 كود التحقق الخاص بـ MLD Community: **${code}**\\nلا تشارك هذا الكود مع أي شخص.`}) });
    if (!sent.ok) return res.status(502).json({ error: 'تعذر إرسال كود التحقق' });
    verificationCodes.set(String(resolvedId), { code, expires: Date.now() + 10 * 60 * 1000 });
    return res.json({ verified: false, message: 'تم إرسال كود التحقق إلى الخاص في ديسكورد' });
  } catch (e) { console.error(e); res.status(500).json({ error:'تعذر تنفيذ التحقق' }); }
});

// ===== تأكيد كود Discord من البوت =====
router.post('/confirm-discord', async (req,res)=>{
  try{
    const discordId=String(req.body.discord_id||req.body.discordId||'').trim();
    const code=String(req.body.verification_code||req.body.code||'').trim();
    if(!discordId||!code)return res.status(400).json({error:'بيانات التحقق ناقصة'});
    const resolved=await resolveDiscordId(discordId);
    const pending=resolved ? verificationCodes.get(String(resolved)) : null;
    if(!resolved||!pending||pending.expires<Date.now()||pending.code!==code)return res.status(400).json({error:'كود التحقق غير صحيح أو منتهي'});
    return res.json({verified:true,discord_id:resolved});
  }catch(e){console.error(e);res.status(500).json({error:'تعذر تأكيد التحقق'});}
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
    const { username, password, discord_id, verification_code } = req.body;
    if (!username || !password || !discord_id) return res.status(400).json({ error: 'التسجيل يتطلب يوزر الموقع + الباسورد + التحقق من حساب ديسكورد' });
    if (username.length < 2 || password.length < 6) {
      return res.status(400).json({ error: 'الاسم قصير أو الباسورد أقل من 6 أحرف' });
    }

    const verifiedDiscordId = await resolveDiscordId(discord_id);
    if (!verifiedDiscordId || !(await discordMemberExists(verifiedDiscordId))) return res.status(400).json({ error: 'حساب ديسكورد غير موجود في سيرفر MLD' });
    const pending = verificationCodes.get(String(verifiedDiscordId));
    if (!pending || pending.expires < Date.now() || pending.code !== String(verification_code || '')) return res.status(400).json({ error: 'أرسل كود التحقق لديسكورد وأدخله بشكل صحيح' });

    const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rows[0]) return res.status(400).json({ error: 'الاسم مستخدم' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (username, password, discord_id, discord_verified)
       VALUES ($1, $2, $3, TRUE) RETURNING *`,
      [username, hash, verifiedDiscordId]
    );
    verificationCodes.delete(String(verifiedDiscordId));
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
