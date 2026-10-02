import express from 'express';
import { query } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// ===== قائمة الجلسات المتاحة =====
router.get('/sessions', optionalAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, game_type, host_name, status, players, spectators, max_players, created_at
     FROM game_sessions WHERE status IN ('waiting', 'playing')
     ORDER BY created_at DESC LIMIT 50`
  );
  res.json({ sessions: rows });
});

// ===== إنشاء جلسة جديدة =====
router.post('/sessions', optionalAuth, async (req, res) => {
  try {
    const { game_type, max_players, guest_name } = req.body;
    if (!game_type) return res.status(400).json({ error: 'حدد نوع اللعبة' });

    const hostName = req.user?.username || guest_name || 'زائر';

    const { rows } = await query(
      `INSERT INTO game_sessions (game_type, host_id, host_name, max_players, players, status)
       VALUES ($1, $2, $3, $4, $5, 'waiting') RETURNING *`,
      [
        game_type,
        req.user?.id || null,
        hostName,
        max_players || 4,
        JSON.stringify([{ name: hostName, userId: req.user?.id || null, isBot: false, isHost: true }])
      ]
    );

    res.json({ session: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== تفاصيل جلسة =====
router.get('/sessions/:id', optionalAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'الجلسة غير موجودة' });
  res.json({ session: rows[0] });
});

// ===== حذف جلسة (صاحبها أو الأونر فقط) =====
router.delete('/sessions/:id', optionalAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
  const session = rows[0];
  if (!session) return res.status(404).json({ error: 'غير موجودة' });

  const isHost = req.user && session.host_id === req.user.id;
  const isOwner = req.user?.is_owner;

  if (!isHost && !isOwner) {
    return res.status(403).json({ error: 'مالك الجلسة أو الأونر فقط' });
  }

  await query('DELETE FROM game_sessions WHERE id = $1', [req.params.id]);
  res.json({ message: 'تم إنهاء الجلسة' });
});

export default router;
