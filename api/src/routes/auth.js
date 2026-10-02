import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'أدخل البيانات' });

    if (username === process.env.OWNER_USERNAME && password === process.env.OWNER_PASSWORD) {
      let { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
      let owner = rows[0];

      if (!owner) {
        const hash = await bcrypt.hash(password, 10);
        const result = await query(
          `INSERT INTO users (username, password, discord_id, discord_verified, role, is_owner)
           VALUES ($1, $2, $3, TRUE, 'owner', TRUE) RETURNING *`,
          [username, hash, process.env.OWNER_DISCORD_ID]
        );
        owner = result.rows[0];
      }

      const token = jwt.sign({ id: owner.id }, (process.env.JWT_SECRET || process.env.OWNER_PASSWORD), { expiresIn: '30d' });
      const { password: _, ...user } = owner;
      return res.json({ token, user });
    }

    const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'بيانات غير صحيحة' });

    await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ id: user.id }, (process.env.JWT_SECRET || process.env.OWNER_PASSWORD), { expiresIn: '30d' });
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, password, discord_id } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'أدخل البيانات' });
    if (username.length < 2 || password.length < 6) return res.status(400).json({ error: 'بيانات قصيرة' });

    const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rows[0]) return res.status(400).json({ error: 'الاسم مستخدم' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (username, password, discord_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [username, hash, discord_id || null]
    );
    const { password: _, ...user } = rows[0];

    const token = jwt.sign({ id: user.id }, (process.env.JWT_SECRET || process.env.OWNER_PASSWORD), { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const { password, ...user } = req.user;
  res.json({ user });
});

export default router;
