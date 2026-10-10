import express from 'express';
import { query } from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// ===== قائمة الأعضاء =====
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, username, avatar, bio, occupation, role, is_owner, discord_verified, last_seen
     FROM users ORDER BY last_seen DESC LIMIT 100`
  );
  res.json({ users: rows });
});

// ===== بروفايلي =====
router.get('/me', requireAuth, (req, res) => {
  const { password, ...user } = req.user;
  res.json({ user });
});

// ===== تعديل بروفايلي =====
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { avatar, bio, username, occupation } = req.body;
    if (username !== undefined && (!/^[\\p{L}\\p{N}_. -]{2,32}$/u.test(String(username).trim()))) return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون من 2 إلى 32 حرفًا' });
    if (bio !== undefined && String(bio).length > 500) return res.status(400).json({ error: 'النبذة لا تتجاوز 500 حرف' });
    if (occupation !== undefined && String(occupation).length > 80) return res.status(400).json({ error: 'المهنة لا تتجاوز 80 حرفًا' });
    if (avatar !== undefined && String(avatar).length > 1000) return res.status(400).json({ error: 'رابط الصورة طويل جدًا' });

    if (username && username !== req.user.username) {
      const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (exists.rows[0]) return res.status(400).json({ error: 'الاسم مستخدم' });
      await query('UPDATE users SET username = $1 WHERE id = $2', [username, req.user.id]);
    }
    if (avatar !== undefined) {
      await query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, req.user.id]);
    }
    if (bio !== undefined) {
      await query('UPDATE users SET bio = $1 WHERE id = $2', [bio, req.user.id]);
    }
    if (occupation !== undefined) {
      await query('UPDATE users SET occupation = $1 WHERE id = $2', [String(occupation).trim().slice(0,80), req.user.id]);
    }

    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const { password, ...user } = rows[0];
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في السيرفر' });
  }
});

// ===== حظر / فك حظر (أونر فقط) =====
router.post('/:id/admin', requireAuth, requireOwner, async (req,res)=>{
  const action=String(req.body.action||'add');
  if(!['add','remove'].includes(action))return res.status(400).json({error:'إجراء غير صحيح'});
  const q=await query('SELECT * FROM users WHERE id=$1',[req.params.id]); const u=q.rows[0];
  if(!u || u.is_owner)return res.status(400).json({error:'الحساب غير متاح'});
  await query("UPDATE users SET role=$1 WHERE id=$2",[action==='add'?'admin':'member',u.id]);
  await query('INSERT INTO audit_logs(actor_id,actor_name,action,target,meta) VALUES($1,$2,$3,$4,$5)',[req.user.id,req.user.username,'admin_'+action,String(u.id),JSON.stringify({username:u.username})]);
  res.json({message:action==='add'?'تمت إضافة الإدارة':'تمت إزالة الإدارة'});
});

router.post('/:id/ban', requireAuth, requireOwner, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'غير موجود' });
  if (user.is_owner) return res.status(400).json({ error: 'لا تحظر الأونر' });

  await query('UPDATE users SET banned = NOT banned WHERE id = $1', [user.id]);
  res.json({ message: user.banned ? 'تم فك الحظر' : 'تم الحظر' });
});

// ===== حذف حساب (أونر فقط) =====
router.delete('/:id', requireAuth, requireOwner, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'لا تحذف نفسك' });
  }
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ message: 'تم الحذف' });
});

// ===== إدارة حسابات الأونر =====
router.get('/:id/private', requireAuth, requireOwner, async (req,res)=>{
  const u=await query('SELECT id,username,avatar,bio,role,is_owner,discord_id FROM users WHERE id=$1',[req.params.id]);
  if(!u.rows[0])return res.status(404).json({error:'الحساب غير موجود'});
  const m=await query('SELECT id,sender_id,recipient_id,content,anonymous,delivered,created_at FROM secret_messages WHERE sender_id::text=$1::text OR recipient_id::text=$1::text ORDER BY created_at DESC LIMIT 500',[req.params.id]);
  res.json({user:u.rows[0],messages:m.rows.reverse()});
});
router.patch('/:id', requireAuth, requireOwner, async (req,res)=>{
  if(String(req.params.id)===String(req.user.id))return res.status(400).json({error:'استخدم تعديل بروفايلك الشخصي'});
  const q=await query('SELECT * FROM users WHERE id=$1',[req.params.id]); const u=q.rows[0];
  if(!u)return res.status(404).json({error:'الحساب غير موجود'});
  const username=req.body.username!==undefined?String(req.body.username).trim():u.username;
  const avatar=req.body.avatar!==undefined?String(req.body.avatar):u.avatar;
  const bio=req.body.bio!==undefined?String(req.body.bio):u.bio;
  if(!username)return res.status(400).json({error:'اسم المستخدم مطلوب'});
  if(username!==u.username){const e=await query('SELECT id FROM users WHERE username=$1 AND id<>$2',[username,u.id]);if(e.rows[0])return res.status(400).json({error:'الاسم مستخدم'});}
  const r=await query('UPDATE users SET username=$1,avatar=$2,bio=$3,updated_at=NOW() WHERE id=$4 RETURNING id,username,avatar,bio,role,is_owner,discord_id,banned',[username,avatar,bio,u.id]);
  await query('INSERT INTO audit_logs(actor_id,actor_name,action,target,meta) VALUES($1,$2,$3,$4,$5)',[req.user.id,req.user.username,'account_updated',String(u.id),JSON.stringify({username,avatar})]);
  res.json({user:r.rows[0]});
});

export default router;
