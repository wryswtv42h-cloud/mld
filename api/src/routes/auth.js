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
router.post('/verify-discord', async (req, res) => {
  try {
    const { discord_id } = req.body;
    if (!discord_id) return res.status(400).json({ error: 'أدخل Discord ID' });
    if (!(await discordMemberExists(discord_id))) return res.status(400).json({ error: 'هذا الحساب ليس عضوًا في سيرفر MLD' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    const dm = await fetch('https://discord.com/api/v10/users/@me/channels', { method:'POST', headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({recipient_id:String(discord_id)}) });
    if (!dm.ok) return res.status(502).json({ error: 'تعذر فتح الخاص مع حسابك في ديسكورد' });
    const channel = await dm.json();
    const sent = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, { method:'POST', headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({content:`🔐 كود التحقق الخاص بـ MLD Community: **${code}**\\nلا تشارك هذا الكود مع أي شخص.`}) });
    if (!sent.ok) return res.status(502).json({ error: 'تعذر إرسال كود التحقق' });
    verificationCodes.set(String(discord_id), { code, expires: Date.now() + 10 * 60 * 1000 });
    return res.json({ verified: false, message: 'تم إرسال كود التحقق إلى الخاص في ديسكورد' });
  } catch (e) { console.error(e); res.status(500).json({ error:'تعذر تنفيذ التحقق' }); }
});

// ===== تسجيل الدخول =====
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'أدخل اليوزر والباسورد' });
    }

    // حساب الأونر
    if (username === process.env.OWNER_USERNAME && password === process.env.OWNER_PASSWORD) {
      let { rows } = await query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username]);
      let owner = rows[0];
      const ownerDiscordId = await resolveDiscordId(process.env.OWNER_DISCORD_ID || 'w4px');
      if (!ownerDiscordId) return res.status(503).json({ error: 'تعذر العثور على حساب الأونر في ديسكورد' });
      if (!(await discordMemberExists(ownerDiscordId))) return res.status(403).json({ error: 'حساب الأونر غير موجود في سيرفر MLD' });
      if (!owner) {
        const hash = await bcrypt.hash(password, 12);
        const result = await query(
          `INSERT INTO users (username, password, discord_id, discord_verified, role, is_owner)
           VALUES ($1, $2, $3, TRUE, 'owner', TRUE) RETURNING *`,
          [username, hash, ownerDiscordId]
        );
        owner = result.rows[0];
      } else {
        await query('UPDATE users SET is_owner=TRUE, role=$1, discord_id=$2, discord_verified=TRUE WHERE id=$3', ['owner', ownerDiscordId, owner.id]);
        owner = (await query('SELECT * FROM users WHERE id=$1',[owner.id])).rows[0];
      }
      const token = jwt.sign({ id: owner.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      const { password: _, ...user } = owner;
      return res.json({ token, user });
    }

    // الأعضاء
    const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });

    if (!user.discord_verified) return res.status(403).json({ error: 'الحساب غير موثّق في ديسكورد' });
    let currentDiscordId;
    try { currentDiscordId = await resolveDiscordId(user.discord_id); } catch (e) { return res.status(503).json({ error: e.message }); }
    if (!currentDiscordId || !(await discordMemberExists(currentDiscordId))) return res.status(403).json({ error: 'لم تعد عضوًا في سيرفر MLD' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'بيانات غير صحيحة' });

    await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
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

export default router;
