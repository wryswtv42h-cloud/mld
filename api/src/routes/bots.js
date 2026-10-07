import crypto from 'crypto';
import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.get('/stats', requireAuth, async (req,res)=>{
  try{
    const { rows } = await query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active = TRUE)::int AS active FROM bots");
    res.json(rows[0] || {total:0,active:0});
  }catch(e){ console.error('bot stats:',e); res.status(500).json({error:'تعذر تحميل إحصائيات البوتات'}); }
});
router.get('/:id/logs', requireAuth, async (req,res)=>{
  try{
    const { rows } = await query("SELECT id, name, active, locked, created_at FROM bots WHERE id=$1 AND user_id=$2", [req.params.id,req.user.id]);
    if(!rows[0]) return res.status(404).json({error:'البوت غير موجود'});
    res.json({logs:[]});
  }catch(e){ console.error('bot logs:',e); res.status(500).json({error:'تعذر تحميل السجل'}); }
});
const KEY = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'mld').digest();
function encryptToken(value){const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',KEY,iv);const enc=Buffer.concat([c.update(value,'utf8'),c.final()]);return 'enc:'+iv.toString('base64url')+':'+c.getAuthTag().toString('base64url')+':'+enc.toString('base64url');}

// ===== قائمة البوتات العامة (بدون توكنات) =====
router.get('/public', async (req,res) => {
  try {
    const { rows } = await query("SELECT id,name,guild_id,avatar,watching,site_url,locked,active,created_at FROM bots ORDER BY created_at DESC");
    res.json({ bots: rows });
  } catch (e) {
    console.error('public bots:', e);
    res.status(500).json({ error: 'تعذر تحميل البوتات' });
  }
});

// ===== قائمة بوتاتي =====
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const bots = rows.map(({ token, ...b }) => b);
  res.json({ bots });
});

// ===== إضافة بوت جديد =====
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, token, guild_id } = req.body;
    if (!name || !token) {
      return res.status(400).json({ error: 'أدخل الاسم والتوكن' });
    }

    const check = await fetch('https://discord.com/api/v10/users/@me', {headers:{Authorization:'Bot '+token}});
    if(!check.ok) return res.status(400).json({error:'توكن البوت غير صالح'});
    const botInfo = await check.json();
    if(guild_id){
      const memberCheck = await fetch('https://discord.com/api/v10/guilds/'+encodeURIComponent(guild_id)+'/members/'+encodeURIComponent(botInfo.id), {headers:{Authorization:'Bot '+token}});
      if(!memberCheck.ok) return res.status(400).json({error:'البوت غير موجود في السيرفر المحدد'});
    }
    const avatar = botInfo.avatar ? 'https://cdn.discordapp.com/avatars/'+botInfo.id+'/'+botInfo.avatar+'.png?size=128' : '/logo.svg';
    const { rows } = await query(
      `INSERT INTO bots (user_id, name, token, guild_id, avatar, watching, site_url, locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING *`,
      [req.user.id, name, encryptToken(token), guild_id || null, avatar, 'MLD | فهد المطيري', '']
    );

    const { token: _, ...bot } = rows[0];
    res.json({ bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== تعديل بوت =====
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { name, guild_id } = req.body;
    const { rows } = await query('SELECT * FROM bots WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'البوت غير موجود' });

    if (name !== undefined) {
      await query('UPDATE bots SET name = $1 WHERE id = $2', [name, req.params.id]);
    }
    if (guild_id !== undefined) {
      await query('UPDATE bots SET guild_id = $1 WHERE id = $2', [guild_id, req.params.id]);
    }

    const updated = await query('SELECT * FROM bots WHERE id = $1', [req.params.id]);
    const { token, ...bot } = updated.rows[0];
    res.json({ bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== حذف بوت =====
router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM bots WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id
  ]);
  res.json({ message: 'تم الحذف' });
});

// ===== تشغيل / إيقاف =====
router.post('/:id/toggle', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM bots WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'البوت غير موجود' });

  await query('UPDATE bots SET active = NOT active WHERE id = $1', [req.params.id]);
  res.json({ message: rows[0].active ? 'تم الإيقاف' : 'تم التشغيل' });
});


export default router;
