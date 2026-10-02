import jwt from 'jsonwebtoken';
import { findUserById, mapUser, query } from '../db.js';

export function setupSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('غير مصرح'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const row = await findUserById(decoded.id);
      if (!row || row.banned) return next(new Error('غير مصرح'));
      socket.user = mapUser(row);
      next();
    } catch {
      next(new Error('توكن غير صالح'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🟢 ${socket.user.username} اتصل`);

    socket.on('room:join', (roomId) => {
      socket.join(roomId);
      socket.emit('room:joined', { roomId });
    });

    socket.on('room:leave', (roomId) => socket.leave(roomId));

    socket.on('message:send', async (data) => {
      try {
        const { roomId, content, type } = data;
        if (!roomId || !content || content.trim().length === 0 || content.length > 2000) return;

        const result = await query(`insert into public.messages
          (room_id, sender_id, sender_name, content, type)
          values ($1,$2,$3,$4,$5)
          returning id, room_id, sender_id, sender_name, content, type, created_at`,
          [roomId, socket.user.id, socket.user.username, content.trim(), type || 'public']);

        const msg = result.rows[0];
        io.to(roomId).emit('message:new', {
          _id: msg.id, id: msg.id, roomId: msg.room_id, sender: msg.sender_id,
          senderName: msg.sender_name, content: msg.content, type: msg.type, createdAt: msg.created_at
        });
      } catch (err) {
        console.error('خطأ إرسال:', err);
      }
    });

    socket.on('typing', ({ roomId }) => {
      socket.to(roomId).emit('typing', { username: socket.user.username });
    });

    socket.on('disconnect', () => console.log(`🔴 ${socket.user.username} انقطع`));
  });
}
