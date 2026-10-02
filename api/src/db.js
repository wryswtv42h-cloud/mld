import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL غير موجود في متغيرات البيئة');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', err => console.error('❌ خطأ في اتصال PostgreSQL:', err));

export async function query(text, params = []) { return pool.query(text, params); }

export function mapUser(row) {
  if (!row) return null;
  return {
    _id: row.id, id: row.id, username: row.username, password: row.password,
    discordId: row.discord_id, discordVerified: row.discord_verified,
    verificationCode: row.verification_code, avatar: row.avatar, bio: row.bio,
    role: row.role, isOwner: row.is_owner, banned: row.banned,
    lastSeen: row.last_seen, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export function publicUser(row) {
  const user = mapUser(row);
  if (!user) return null;
  delete user.password;
  delete user.verificationCode;
  return user;
}

export async function findUserById(id) {
  const result = await query('select * from public.users where id = $1 limit 1', [id]);
  return result.rows[0] || null;
}

export async function findUserByUsername(username) {
  const result = await query('select * from public.users where username = $1 limit 1', [username]);
  return result.rows[0] || null;
}

export async function createUser({username,password,discordId=null,discordVerified=false,verificationCode=null,avatar=null,bio='',role='member',isOwner=false,banned=false}) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await query(`insert into public.users
    (username,password,discord_id,discord_verified,verification_code,avatar,bio,role,is_owner,banned)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [username,hashedPassword,discordId,discordVerified,verificationCode,avatar,bio,role,isOwner,banned]);
  return result.rows[0];
}

export async function updateUser(id, fields) {
  const allowed = {username:'username',avatar:'avatar',bio:'bio',role:'role',isOwner:'is_owner',
    banned:'banned',discordId:'discord_id',discordVerified:'discord_verified',
    verificationCode:'verification_code',lastSeen:'last_seen'};
  const entries = Object.entries(fields).filter(([key,value]) => allowed[key] && value !== undefined);
  if (!entries.length) return findUserById(id);
  const values=[];
  const sets=entries.map(([key,value],i)=>{values.push(value);return `${allowed[key]} = $${i+1}`;});
  values.push(id);
  const result=await query(`update public.users set ${sets.join(', ')}, updated_at=now()
    where id=$${values.length} returning *`,values);
  return result.rows[0] || null;
}

export async function comparePassword(candidate,hash){ return bcrypt.compare(candidate,hash); }
export async function deleteUser(id){ return query('delete from public.users where id=$1',[id]); }
