import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/:roomId', requireAuth, async (req, res) => {
  try {
    const result = await query(`select id, room_id, sender_id, sender_name, content, type, anonymous, deleted, created_at
      from public.messages where room_id = $1 and deleted = false and type in ('public','private')
      order by created_at desc limit 100`, [req.params.roomId]);

    const messages = result.rows.reverse().map(row => ({
      _id: row.id, id: row.id, roomId: row.room_id, sender: row.sender_id,
      senderName: row.sender_name, content: row.content, type: row.type,
      anonymous: row.anonymous, deleted: row.deleted, createdAt: row.created_at
    }));
    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في جلب الرسائل' });
  }
});

router.delete('/message/:id', requireAuth, async (req, res) => {
  try {
    const result = await query('select * from public.messages where id = $1 limit 1', [req.params.id]);
    const msg = result.rows[0];
    if (!msg) return res.status(404).json({ error: 'غير موجودة' });

    const isSender = String(msg.sender_id) === String(req.user.id);
    if (!req.user.isOwner && !isSender) return res.status(403).json({ error: 'ما تملك الصلاحية' });

    await query('update public.messages set deleted = true where id = $1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في حذف الرسالة' });
  }
});

router.post('/zajel', requireAuth, async (req, res) => {
  try {
    const { toUsername, content, anonymous } = req.body;
    if (!content || content.length > 1000) return res.status(400).json({ error: 'محتوى غير صالح' });

    const roomId = `zajel-${toUsername}`;
    const result = await query(`insert into public.messages
      (room_id, sender_id, sender_name, content, type, anonymous)
      values ($1,$2,$3,$4,'secret',$5) returning id`,
      [roomId, req.user.id, anonymous ? 'مجهول' : req.user.username, content, !!anonymous]);

    res.json({ message: 'تم الإرسال', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة' });
  }
});

export default router;
