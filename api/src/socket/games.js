import { query } from '../db.js';
import { initGame, handleAction, tickGame } from '../games/engine.js';

const activeSessions = new Map();
const DEFAULT_MAX_PLAYERS = 4;

function parsePlayers(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function getRuntime(session) {
  let runtime = activeSessions.get(String(session.id));
  if (!runtime) {
    runtime = {
      players: parsePlayers(session.players),
      spectators: [],
      state: null,
      gameType: session.type,
      status: session.status,
      hostSocketId: null,
      lastActivity: Date.now()
    };
    activeSessions.set(String(session.id), runtime);
  }
  return runtime;
}

function isHost(session, socket) {
  const runtime = getRuntime(session);
  return runtime.hostSocketId === socket.id || (!!socket.user && String(session.host_id) === String(socket.user.id));
}

function snapshot(session, runtime, socket=null) {
  const state = runtime.state ? JSON.parse(JSON.stringify(runtime.state)) : null;
  if(state?.game === 'codenames' && socket){
    const name = socket.user?.username || 'زائر';
    const isSpymaster = state.clueGivers?.red === name || state.clueGivers?.blue === name;
    if(!isSpymaster && Array.isArray(state.words)) state.words = state.words.map(w => ({...w, color: w.revealed ? w.color : null}));
  }
  return { players: runtime.players, spectators: runtime.spectators, state, status: runtime.status };
}
async function broadcastUpdate(io, sessionId, session, runtime){
  const sockets = await io.in('game:' + sessionId).fetchSockets();
  for(const s of sockets) s.emit('game:update', snapshot(session,runtime,s));
}

async function persistPlayers(sessionId, players) {
  await query('UPDATE games SET players = $1 WHERE id = $2', [JSON.stringify(players), sessionId]);
}

export function setupGameSocket(io, socket) {
  socket.on('game:join', async ({ sessionId, asSpectator = false }) => {
    try {
      const { rows } = await query('SELECT * FROM games WHERE id = $1', [sessionId]);
      const session = rows[0];
      if (!session) return socket.emit('game:error', { error: 'الجلسة غير موجودة' });

      const runtime = getRuntime(session);
      runtime.lastActivity = Date.now();
      const name = socket.user?.username || 'زائر';
      const player = { name, userId: socket.user?.id || null, isBot: false, socketId: socket.id };

      if (asSpectator) {
        if (!runtime.spectators.some(p => p.socketId === socket.id)) runtime.spectators.push(player);
      } else if (!runtime.players.some(p => p.socketId === socket.id || (socket.user?.id && String(p.userId) === String(socket.user.id)))) {
        if (socket.user?.id) {
          const active = await query(
            "SELECT id FROM games WHERE status IN ('waiting','playing') AND id<>$1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(players) p WHERE p->>'userId'=$2) LIMIT 1",
            [sessionId, String(socket.user.id)]
          );
          if (active.rows[0]) return socket.emit('game:error', { error: 'لديك جلسة ألعاب نشطة بالفعل' });
        }
        const maxPlayers = Number(session.max_players || DEFAULT_MAX_PLAYERS);
        if (runtime.players.length >= maxPlayers) {
          runtime.spectators.push(player);
        } else {
          runtime.players.push(player);
          if (!runtime.hostSocketId) runtime.hostSocketId = socket.id;
          await persistPlayers(sessionId, runtime.players);
        }
      }

      socket.join('game:' + sessionId);
      await broadcastUpdate(io, sessionId, session, runtime);
    } catch (err) {
      console.error(err);
      socket.emit('game:error', { error: 'خطأ في الانضمام' });
    }
  });

  socket.on('game:leave', async ({ sessionId }) => {
    try {
      const { rows } = await query('SELECT * FROM games WHERE id = $1', [sessionId]);
      const session = rows[0];
      if (!session) return;
      const runtime = getRuntime(session);
      runtime.lastActivity = Date.now();
      runtime.players = runtime.players.filter(p => p.socketId !== socket.id);
      if (runtime.hostSocketId === socket.id) runtime.hostSocketId = runtime.players[0]?.socketId || null;
      runtime.spectators = runtime.spectators.filter(p => p.socketId !== socket.id);
      await persistPlayers(sessionId, runtime.players);
      socket.leave('game:' + sessionId);
      await broadcastUpdate(io, sessionId, session, runtime);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('game:start', async ({ sessionId }) => {
    try {
      const { rows } = await query('SELECT * FROM games WHERE id = $1', [sessionId]);
      const session = rows[0];
      if (!session) return socket.emit('game:error', { error: 'الجلسة غير موجودة' });
      if (!isHost(session, socket) && !socket.user?.is_owner) {
        return socket.emit('game:error', { error: 'صاحب الجلسة أو الأونر فقط' });
      }

      const runtime = getRuntime(session);
      runtime.lastActivity = Date.now();
      const minPlayers = Number(session.min_players || 2);
      if (runtime.players.filter(p=>!p.isBot).length < minPlayers) return socket.emit('game:error', { error: `تحتاج إلى ${minPlayers} لاعبين على الأقل` });
      runtime.state = await initGame(session.type, runtime.players);
      runtime.status = 'playing';
      await query('UPDATE games SET status = $1 WHERE id = $2', ['playing', sessionId]);

      io.to('game:' + sessionId).emit('game:started', { state: runtime.state });
      await broadcastUpdate(io, sessionId, session, runtime);
      startBotLoop(io, sessionId);
    } catch (err) {
      console.error(err);
      socket.emit('game:error', { error: err.message || 'خطأ في بدء اللعبة' });
    }
  });

  socket.on('game:action', async ({ sessionId, action }) => {
    try {
      const { rows } = await query('SELECT * FROM games WHERE id = $1', [sessionId]);
      const session = rows[0];
      if (!session) return;
      const runtime = getRuntime(session);
      runtime.lastActivity = Date.now();
      if (!runtime.state) return socket.emit('game:error', { error: 'اللعبة لم تبدأ بعد' });

      const playerName = socket.user?.username || 'زائر';
      runtime.state = await handleAction(session.type, runtime.state, playerName, action);
      await broadcastUpdate(io, sessionId, session, runtime);

      if (runtime.state.finished) {
        runtime.status = 'finished';
        await query('UPDATE games SET status = $1 WHERE id = $2', ['finished', sessionId]);
        io.to('game:' + sessionId).emit('game:finished', { winner: runtime.state.winner });
      }
    } catch (err) {
      console.error(err);
      socket.emit('game:error', { error: 'خطأ في الإجراء' });
    }
  });

  socket.on('game:chat', ({ sessionId, message }) => {
    const name = socket.user?.username || 'زائر';
    io.to('game:' + sessionId).emit('game:chat', { name, message, time: Date.now() });
  });

  socket.on('game:end', async ({ sessionId }) => {
    const { rows } = await query('SELECT * FROM games WHERE id = $1', [sessionId]);
    const session = rows[0];
    if (!session) return;
    if (!isHost(session, socket) && !socket.user?.is_owner) return;

    await query('DELETE FROM games WHERE id = $1', [sessionId]);
    io.to('game:' + sessionId).emit('game:ended');
    activeSessions.delete(String(sessionId));
  });

  socket.on('disconnect', async () => {
    for (const [sessionId, runtime] of activeSessions) {
      const removed = runtime.players.some(p => p.socketId === socket.id) || runtime.spectators.some(p => p.socketId === socket.id);
      if (!removed) continue;
      runtime.players = runtime.players.filter(p => p.socketId !== socket.id);
      runtime.spectators = runtime.spectators.filter(p => p.socketId !== socket.id);
      try {
        await persistPlayers(sessionId, runtime.players);
        await broadcastUpdate(io, sessionId, session, runtime);
      } catch {}
    }
  });
}

function startBotLoop(io, sessionId) {
  const interval = setInterval(async () => {
    try {
      const { rows } = await query('SELECT * FROM games WHERE id = $1', [sessionId]);
      const session = rows[0];
      const runtime = activeSessions.get(String(sessionId));
      if (!session || !runtime || Date.now()-runtime.lastActivity > 5*60*1000) {
        if (session && Date.now()-runtime.lastActivity > 5*60*1000) {
          await query('DELETE FROM games WHERE id=$1',[sessionId]);
          io.to('game:' + sessionId).emit('game:ended');
          activeSessions.delete(String(sessionId));
        }
        clearInterval(interval);
        return;
      }
      if (runtime.status !== 'playing' || !runtime.state) {
        clearInterval(interval);
        return;
      }

      const result = await tickGame(session.type, runtime.state);
      if (result.changed) {
        runtime.state = result.state;
        await broadcastUpdate(io, sessionId, {}, runtime);
      }
    } catch (err) {
      console.error(err);
      clearInterval(interval);
    }
  }, 3000);
}
