import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const memberCache = new Map();
const pendingMembers = new Map();
async function isCurrentMember(discordId) {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId || !discordId) return false;
  const key = `${guildId}:${discordId}`;
  const cached = memberCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (pendingMembers.has(key)) return pendingMembers.get(key);
  const check = fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(discordId)}`, { headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(5000) })
    .then(response => {
      const value = response.ok;
      memberCache.set(key, { value, expires: Date.now() + (value ? 45_000 : 10_000) });
      if (memberCache.size > 5000) {
        for (const [entry, data] of memberCache) if (data.expires <= Date.now()) memberCache.delete(entry);
      }
      return value;
    })
    .catch(() => cached?.value && cached.expires > Date.now() ? cached.value : false)
    .finally(() => pendingMembers.delete(key));
  pendingMembers.set(key, check);
  return check;
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'غير مصرح' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = rows[0];

    if (!user || user.banned) return res.status(401).json({ error: 'الحساب غير متاح' });
    if (user.discord_verified && !(await isCurrentMember(user.discord_id))) {
      return res.status(403).json({ error: 'لم تعد عضوًا في سيرفر MLD' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'جلسة غير صالحة' });
  }
}

export async function requireOwner(req, res, next) {
  if (!req.user?.is_owner) {
    return res.status(403).json({ error: 'هذي الصلاحية للأونر فقط' });
  }
  next();
}

export function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    query('SELECT * FROM users WHERE id = $1', [decoded.id])
      .then(({ rows }) => {
        req.user = rows[0] || null;
        next();
      })
      .catch(() => next());
  } catch (err) {
    next();
  }
}


export async function requireAdmin(req, res, next) {
  if (!req.user || (!req.user.is_owner && !['admin','owner'].includes(String(req.user.role || '').toLowerCase()))) {
    return res.status(403).json({ error: 'هذي الصلاحية للإدارة فقط' });
  }
  next();
}
