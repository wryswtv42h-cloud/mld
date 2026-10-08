import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { setupGameSocket } from './games.js';

export function setupSocket(io) {
  // ===== التحقق =====
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        socket.user = null;
        return next();
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
          `INSERT INTO messages (room_id, sender_id, sender_name, content, type)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
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


    // ===== السينما المشتركة =====
    socket.on('cinema:join', async ({roomId}) => {
      try {
        const {rows}=await query('SELECT * FROM cinema_rooms WHERE id=$1 AND status<>\'closed\'',[roomId]);
        if(!rows[0]) return socket.emit('cinema:error',{error:'الغرفة غير موجودة'});
        socket.join('cinema:'+roomId);
        socket.emit('cinema:state',{roomId,playbackTime:Number(rows[0].playback_time||0),isPlaying:!!rows[0].is_playing});
      } catch { socket.emit('cinema:error',{error:'تعذر الانضمام'}); }
    });
    socket.on('cinema:sync', async ({roomId,type,time}) => {
      if(!socket.user) return;
      try {
        const room=(await query('SELECT * FROM cinema_rooms WHERE id=$1',[roomId])).rows[0];
        if(!room || (String(room.owner_id)!==String(socket.user.id) && !socket.user.is_owner)) return;
        const nextTime=Math.max(0,Number(time)||0);
        const playing=type==='play' ? true : type==='pause' ? false : !!room.is_playing;
        await query('UPDATE cinema_rooms SET playback_time=$1,is_playing=$2,updated_at=NOW() WHERE id=$3',[nextTime,playing,roomId]);
        io.to('cinema:'+roomId).emit('cinema:state',{roomId,playbackTime:nextTime,isPlaying:playing});
      } catch(e){ socket.emit('cinema:error',{error:'تعذر مزامنة العرض'}); }
    });

    // ===== الألعاب =====
    setupGameSocket(io, socket);
  });
}
