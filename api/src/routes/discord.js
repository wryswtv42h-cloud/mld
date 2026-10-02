import express from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/members', requireAuth, async (req, res) => {
  try {
    const token = process.env.DISCORD_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!token || !guildId) return res.json({ members: [] });

    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=100`, {
      headers: { Authorization: `Bot ${token}` }
    });
    if (!r.ok) return res.json({ members: [] });
    const data = await r.json();

    const members = data.map(m => ({
      id: m.user.id,
      username: m.user.username,
      name: m.nick || m.user.global_name || m.user.username
    }));

    res.json({ members });
  } catch (err) {
    res.json({ members: [] });
  }
});

router.get('/guilds', requireAuth, async (req, res) => {
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return res.json({ guilds: [] });

    const r = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bot ${token}` }
    });
    if (!r.ok) return res.json({ guilds: [] });
    const data = await r.json();

    const guilds = data.map(g => ({
      id: g.id,
      name: g.name
    }));

    res.json({ guilds });
  } catch (err) {
    res.json({ guilds: [] });
  }
});

export default router;
