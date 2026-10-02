import express from 'express';

const router = express.Router();

// ===== معلومات السيرفر =====
router.get('/server', (req, res) => {
  res.json({
    id: process.env.DISCORD_GUILD_ID || 'MLD',
    name: 'MLD',
    memberCount: 0,
    ownerName: 'فهد المطيري',
    invite: 'https://discord.com/users/w4px'
  });
});

// ===== الأعضاء =====
router.get('/members', (req, res) => {
  res.json({ members: [], total: 0 });
});

// ===== الرتب =====
router.get('/roles', (req, res) => {
  res.json({ roles: [] });
});

// ===== التوب =====
router.get('/top', (req, res) => {
  res.json({ messages: [], mentions: [], voice: [], joins: [] });
});

// ===== عضو محدد =====
router.get('/member/:id', (req, res) => {
  res.status(404).json({ error: 'Member not found' });
});

// ===== إرسال رسالة خاصة =====
router.post('/message', (req, res) => {
  res.json({ ok: true });
});

export default router;
