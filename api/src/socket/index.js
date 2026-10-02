import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Message from '../models/Message.js';

export function setupSocket(io) {
  // ===== التحقق من التوكن =====
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('غير مصرح'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || user.banned) return next(new Error('غير مصرح'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('توكن غير صالح'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🟢 ${socket.user.username} اتصل`);

    // ===== دخول غرفة =====
    socket.on('room:join', (roomId) => {
      socket.join(roomId);
      socket.emit('room:joined', { roomId });
    });

    // ===== خروج من غرفة =====
    socket.on('room:leave', (roomId) => {
      socket.leave(roomId);
    });

    // ===== إرسال رسالة =====
    socket.on('message:send', async (data) => {
      try {
        const { roomId, content, type } = data;

        if (!content || content.trim().length === 0) return;
        if (content.length > 2000) return;

        const msg = await Message.create({
          roomId,
          sender: socket.user._id,
          senderName: socket.user.username,
          content: content.trim(),
          type: type || 'public'
        });

        io.to(roomId).emit('message:new', {
          _id: msg._id,
          roomId,
          sender: socket.user._id,
          senderName: socket.user.username,
          content: msg.content,
          type: msg.type,
          createdAt: msg.createdAt
        });
      } catch (err) {
        console.error('خطأ إرسال:', err);
      }
    });

    // ===== كتابة الآن =====
    socket.on('typing', ({ roomId }) => {
      socket.to(roomId).emit('typing', {
        username: socket.user.username
      });
    });

    // ===== خروج =====
    socket.on('disconnect', () => {
      console.log(`🔴 ${socket.user.username} انقطع`);
    });
  });
}
