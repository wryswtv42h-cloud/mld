import express from 'express';

const router = express.Router();

const cache = {
  guild: { value: null, at: 0 },
  members: { value: [], at: 0 },
  roles: { value: [], at: 0 }
};

let visits = 0;
const visitorSeen = new Map();
const VISITOR_TTL = 60 * 60 * 1000;
const CACHE_TTL = 15000;

const guildId = () => process.env.DISCORD_GUILD_ID;
const token = () => process.env.DISCORD_TOKEN;

async function discord(path) {
  const r = await fetch('https://discord.com/api/v10' + path, {
    headers: { Authorization: 'Bot ' + token() }
  });
  if (!r.ok) throw new Error('Discord API ' + r.status);
  return r.json();
}

async function getGuild() {
  if (cache.guild.value && Date.now() - cache.guild.at < CACHE_TTL) return cache.guild.value;
  const g = await discord('/guilds/' + guildId() + '?with_counts=true');
  cache.guild = { value: g, at: Date.now() };
  return g;
}

async function getMembers() {
  if (cache.members.value.length && Date.now() - cache.members.at < CACHE_TTL) return cache.members.value;
  const all = [];
  let after = '0';
  for (let i = 0; i < 10; i++) {
    const batch = await discord('/guilds/' + guildId() + '/members?limit=1000&after=' + after);
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user.id;
  }
  cache.members = { value: all, at: Date.now() };
  return all;
}

async function getRoles() {
  if (cache.roles.value.length && Date.now() - cache.roles.at < CACHE_TTL) return cache.roles.value;
  const roles = await discord('/guilds/' + guildId() + '/roles');
  cache.roles = { value: roles, at: Date.now() };
  return roles;
}

function normalizeMember(m) {
  return {
    id: m.user.id,
    name: m.nick || m.user.global_name || m.user.username,
    username: m.user.username,
    avatar: m.avatar
      ? `https://cdn.discordapp.com/guilds/${guildId()}/users/${m.user.id}/avatars/${m.avatar}.png?size=128`
      : (m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=128` : '/logo.svg'),
    roles: m.roles || [],
    importantRoles: []
  };
}

function touchVisit(req) {
  const key = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const last = visitorSeen.get(key) || 0;
  if (now - last > VISITOR_TTL) {
    visits++;
    visitorSeen.set(key, now);
  }
}

router.get('/server', async (req, res) => {
  try {
    touchVisit(req);
    const g = await getGuild();
    res.json({
      id: g.id,
      name: g.name || 'MLD',
      memberCount: g.approximate_member_count ?? g.member_count ?? 0,
      onlineCount: g.approximate_presence_count ?? 0,
      ownerName: 'فهد المطيري',
      visits,
      invite: 'https://discord.com/users/w4px',
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256` : '/logo.svg'
    });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب بيانات ديسكورد', name: 'MLD', memberCount: 0, onlineCount: 0, visits });
  }
});

router.get('/members', async (req, res) => {
  try {
    const members = (await getMembers()).map(normalizeMember);
    const q = String(req.query.q || '').trim().toLowerCase();
    const filtered = q
      ? members.filter(m => (m.name + ' ' + m.username).toLowerCase().includes(q)).slice(0, 25)
      : members.slice(0, 5);
    const roles = await getRoles();
    const roleMap = new Map(roles.map(r => [r.id, r]));
    filtered.forEach(m => {
      m.importantRoles = m.roles.map(id => roleMap.get(id)).filter(Boolean)
        .filter(r => !r.managed).sort((a,b) => (b.position||0) - (a.position||0)).slice(0, 5)
        .map(r => ({ id: r.id, name: r.name, color: r.color }));
    });
    res.json({ members: filtered, total: members.length });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب الأعضاء', members: [], total: 0 });
  }
});

router.get('/roles', async (req, res) => {
  try {
    const [roles, members] = await Promise.all([getRoles(), getMembers()]);
    const counts = new Map();
    for (const m of members) for (const id of (m.roles || [])) counts.set(id, (counts.get(id) || 0) + 1);
    res.json({
      roles: roles.filter(r => !r.managed && r.name !== '@everyone').sort((a,b)=>(b.position||0)-(a.position||0)).map(r => ({
        id: r.id, name: r.name, color: r.hexColor || '#a86fdf',
        membersCount: counts.get(r.id) || 0, permissions: []
      }))
    });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب الرتب', roles: [] });
  }
});

router.get('/roles/:id/members', async (req, res) => {
  try {
    const [roles, members] = await Promise.all([getRoles(), getMembers()]);
    const role = roles.find(r => r.id === req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json({ role: { id: role.id, name: role.name, color: role.hexColor, membersCount: members.filter(m => m.roles?.includes(role.id)).length, permissions: [] }, members: members.filter(m => m.roles?.includes(role.id)).slice(0, 100).map(normalizeMember) });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب أعضاء الرتبة' });
  }
});

router.get('/top', (req, res) => {
  res.json({ messages: [], mentions: [], voice: [], joins: [] });
});

router.get('/member/:id', async (req, res) => {
  try {
    const members = await getMembers();
    const m = members.find(x => x.user.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'Member not found' });
    const n = normalizeMember(m);
    res.json({ ...n, rank: 'عضو', stats: { messages: 0, mentionsReceived: 0, mentionsSent: 0, voiceMinutes: 0, voiceJoins: 0, chatRounds: 0 }, permissions: [] });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب العضو' });
  }
});

router.post('/message', async (req, res) => {
  try {
    const { memberId, title, message } = req.body || {};
    if (!memberId || !message) return res.status(400).json({ error: 'البيانات ناقصة' });
    const members = await getMembers();
    const m = members.find(x => x.user.id === String(memberId));
    if (!m) return res.status(404).json({ error: 'العضو غير موجود' });
    const user = await (await import('discord.js')).Client;
    return res.status(501).json({ error: 'ميزة الرسائل الخاصة ستبقى عبر البوت بعد ربط الخدمة' });
  } catch (e) {
    res.status(500).json({ error: 'تعذر الإرسال' });
  }
});

export default router;
