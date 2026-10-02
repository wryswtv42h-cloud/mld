import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  const bots = rows.map(({ token, ...b }) => b);
  res.json({ bots });
});

router.post('/', requireAuth, async (req, res) => {
  const { name, token, guild_id } = req.body;
  if (!name || !token) return res.status(400).json({ error: 'أدخل الاسم والتوكن' });

  const { rows } = await query(
    `INSERT INTO bots (user_id, name, token, guild_id, watching, site_url, locked)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
    [req.user.id, name, token, guild_id || null, 'MLD | فهد المطيري', '']
  );

  const { token: _, ...bot } = rows[0];
  res.json({ bot });
});

export default router;
