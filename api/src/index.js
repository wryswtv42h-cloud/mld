import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import chatRoutes from './routes/chat.js';
import { setupSocket } from './socket/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// ===== الأمان =====
app.use(helmet());
app.use(cors({
  origin: process.env.WEB_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ===== حد الطلبات =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'طلبات كثيرة، حاول لاحقاً' }
});
app.use('/api/', limiter);

// ===== Socket.IO =====
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_URL || '*',
    credentials: true
  }
});
setupSocket(io);

// ===== المسارات =====
app.get('/', (req, res) => {
  res.json({
    name: 'MLD API',
    owner: 'MLD',
    developer: 'فهد المطيري',
    discord: 'w4px',
    status: 'online'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// ===== معالج الأخطاء =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'خطأ في السيرفر'
  });
});

// ===== تشغيل =====
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    httpServer.listen(PORT, () => {
      console.log(`🚀 MLD API يعمل على المنفذ ${PORT}`);
      console.log(`👑 الحقوق: MLD | المطور: فهد المطيري`);
    });
  } catch (err) {
    console.error('❌ فشل التشغيل:', err.message);
    process.exit(1);
  }
}

start();
