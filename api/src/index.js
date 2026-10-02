import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import chatRoutes from './routes/chat.js';
import { setupSocket } from './socket/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'طلبات كثيرة، حاول لاحقاً' } });
app.use('/api/', limiter);

const io = new Server(httpServer, { cors: { origin: process.env.WEB_URL || '*', credentials: true } });
setupSocket(io);

app.get('/', (req, res) => {
  res.json({ name: 'MLD API', owner: 'MLD', developer: 'فهد المطيري', discord: 'w4px', status: 'online' });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('select 1');
    res.json({ status: 'ok', database: 'postgresql' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'خطأ في السيرفر' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await pool.query('select 1');
    console.log('✅ تم الاتصال بقاعدة PostgreSQL');
    httpServer.listen(PORT, () => {
      console.log(`🚀 MLD API يعمل على المنفذ ${PORT}`);
      console.log('👑 الحقوق: MLD | المطور: فهد المطيري');
    });
  } catch (err) {
    console.error('❌ فشل التشغيل:', err.message);
    process.exit(1);
  }
}

start();

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
