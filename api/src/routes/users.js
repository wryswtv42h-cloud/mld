import express from 'express';
import User from '../models/User.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// ===== قائمة الأعضاء =====
router.get('/', requireAuth, async (req, res) => {
  const users = await User.find({ banned: false })
    .select('username avatar bio role lastSeen discordVerified')
    .sort({ lastSeen: -1 })
    .limit(100);
  res.json({ users });
});

// ===== بروفايلي =====
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ===== تعديل بروفايلي =====
router.patch('/me', requireAuth, async (req, res) => {
  const { avatar, bio, username } = req.body;

  if (avatar !== undefined) req.user.avatar = avatar;
  if (bio !== undefined) req.user.bio = bio;
  if (username && username !== req.user.username) {
    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ error: 'الاسم مستخدم' });
    }
    req.user.username = username;
  }

  await req.user.save();
  res.json({ user: req.user });
});

// ===== حذف حساب (أونر فقط) =====
router.delete('/:id', requireAuth, requireOwner, async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ error: 'لا تحذف نفسك' });
  }
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'تم الحذف' });
});

// ===== حظر / فك حظر (أونر فقط) =====
router.post('/:id/ban', requireAuth, requireOwner, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'غير موجود' });
  if (user.isOwner) return res.status(400).json({ error: 'لا تحظر الأونر' });
  user.banned = !user.banned;
  await user.save();
  res.json({ message: user.banned ? 'تم الحظر' : 'تم فك الحظر' });
});

export default router;
