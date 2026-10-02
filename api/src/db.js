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

  console.log('✅ الجداول جاهزة');
}
