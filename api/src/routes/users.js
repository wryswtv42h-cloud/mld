import express from 'express';
import { query, findUserById, findUserByUsername, updateUser, deleteUser, publicUser } from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(`select username, avatar, bio, role, last_seen, discord_verified
      from public.users where banned = false order by last_seen desc limit 100`);
    res.json({ users: result.rows.map(row => ({
      username: row.username, avatar: row.avatar, bio: row.bio, role: row.role,
      lastSeen: row.last_seen, discordVerified: row.discord_verified
    })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في جلب الأعضاء' });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { avatar, bio, username } = req.body;
    const fields = {};
    if (avatar !== undefined) fields.avatar = avatar;
    if (bio !== undefined) fields.bio = bio;

    if (username && username !== req.user.username) {
      const exists = await findUserByUsername(username);
      if (exists && String(exists.id) !== String(req.user.id)) return res.status(400).json({ error: 'الاسم مستخدم' });
      fields.username = username;
    }

    const updated = await updateUser(req.user.id, fields);
    res.json({ user: publicUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في تعديل الحساب' });
  }
});

router.delete('/:id', requireAuth, requireOwner, async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'لا تحذف نفسك' });
  await deleteUser(req.params.id);
  res.json({ message: 'تم الحذف' });
});

router.post('/:id/ban', requireAuth, requireOwner, async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'غير موجود' });
  if (user.is_owner) return res.status(400).json({ error: 'لا تحظر الأونر' });
  const updated = await updateUser(user.id, { banned: !user.banned });
  res.json({ message: updated.banned ? 'تم الحظر' : 'تم فك الحظر' });
});

export default router;
