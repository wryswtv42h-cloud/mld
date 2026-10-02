import express from 'express';
import Message from '../models/Message.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ===== جلب رسائل غرفة =====
router.get('/:roomId', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({
      roomId: req.params.roomId,
      deleted: false,
      type: { $in: ['public', 'private'] }
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب الرسائل' });
  }
});

// ===== حذف رسالة =====
router.delete('/message/:id', requireAuth, async (req, res) => {
  const msg = await Message.findById(req.params.id);
  if (!msg) return res.status(404).json({ error: 'غير موجودة' });

  const isOwner = req.user.isOwner;
  const isSender = msg.sender.toString() === req.user._id.toString();

  if (!isOwner && !isSender) {
    return res.status(403).json({ error: 'ما تملك الصلاحية' });
  }

  msg.deleted = true;
  await msg.save();
  res.json({ message: 'تم الحذف' });
});

// ===== الزاجل (الرسائل السرية) =====
router.post('/zajel', requireAuth, async (req, res) => {
  const { toUsername, content, anonymous } = req.body;

  if (!content || content.length > 1000) {
    return res.status(400).json({ error: 'محتوى غير صالح' });
  }

  const roomId = `zajel-${toUsername}`;

  const msg = await Message.create({
    roomId,
    sender: req.user._id,
    senderName: anonymous ? 'مجهول' : req.user.username,
    content,
    type: 'secret',
    anonymous: !!anonymous
  });

  res.json({ message: 'تم الإرسال', id: msg._id });
});

export default router;
