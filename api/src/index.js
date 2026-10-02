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
import { setupSocket } from './socket/index.js';

dotenv.config();

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('❌ DATABASE_URL أو JWT_SECRET ناقص');
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.WEB_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

const io = new Server(httpServer, {
  cors: { origin: process.env.WEB_URL || '*', credentials: true }
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

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/public', publicRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'خطأ' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDB();
    httpServer.listen(PORT, () => {
      console.log(`🚀 MLD API على ${PORT}`);
      console.log(`👑 MLD | فهد المطيري`);
    });
  } catch (err) {
    console.error('❌ فشل:', err.message);
    process.exit(1);
  }
}

start();
