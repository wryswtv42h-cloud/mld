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

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('❌ DATABASE_URL أو JWT_SECRET ناقص');
  process.exit(1);
}

const app = express();
// Railway sits behind a trusted reverse proxy; allow Express rate-limit to use X-Forwarded-For safely.
app.set('trust proxy', 1);
const httpServer = createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.WEB_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

const io = new Server(httpServer, {
  cors: { origin: process.env.WEB_URL || '*', credentials: true }
});
setupSocket(io);

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mld-api', status: 'online', time: new Date().toISOString() });
});

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
app.use('/api/bots', botRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/community', communityRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'خطأ' });
});

const PORT = process.env.PORT || 3000;
let dbReady = false;

httpServer.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 MLD API على ${PORT}`);
  console.log(`👑 MLD | فهد المطيري`);
  try {
    await initDB();
    dbReady = true;
    console.log('✅ قاعدة البيانات جاهزة');
  } catch (err) {
    console.error('❌ فشل اتصال قاعدة البيانات:', err.message);
  }
  // Railway health probing can use the conventional 8080 port even when the public service port is configured separately.
  if (Number(PORT) !== 8080) {
    app.listen(8080, '0.0.0.0', () => console.log('🩺 MLD API health على 8080'));
  }
});

app.use('/api/', (req, res, next) => {
  if (!dbReady && req.path !== '/public/server' && req.path !== '/public/members' && req.path !== '/public/roles') {
    return res.status(503).json({ error: 'الخدمة ما زالت تجهز قاعدة البيانات، حاول بعد لحظات' });
  }
  next();
});
