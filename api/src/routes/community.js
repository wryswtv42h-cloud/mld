import express from 'express';
import { query } from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = express.Router();

router.get('/chat', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 100');
    res.json({ messages: (rows || []).reverse() });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب الرسائل', messages: [] });
  }
});

router.post('/chat', requireAuth, async (req, res) => {
  try {
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'اكتب رسالة' });
    
    const { rows } = await query(
      `INSERT INTO chat_messages (user_id, username, content, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [req.user.id, req.user.username, content]
    );
    res.json({ message: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'تعذر حفظ الرسالة' });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 100');
    res.json({ reviews: rows || [] });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب الآراء', reviews: [] });
  }
});

router.post('/reviews', requireAuth, async (req, res) => {
  try {
    const content = String(req.body?.content || '').trim();
    const rating = Math.max(1, Math.min(5, Number(req.body?.rating) || 5));
    if (!content) return res.status(400).json({ error: 'اكتب رأيك' });
    
    const { rows } = await query(
      `INSERT INTO reviews (user_id, username, content, rating, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [req.user.id, req.user.username, content, rating]
    );
    res.json({ review: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'تعذر حفظ الرأي' });
  }
});

router.delete('/reviews/:id', requireAuth, requireOwner, async (req, res) => {
  try {
    await query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (e) {
    res.status(500).json({ error: 'تعذر الحذف' });
  }
});

router.get('/tickets', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM tickets WHERE user_id = $1 OR $2 = true ORDER BY created_at DESC',
      [req.user.id, req.user.is_owner]
    );
    res.json({ tickets: rows || [] });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب التذاكر', tickets: [] });
  }
});

router.post('/tickets', requireAuth, async (req, res) => {
  try {
    const subject = String(req.body?.subject || '').trim();
    const content = String(req.body?.content || '').trim();
    if (!subject || !content) return res.status(400).json({ error: 'املأ الحقول المطلوبة' });
    
    const { rows } = await query(
      `INSERT INTO tickets (user_id, username, subject, content, status, created_at)
       VALUES ($1, $2, $3, $4, 'open', NOW())
       RETURNING *`,
      [req.user.id, req.user.username, subject, content]
    );
    res.json({ ticket: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'تعذر إنشاء التذكرة' });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM groups WHERE status IS DISTINCT FROM \'deleted\' ORDER BY created_at DESC');
    res.json({ groups: rows || [] });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب القروبات', groups: [] });
  }
});

router.post('/groups', requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'اكتب اسم القروب' });
    
    const { rows } = await query(
      `INSERT INTO groups (creator_id, creator_name, name, description, status, created_at)
       VALUES ($1, $2, $3, $4, 'active', NOW())
       RETURNING *`,
      [req.user.id, req.user.username, name, req.body?.description || '']
    );
    res.json({ group: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'تعذر إنشاء القروب' });
  }
});

router.get('/pigeon', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM pigeon_messages WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ messages: rows || [] });
  } catch (e) {
    res.status(503).json({ error: 'تعذر جلب الرسائل', messages: [] });
  }
});

router.post('/pigeon', requireAuth, async (req, res) => {
  try {
    const recipient = String(req.body?.recipient_id || '').trim();
    const content = String(req.body?.content || '').trim();
    if (!recipient || !content) return res.status(400).json({ error: 'املأ البيانات' });
    
    const { rows } = await query(
      `INSERT INTO pigeon_messages (sender_id, sender_name, recipient_id, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [req.user.id, req.user.username, recipient, content]
    );
    res.json({ message: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'تعذر إرسال الرسالة' });
  }
});

export default router;
