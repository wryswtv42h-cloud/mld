import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ===== قائمة بوتاتي =====
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const bots = rows.map(({ token, ...b }) => b);
  res.json({ bots });
});

// ===== إضافة بوت جديد =====
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, token, guild_id } = req.body;
    if (!name || !token) {
      return res.status(400).json({ error: 'أدخل الاسم والتوكن' });
    }

    const { rows } = await query(
      `INSERT INTO bots (user_id, name, token, guild_id, watching, site_url, locked)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
      [req.user.id, name, token, guild_id || null, 'MLD | فهد المطيري', '']
    );

    const { token: _, ...bot } = rows[0];
    res.json({ bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== تعديل بوت =====
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { name, guild_id } = req.body;
    const { rows } = await query('SELECT * FROM bots WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'البوت غير موجود' });

    if (name !== undefined) {
      await query('UPDATE bots SET name = $1 WHERE id = $2', [name, req.params.id]);
    }
    if (guild_id !== undefined) {
      await query('UPDATE bots SET guild_id = $1 WHERE id = $2', [guild_id, req.params.id]);
    }

    const updated = await query('SELECT * FROM bots WHERE id = $1', [req.params.id]);
    const { token, ...bot } = updated.rows[0];
    res.json({ bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== حذف بوت =====
router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM bots WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id
  ]);
  res.json({ message: 'تم الحذف' });
});

// ===== تشغيل / إيقاف =====
router.post('/:id/toggle', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM bots WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'البوت غير موجود' });

  await query('UPDATE bots SET active = NOT active WHERE id = $1', [req.params.id]);
  res.json({ message: rows[0].active ? 'تم الإيقاف' : 'تم التشغيل' });
});

export default router;
