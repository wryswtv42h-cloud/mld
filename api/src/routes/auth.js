import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ===== تسجيل الدخول =====
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'أدخل اليوزر والباسورد' });
    }

    // ===== حساب الأونر =====
    if (username === process.env.OWNER_USERNAME &&
        password === process.env.OWNER_PASSWORD) {
      let owner = await User.findOne({ username: process.env.OWNER_USERNAME });
      if (!owner) {
        owner = await User.create({
          username: process.env.OWNER_USERNAME,
          password: process.env.OWNER_PASSWORD,
          discordId: process.env.OWNER_DISCORD_ID,
          discordVerified: true,
          role: 'owner',
          isOwner: true
        });
      }

      const token = jwt.sign({ id: owner._id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
      });

      return res.json({
        token,
        user: owner,
        isOwner: true
      });
    }

    // ===== الأعضاء =====
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'بيانات غير صحيحة' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'بيانات غير صحيحة' });
    }

    if (user.banned) {
      return res.status(403).json({ error: 'الحساب محظور' });
    }

    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== جلب حسابي =====
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ===== تسجيل الخروج =====
router.post('/logout', requireAuth, (req, res) => {
  res.json({ message: 'تم تسجيل الخروج' });
});

export default router;
