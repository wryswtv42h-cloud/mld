import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { setupGameSocket } from './games.js';

export function setupSocket(io) {
  // ===== التحقق من الاتصال =====
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        socket.user = null;
        return next();
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      const { rows } = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
      socket.user = rows[0] || null;
      next();
    } catch (err) {
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`🟢 اتصال: ${socket.user?.username || 'زائر'} (${socket.id})`);

    // ===== الشات العام =====
    socket.on('room:join', (roomId) => {
      socket.join(roomId);
      socket.emit('room:joined', { roomId });
    });

    socket.on('room:leave', (roomId) => {
      socket.leave(roomId);
    });

    socket.on('message:send', async (data) => {
      try {
        if (!socket.user) {
          return socket.emit('error:auth', { error: 'سجّل دخول للشات' });
        }
        const { roomId, content, type } = data;
        if (!content || content.trim().length === 0) return;
        if (content.length > 2000) return;

        const { rows } = await query(
          `INSERT INTO messages (room_id, sender_id, sender_name, content, type, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
          [roomId, socket.user.id, socket.user.username, content.trim(), type || 'public']
        );

        io.to(roomId).emit('message:new', rows[0]);
      } catch (err) {
        console.error('خطأ إرسال:', err);
      }
    });

    socket.on('typing', ({ roomId }) => {
      if (!socket.user) return;
      socket.to(roomId).emit('typing', { username: socket.user.username });
    });

    socket.on('disconnect', () => {
      console.log(`🔴 قطع: ${socket.user?.username || 'زائر'}`);
    });

    // ===== الألعاب =====
    setupGameSocket(io, socket);
  });
}
