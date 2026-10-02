import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.banned) {
      return res.status(401).json({ error: 'الحساب غير متاح' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'جلسة غير صالحة' });
  }
}

export async function requireOwner(req, res, next) {
  if (!req.user?.isOwner) {
    return res.status(403).json({ error: 'هذي الصلاحية للأونر فقط' });
  }
  next();
}

export async function requireStaff(req, res, next) {
  const allowed = ['owner', 'co-owner', 'founder', 'staff'];
  if (!allowed.includes(req.user?.role)) {
    return res.status(403).json({ error: 'هذي الصلاحية للإدارة فقط' });
  }
  next();
}
