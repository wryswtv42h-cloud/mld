import express from 'express';
import { query } from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT id, username, avatar, bio, role, is_owner, discord_verified, last_seen FROM users ORDER BY last_seen DESC LIMIT 100'
  );
  res.json({ users: rows });
});

router.patch('/me', requireAuth, async (req, res) => {
  const { avatar, bio, username } = req.body;

  if (username && username !== req.user.username) {
    const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rows[0]) return res.status(400).json({ error: 'الاسم مستخدم' });
    await query('UPDATE users SET username = $1 WHERE id = $2', [username, req.user.id]);
  }
  if (avatar !== undefined) await query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, req.user.id]);
  if (bio !== undefined) await query('UPDATE users SET bio = $1 WHERE id = $2', [bio, req.user.id]);

  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const { password, ...user } = rows[0];
  res.json({ user });
});

router.post('/:id/ban', requireAuth, requireOwner, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'غير موجود' });
  if (user.is_owner) return res.status(400).json({ error: 'لا تحظر الأونر' });

  await query('UPDATE users SET banned = NOT banned WHERE id = $1', [user.id]);
  res.json({ message: user.banned ? 'تم فك الحظر' : 'تم الحظر' });
});

router.delete('/:id', requireAuth, requireOwner, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'لا تحذف نفسك' });
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ message: 'تم الحذف' });
});

export default router;
