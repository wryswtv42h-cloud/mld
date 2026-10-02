import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function initDB() {
  // جدول المستخدمين
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      discord_id TEXT,
      discord_verified BOOLEAN DEFAULT FALSE,
      avatar TEXT,
      bio TEXT DEFAULT '',
      role TEXT DEFAULT 'member',
      is_owner BOOLEAN DEFAULT FALSE,
      banned BOOLEAN DEFAULT FALSE,
      last_seen TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // جدول البوتات
  await query(`
    CREATE TABLE IF NOT EXISTS bots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token TEXT NOT NULL,
      guild_id TEXT,
      avatar TEXT,
      watching TEXT DEFAULT 'MLD | فهد المطيري',
      site_url TEXT DEFAULT '',
      locked BOOLEAN DEFAULT TRUE,
      active BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // جدول الرسائل (الشات + الزاجل)
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id TEXT NOT NULL,
      sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
      sender_name TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'public',
      anonymous BOOLEAN DEFAULT FALSE,
      deleted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // جدول الجلسات (الألعاب)
  await query(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_type TEXT NOT NULL,
      host_id UUID REFERENCES users(id) ON DELETE SET NULL,
      host_name TEXT,
      status TEXT DEFAULT 'waiting',
      players JSONB DEFAULT '[]',
      spectators JSONB DEFAULT '[]',
      state JSONB DEFAULT '{}',
      max_players INT DEFAULT 4,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // فهارس
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bots_user ON bots(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON game_sessions(status);`);

  console.log('✅ الجداول جاهزة');
}
