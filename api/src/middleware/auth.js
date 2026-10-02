import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'غير مصرح' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = rows[0];

    if (!user || user.banned) return res.status(401).json({ error: 'الحساب غير متاح' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'جلسة غير صالحة' });
  }
}

export async function requireOwner(req, res, next) {
  if (!req.user?.is_owner) return res.status(403).json({ error: 'للأونر فقط' });
  next();
}
