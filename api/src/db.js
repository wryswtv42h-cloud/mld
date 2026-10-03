import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  family: 4,
  max: 10
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function initDB() {
  // قاعدة البيانات الحالية في Supabase تحتوي الجداول الأساسية بالفعل.
  // لا ننشئ جداول جديدة هنا حتى لا نغيّر أنواع المفاتيح أو العلاقات الموجودة.
  await query(`SELECT 1 FROM users LIMIT 1`);
  await query(`SELECT 1 FROM bots LIMIT 1`);
  await query(`SELECT 1 FROM messages LIMIT 1`);
  await query(`SELECT 1 FROM games LIMIT 1`);

  console.log('✅ تم الاتصال بقاعدة MLD والتحقق من الجداول الحالية');
}
