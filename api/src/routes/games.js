import express from 'express';
import { query } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

function normalizeGame(row) {
  return {
    ...row,
    game_type: row.type,
    host_name: row.host_name || null,
    spectators: [],
    max_players: row.max_players || 4
  };
}

// ===== قائمة الجلسات المتاحة =====
router.get('/sessions', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT g.id, g.name, g.type, g.status, g.host_id, g.players, g.created_at, g.max_players,
              u.username AS host_name
       FROM games g
       LEFT JOIN users u ON u.id = g.host_id
       WHERE g.status IN ('open', 'waiting', 'playing')
       ORDER BY g.created_at DESC LIMIT 50`
    );
    res.json({ sessions: (rows || []).map(normalizeGame) });
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: 'خطأ في السيرفر', sessions: [] });
  }
});

// ===== إنشاء جلسة جديدة =====
router.post('/sessions', optionalAuth, async (req, res) => {
  try {
    const { game_type, max_players, guest_name } = req.body || {};
    if (!game_type) return res.status(400).json({ error: 'حدد نوع اللعبة' });

    const hostId = req.user?.id || null;
    const hostName = req.user?.username || guest_name || 'زائر';
    const name = req.body.name || `جلسة ${game_type}`;
    const players = JSON.stringify([{
      name: hostName,
      userId: hostId,
      isBot: false,
      isHost: true
    }]);

    const { rows } = await query(
      `INSERT INTO games (name, type, status, host_id, players, max_players, created_at)
       VALUES ($1, $2, 'open', $3, $4, $5, NOW())
       RETURNING *`,
      [name, game_type, hostId, players, max_players || 4]
    );

    const { rows: enriched } = await query(
      `SELECT g.*, u.username AS host_name
       FROM games g LEFT JOIN users u ON u.id = g.host_id
       WHERE g.id = $1`,
      [rows[0].id]
    );

    res.json({ session: normalizeGame(enriched[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== تفاصيل جلسة =====
router.get('/sessions/:id', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT g.*, u.username AS host_name
       FROM games g LEFT JOIN users u ON u.id = g.host_id
       WHERE g.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    res.json({ session: normalizeGame(rows[0]) });
  } catch (err) {
    res.status(503).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== حذف جلسة =====
router.delete('/sessions/:id', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    const session = rows[0];
    if (!session) return res.status(404).json({ error: 'غير موجودة' });

    const isHost = req.user && String(session.host_id) === String(req.user.id);
    const isOwner = req.user?.is_owner;

    if (!isHost && !isOwner) {
      return res.status(403).json({ error: 'مالك الجلسة أو الأونر فقط' });
    }

    await query('DELETE FROM games WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم إنهاء الجلسة' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

export default router;
