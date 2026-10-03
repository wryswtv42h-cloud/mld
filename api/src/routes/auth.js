import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

function getDiscordToken() {
  return process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
}

function getGuildId() {
  return process.env.DISCORD_GUILD_ID || '';
}

async function discordMemberExists(discordId) {
  const token = getDiscordToken();
  const guildId = getGuildId();

  if (!discordId) return false;
  if (!token || !guildId) return true;

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(discordId)}`,
    { headers: { Authorization: `Bot ${token}` } }
  );

  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Discord API error: ${response.status}`);
  return true;
}

const router = express.Router();
const verificationCodes = new Map();

// ===== تحقق Discord عبر رسالة خاصة من البوت =====
router.post('/verify-discord', async (req, res) => {
  try {
    const { discord_id } = req.body || {};
    if (!discord_id) {
      return res.status(400).json({ error: 'أدخل Discord ID' });
    }

    const memberExists = await discordMemberExists(discord_id);
    if (!memberExists) {
      return res.status(400).json({ error: 'هذا الحساب ليس عضوًا في سيرفر MLD' });
    }

    const token = getDiscordToken();
    if (!token) {
      verificationCodes.set(String(discord_id), {
        code: 'local-dev',
        expires: Date.now() + 10 * 60 * 1000
      });
      return res.json({ verified: true, message: 'تم الموافقة على حساب Discord (تمت الإعداد محليًا)' });
    }

    const dm = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: String(discord_id) })
    });

    if (!dm.ok) {
      return res.status(502).json({ error: 'تعذر فتح الخاص مع حسابك في ديسكورد' });
    }

    const channel = await dm.json();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const sent = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: `كود تحقق MLD: **${code}**\nالرمز صالح لمدة 10 دقائق.`
      })
    });

    if (!sent.ok) {
      return res.status(502).json({ error: 'تعذر إرسال كود التحقق' });
    }

    verificationCodes.set(String(discord_id), { code, expires: Date.now() + 10 * 60 * 1000 });
    return res.json({ verified: false, message: 'تم إرسال كود التحقق إلى الخاص في ديسكورد' });
  } catch (e) {
    console.error('verify-discord error:', e);
    res.status(500).json({ error: 'تعذر تنفيذ التحقق' });
  }
});

// ===== تسجيل الدخول =====
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'أدخل اليوزر والباسورد' });
    }

    const ownerUser = process.env.OWNER_USERNAME;
    const ownerPass = process.env.OWNER_PASSWORD;
    const isOwnerLogin = ownerUser && ownerPass && String(username) === String(ownerUser) && String(password) === String(ownerPass);

    if (isOwnerLogin) {
      let owner = null;
      const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
      owner = rows[0];

      if (!owner) {
        const ownerDiscord = process.env.OWNER_DISCORD_ID || 'owner';
        const hash = await bcrypt.hash(password, 10);
        const created = await query(
          `INSERT INTO users (username, password, discord_id, discord_verified, role, is_owner)
           VALUES ($1, $2, $3, TRUE, 'owner', TRUE)
           RETURNING *`,
          [username, hash, ownerDiscord]
        );
        owner = created.rows[0];
      }

      if (owner.banned) {
        return res.status(403).json({ error: 'الحساب محظور' });
      }

      const token = jwt.sign({ id: owner.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
      const { password: _, ...safeUser } = owner;
      return res.json({ token, user: safeUser });
    }

    const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'بيانات غير صحيحة' });
    }

    if (user.banned) {
      return res.status(403).json({ error: 'الحساب محظور' });
    }

    if (!user.discord_verified) {
      return res.status(403).json({ error: 'الحساب غير موثّق في ديسكورد' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'بيانات غير صحيحة' });
    }

    await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
    const { password: _, ...safe } = user;
    return res.json({ token, user: safe });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== تسجيل جديد =====
router.post('/register', async (req, res) => {
  try {
    const { username, password, discord_id, verification_code } = req.body || {};
    if (!username || !password || !discord_id) {
      return res.status(400).json({ error: 'التسجيل يتطلب يوزر الموقع + الباسورد + التحقق من حساب ديسكورد' });
    }

    if (String(username).trim().length < 2 || String(password).trim().length < 6) {
      return res.status(400).json({ error: 'الاسم قصير أو الباسورد أقل من 6 أحرف' });
    }

    const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rows[0]) {
      return res.status(400).json({ error: 'الاسم مستخدم' });
    }

    const memberExists = await discordMemberExists(discord_id);
    if (!memberExists) {
      return res.status(400).json({ error: 'حساب ديسكورد غير موجود في السيرفر' });
    }

    const pending = verificationCodes.get(String(discord_id));
    if (pending && pending.expires < Date.now()) {
      verificationCodes.delete(String(discord_id));
    }

    if (pending && pending.code !== String(verification_code || '')) {
      return res.status(400).json({ error: 'تحقق من ديسكورد أولاً وأدخل الكود الصحيح' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (username, password, discord_id, discord_verified)
       VALUES ($1, $2, $3, TRUE)
       RETURNING *`,
      [username, hash, discord_id]
    );

    verificationCodes.delete(String(discord_id));
    const { password: _, ...user } = rows[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });

    return res.json({ token, user });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'خطأ في السيرفر' });
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
