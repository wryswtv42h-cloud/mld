import express from 'express';
import jwt from 'jsonwebtoken';
import { query, findUserByUsername, createUser, updateUser, comparePassword, publicUser } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'أدخل اليوزر والباسورد' });

    if (username === process.env.OWNER_USERNAME && password === process.env.OWNER_PASSWORD) {
      let owner = await findUserByUsername(process.env.OWNER_USERNAME);
      if (!owner) {
        owner = await createUser({
          username: process.env.OWNER_USERNAME,
          password: process.env.OWNER_PASSWORD,
          discordId: process.env.OWNER_DISCORD_ID || null,
          discordVerified: true,
          role: 'owner',
          isOwner: true
        });
      } else if (!owner.is_owner) {
        owner = await updateUser(owner.id, {
          discordId: process.env.OWNER_DISCORD_ID || owner.discord_id,
          discordVerified: true,
          role: 'owner',
          isOwner: true
        });
      }

      const token = jwt.sign({ id: owner.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, user: publicUser(owner), isOwner: true });
    }

    const user = await findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });

    const valid = await comparePassword(password, user.password);
    if (!valid) return res.status(401).json({ error: 'بيانات غير صحيحة' });
    if (user.banned) return res.status(403).json({ error: 'الحساب محظور' });

    const updated = await updateUser(user.id, { lastSeen: new Date() });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: publicUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
router.post('/logout', requireAuth, (req, res) => res.json({ message: 'تم تسجيل الخروج' }));

router.post('/verify-discord', async (req, res) => {
  try {
    const { discordId, code } = req.body;
    if (!discordId || !code) return res.status(400).json({ error: 'بيانات التحقق ناقصة' });

    const found = await query(
      'select * from public.users where discord_id = $1 and verification_code = $2 limit 1',
      [discordId, code]
    );
    const user = found.rows[0];
    if (!user) return res.status(400).json({ error: 'كود التحقق غير صحيح' });

    const updated = await updateUser(user.id, { discordVerified: true, verificationCode: null });
    res.json({ message: 'تم التحقق', user: publicUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في التحقق' });
  }
});

export default router;
