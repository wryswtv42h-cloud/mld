import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import botRoutes from './routes/bots.js';
import gameRoutes from './routes/games.js';
import publicRoutes from './routes/public.js';
import communityRoutes from './routes/community.js';
import { setupSocket } from './socket/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.WEB_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true
};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

const io = new Server(httpServer, {
  cors: { origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  }, credentials: true }
});
setupSocket(io);

app.get('/', (req, res) => {
  res.json({
    name: 'MLD API',
    owner: 'MLD',
    developer: 'فهد المطيري',
    discord: 'w4px',
    status: 'online'
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mld-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/community', communityRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'خطأ' });
});

const PORT = Number(process.env.PORT || 3000);

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️ JWT_SECRET غير موجود، سيتم استخدام قيمة افتراضية للتطوير فقط');
      process.env.JWT_SECRET = 'dev-secret';
    }

    await initDB();
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 MLD API على ${PORT}`);
      console.log('👑 MLD | فهد المطيري');
    });
  } catch (err) {
    console.error('❌ فشل تشغيل السيرفر:', err.message);
    process.exit(1);
  }
}

start();
