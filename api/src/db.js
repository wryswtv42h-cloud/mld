import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
  family: 4,
  max: 10
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function initDB() {
  try {
    const requiredTables = ['users', 'bots', 'messages', 'games', 'reviews', 'discord_stats'];
    const { rows } = await query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredTables]
    );

    const found = new Set(rows.map((row) => row.table_name));
    const missing = requiredTables.filter((name) => !found.has(name));

    if (missing.length) {
      console.warn(`⚠️ الجداول التالية غير موجودة في قاعدة البيانات: ${missing.join(', ')}`);
    }

    await query('SELECT 1');
    console.log('✅ تم الاتصال بقاعدة MLD والتحقق من الجداول الحالية');
  } catch (error) {
    console.error('❌ فشل توصيل قاعدة البيانات:', error.message);
    throw error;
  }
}
