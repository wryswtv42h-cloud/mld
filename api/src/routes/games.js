import express from 'express';
import { query } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

const GAME_LIMITS = {
  uno: [2,6], jaccaro:[2,4], codenames:[2,6], baloot:[4,4],
  ludo:[2,4], monopoly:[2,6], maqousar:[2,6]
};
function limits(type){ return GAME_LIMITS[type] || [2,6]; }

function normalizeGame(row) {
  return {
    ...row,
    game_type: row.type,
    host_name: row.host_name || null,
    spectators: [],
    max_players: Number(row.max_players || limits(row.type)[1])
  };
}

// ===== قائمة الجلسات المتاحة =====
router.get('/sessions', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT g.id, g.name, g.type, g.status, g.host_id, g.players, g.created_at,
              u.username AS host_name
       FROM games g
       LEFT JOIN users u ON u.id = g.host_id
       WHERE g.status IN ('open', 'waiting', 'playing')
       ORDER BY g.created_at DESC LIMIT 50`
    );
    res.json({ sessions: rows.map(normalizeGame) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== إنشاء جلسة جديدة =====
router.post('/sessions', optionalAuth, async (req, res) => {
  try {
    const { game_type, max_players, guest_name } = req.body;
    if (!game_type || !GAME_LIMITS[game_type]) return res.status(400).json({ error: 'اللعبة غير متاحة' });
    const [minPlayers,maxAllowed] = limits(game_type);
    const requestedMax = Number(max_players || maxAllowed);
    if (!Number.isInteger(requestedMax) || requestedMax < minPlayers || requestedMax > maxAllowed) return res.status(400).json({ error: `عدد اللاعبين يجب أن يكون بين ${minPlayers} و${maxAllowed}` });
    if (req.user) {
      const active = await query("SELECT id FROM games WHERE host_id=$1 AND status IN ('waiting','playing') LIMIT 1", [req.user.id]);
      if (active.rows[0]) return res.status(409).json({ error:'لديك جلسة نشطة بالفعل' });
    }

    const hostId = req.user?.id || null;
    const hostName = req.user?.username || guest_name || 'زائر';
    const name = req.body.name || game_type;
    const players = JSON.stringify([{
      name: hostName,
      userId: hostId,
      isBot: false,
      isHost: true
    }]);

    const { rows } = await query(
      `INSERT INTO games (name, type, status, host_id, players, min_players, max_players)
       VALUES ($1, $2, 'waiting', $3, $4, $5, $6)
       RETURNING *`,
      [name, game_type, hostId, players, minPlayers, requestedMax]
    );

    const { rows: enriched } = await query(
      `SELECT g.*, u.username AS host_name
       FROM games g LEFT JOIN users u ON u.id = g.host_id
       WHERE g.id = $1`,
      [rows[0].id]
    );

    await query('UPDATE games SET players=$1 WHERE id=$2',[JSON.stringify([{name:hostName,userId:hostId,isBot:false,isHost:true}]),rows[0].id]);
    res.json({ session: { ...normalizeGame(enriched[0]), max_players: requestedMax, min_players:minPlayers } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== تفاصيل جلسة =====
router.get('/sessions/:id', optionalAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT g.*, u.username AS host_name
     FROM games g LEFT JOIN users u ON u.id = g.host_id
     WHERE g.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'الجلسة غير موجودة' });
  res.json({ session: normalizeGame(rows[0]) });
});

// ===== حذف جلسة =====
router.delete('/sessions/:id', optionalAuth, async (req, res) => {
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
});

export default router;
