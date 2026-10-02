import { query } from '../db.js';
import { initGame, handleAction, tickGame } from '../games/engine.js';

// تخزين مؤقت للجلسات النشطة
const activeSessions = new Map();

export function setupGameSocket(io, socket) {
  // ===== الانضمام لجلسة =====
  socket.on('game:join', async ({ sessionId, asSpectator }) => {
    try {
      const { rows } = await query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
      const session = rows[0];
      if (!session) return socket.emit('game:error', { error: 'الجلسة غير موجودة' });

      const name = socket.user?.username || 'زائر';
      const player = { name, userId: socket.user?.id || null, isBot: false, socketId: socket.id };

      let players = session.players || [];
      let spectators = session.spectators || [];

      if (asSpectator) {
        if (!spectators.find(s => s.socketId === socket.id)) {
          spectators.push(player);
        }
      } else {
        if (!players.find(p => p.socketId === socket.id)) {
          if (players.length >= session.max_players) {
            spectators.push(player);
          } else {
            players.push(player);
          }
        }
      }

      await query(
        'UPDATE game_sessions SET players = $1, spectators = $2 WHERE id = $3',
        [JSON.stringify(players), JSON.stringify(spectators), sessionId]
      );

      socket.join('game:' + sessionId);
      activeSessions.set(sessionId, { players, spectators, state: session.state, gameType: session.game_type });

      io.to('game:' + sessionId).emit('game:update', {
        players,
        spectators,
        state: session.state,
        status: session.status
      });
    } catch (err) {
      console.error(err);
      socket.emit('game:error', { error: 'خطأ في الانضمام' });
    }
  });

  // ===== الخروج =====
  socket.on('game:leave', async ({ sessionId }) => {
    const { rows } = await query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
    const session = rows[0];
    if (!session) return;

    const players = (session.players || []).filter(p => p.socketId !== socket.id);
    const spectators = (session.spectators || []).filter(s => s.socketId !== socket.id);

    await query(
      'UPDATE game_sessions SET players = $1, spectators = $2 WHERE id = $3',
      [JSON.stringify(players), JSON.stringify(spectators), sessionId]
    );

    socket.leave('game:' + sessionId);
    io.to('game:' + sessionId).emit('game:update', { players, spectators, state: session.state, status: session.status });
  });

  // ===== بدء اللعبة =====
  socket.on('game:start', async ({ sessionId }) => {
    try {
      const { rows } = await query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
      const session = rows[0];
      if (!session) return socket.emit('game:error', { error: 'الجلسة غير موجودة' });

      // فقط صاحب الجلسة أو الأونر
      const isHost = session.host_name === (socket.user?.username || 'زائر');
      const isOwner = socket.user?.is_owner;
      if (!isHost && !isOwner) {
        return socket.emit('game:error', { error: 'صاحب الجلسة أو الأونر فقط' });
      }

      const state = await initGame(session.game_type, session.players);

      await query(
        'UPDATE game_sessions SET state = $1, status = $2 WHERE id = $3',
        [JSON.stringify(state), 'playing', sessionId]
      );

      io.to('game:' + sessionId).emit('game:started', { state });
      io.to('game:' + sessionId).emit('game:update', {
        players: session.players,
        spectators: session.spectators,
        state,
        status: 'playing'
      });

      // تشغيل البوتات
      startBotLoop(io, sessionId, session.game_type);
    } catch (err) {
      console.error(err);
      socket.emit('game:error', { error: 'خطأ في بدء اللعبة' });
    }
  });

  // ===== إجراء في اللعبة =====
  socket.on('game:action', async ({ sessionId, action }) => {
    try {
      const { rows } = await query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
      const session = rows[0];
      if (!session) return;

      const playerName = socket.user?.username || 'زائر';
      const newState = await handleAction(session.game_type, session.state, playerName, action);

      await query('UPDATE game_sessions SET state = $1 WHERE id = $2', [JSON.stringify(newState), sessionId]);

      io.to('game:' + sessionId).emit('game:update', {
        players: session.players,
        spectators: session.spectators,
        state: newState,
        status: session.status
      });

      if (newState.finished) {
        await query('UPDATE game_sessions SET status = $1 WHERE id = $2', ['finished', sessionId]);
        io.to('game:' + sessionId).emit('game:finished', { winner: newState.winner });
      }
    } catch (err) {
      console.error(err);
      socket.emit('game:error', { error: 'خطأ في الإجراء' });
    }
  });

  // ===== شات الجلسة =====
  socket.on('game:chat', ({ sessionId, message }) => {
    const name = socket.user?.username || 'زائر';
    io.to('game:' + sessionId).emit('game:chat', { name, message, time: Date.now() });
  });

  // ===== إنهاء الجلسة =====
  socket.on('game:end', async ({ sessionId }) => {
    const { rows } = await query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
    const session = rows[0];
    if (!session) return;

    const isHost = session.host_name === (socket.user?.username || 'زائر');
    const isOwner = socket.user?.is_owner;
    if (!isHost && !isOwner) return;

    await query('DELETE FROM game_sessions WHERE id = $1', [sessionId]);
    io.to('game:' + sessionId).emit('game:ended');
    activeSessions.delete(sessionId);
  });
}

// ===== حلقة البوتات =====
function startBotLoop(io, sessionId, gameType) {
  const interval = setInterval(async () => {
    try {
      const { rows } = await query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
      const session = rows[0];
      if (!session || session.status !== 'playing') {
        clearInterval(interval);
        return;
      }

      const result = await tickGame(gameType, session.state);
      if (result.changed) {
        await query('UPDATE game_sessions SET state = $1 WHERE id = $2', [JSON.stringify(result.state), sessionId]);
        io.to('game:' + sessionId).emit('game:update', {
          players: session.players,
          spectators: session.spectators,
          state: result.state,
          status: session.status
        });
      }
    } catch (err) {
      clearInterval(interval);
    }
  }, 3000);
}
