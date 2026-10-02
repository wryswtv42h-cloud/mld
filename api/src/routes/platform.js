import express from 'express';
import { query } from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router=express.Router();
const ownerOnly=(req,res,next)=>req.user?.is_owner?next():res.status(403).json({error:'للأونر فقط'});
const staff=(req,res,next)=>['owner','admin'].includes(req.user?.role)||req.user?.is_owner?next():res.status(403).json({error:'للإدارة فقط'});
async function log(req,action,target='',meta={}){await query('INSERT INTO audit_logs(actor_id,actor_name,action,target,meta) VALUES($1,$2,$3,$4,$5)',[req.user?.id,req.user?.username,action,target,meta]);}

router.get('/stats',async(req,res)=>{const [u,b,g]=await Promise.all([query('SELECT count(*)::int n FROM users WHERE banned=false'),query('SELECT count(*)::int n FROM bots'),query('SELECT count(*)::int n FROM games')]);res.json({members:u.rows[0].n,bots:b.rows[0].n,games:g.rows[0].n,servers:0});});
router.get('/members',async(req,res)=>{const q=String(req.query.q||'').trim();const r=await query('SELECT id,username,avatar,bio,role,is_owner,last_seen,created_at FROM users WHERE banned=false AND username ILIKE $1 ORDER BY last_seen DESC LIMIT 100',['%'+q+'%']);res.json({users:r.rows});});
router.get('/top',async(req,res)=>{const chat=await query(`SELECT sender_name name,count(*)::int score FROM chat_messages GROUP BY sender_name ORDER BY score DESC LIMIT 10`);res.json({chat:chat.rows,voice:[],games:[]});});
router.get('/leaders',async(req,res)=>{const r=await query("SELECT id,username,avatar,role,is_owner FROM users WHERE is_owner=true OR role IN ('admin','founder','coowner','staff','junior_staff') ORDER BY is_owner DESC, role, username");res.json({users:r.rows});});

router.get('/chat',async(req,res)=>{const r=await query('SELECT id,user_id,sender_name,sender_avatar,content,created_at FROM chat_messages ORDER BY id DESC LIMIT 100');res.json({messages:r.rows.reverse()});});
router.post('/chat',requireAuth,async(req,res)=>{const content=String(req.body.content||'').trim();if(!content||content.length>1000)return res.status(400).json({error:'رسالة غير صالحة'});const r=await query('INSERT INTO chat_messages(user_id,sender_name,sender_avatar,content) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,req.user.username,req.user.avatar,content]);await log(req,'chat_message');res.json({message:r.rows[0]});});

router.get('/reviews',async(req,res)=>{const r=await query('SELECT * FROM reviews ORDER BY id DESC LIMIT 30');res.json({reviews:r.rows});});
router.post('/reviews',requireAuth,async(req,res)=>{const content=String(req.body.content||'').trim();if(!content)return res.status(400).json({error:'اكتب رأيك'});const r=await query('INSERT INTO reviews(user_id,username,content,rating) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,req.user.username,content,Math.min(5,Math.max(1,Number(req.body.rating)||5))]);res.json({review:r.rows[0]});});
router.delete('/reviews/:id',requireAuth,ownerOnly,async(req,res)=>{await query('DELETE FROM reviews WHERE id=$1',[req.params.id]);await log(req,'delete_review',req.params.id);res.json({ok:true});});

router.get('/pigeon',requireAuth,async(req,res)=>{const r=await query(`SELECT p.*,u.username recipient_name FROM pigeon_messages p LEFT JOIN users u ON u.id=p.recipient_id WHERE p.sender_id=$1 OR p.recipient_id=$1 ORDER BY p.id DESC LIMIT 100`,[req.user.id]);res.json({messages:r.rows});});
router.post('/pigeon',requireAuth,async(req,res)=>{const recipient=Number(req.body.recipient_id);const content=String(req.body.content||'').trim();if(!recipient||!content)return res.status(400).json({error:'أكمل البيانات'});const r=await query('INSERT INTO pigeon_messages(sender_id,recipient_id,content,anonymous) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,recipient,content,!!req.body.anonymous]);res.json({message:r.rows[0]});});

router.get('/tickets',requireAuth,async(req,res)=>{const r=await query(`SELECT t.*,u.username FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.user_id=$1 OR $2=true ORDER BY t.id DESC`,[req.user.id,req.user.is_owner||req.user.role==='admin']);res.json({tickets:r.rows});});
router.post('/tickets',requireAuth,async(req,res)=>{const subject=String(req.body.subject||'').trim(),content=String(req.body.content||'').trim();if(!subject||!content)return res.status(400).json({error:'أكمل بيانات التذكرة'});const r=await query('INSERT INTO tickets(user_id,subject,content) VALUES($1,$2,$3) RETURNING *',[req.user.id,subject,content]);await query('INSERT INTO ticket_messages(ticket_id,user_id,sender_name,content) VALUES($1,$2,$3,$4)',[r.rows[0].id,req.user.id,req.user.username,content]);await log(req,'create_ticket',String(r.rows[0].id));res.json({ticket:r.rows[0]});});
router.patch('/tickets/:id',requireAuth,staff,async(req,res)=>{const status=req.body.status||'open';await query('UPDATE tickets SET status=$1,claimed_by=COALESCE($2,claimed_by),closed_at=CASE WHEN $1=\'closed\' THEN NOW() ELSE NULL END WHERE id=$3',[status,req.user.id,req.params.id]);await log(req,'ticket_update',req.params.id,{status});res.json({ok:true});});

router.get('/applications',requireAuth,ownerOnly,async(req,res)=>{const r=await query(`SELECT a.*,u.username FROM applications a JOIN users u ON u.id=a.user_id ORDER BY a.id DESC`);res.json({applications:r.rows});});
router.post('/applications',requireAuth,async(req,res)=>{const r=await query('INSERT INTO applications(user_id,discord_id,answers) VALUES($1,$2,$3) RETURNING *',[req.user.id,req.body.discord_id||req.user.discord_id,req.body.answers||{}]);await log(req,'application',String(r.rows[0].id));res.json({application:r.rows[0]});});
router.patch('/applications/:id',requireAuth,ownerOnly,async(req,res)=>{await query('UPDATE applications SET status=$1 WHERE id=$2',[req.body.status,req.params.id]);await log(req,'application_update',req.params.id,{status:req.body.status});res.json({ok:true});});

router.get('/groups',async(req,res)=>{const r=await query(`SELECT g.*,u.username owner_name FROM groups g JOIN users u ON u.id=g.owner_id ORDER BY g.id DESC`);res.json({groups:r.rows});});
router.post('/groups',requireAuth,async(req,res)=>{const name=String(req.body.name||'').trim();if(!name)return res.status(400).json({error:'اسم القروب مطلوب'});const r=await query('INSERT INTO groups(owner_id,name,description) VALUES($1,$2,$3) RETURNING *',[req.user.id,name,req.body.description||'']);await log(req,'group_create',String(r.rows[0].id));res.json({group:r.rows[0]});});
router.post('/groups/:id/join',requireAuth,async(req,res)=>{await query('INSERT INTO group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.user.id]);res.json({ok:true});});
router.patch('/groups/:id',requireAuth,ownerOnly,async(req,res)=>{await query('UPDATE groups SET status=$1 WHERE id=$2',[req.body.status,req.params.id]);res.json({ok:true});});

router.get('/games',async(req,res)=>{const r=await query('SELECT * FROM games ORDER BY id DESC LIMIT 50');res.json({games:r.rows});});
router.post('/games',requireAuth,async(req,res)=>{const r=await query('INSERT INTO games(name,type,host_id,players) VALUES($1,$2,$3,$4) RETURNING *',[req.body.name||'غرفة جديدة',req.body.type||'room',req.user.id,JSON.stringify([{id:req.user.id,name:req.user.username}])]);res.json({game:r.rows[0]});});
router.post('/games/:id/join',requireAuth,async(req,res)=>{const r=await query('SELECT * FROM games WHERE id=$1',[req.params.id]);if(!r.rows[0])return res.status(404).json({error:'الغرفة غير موجودة'});const players=r.rows[0].players||[];if(!players.some(p=>String(p.id)===String(req.user.id)))players.push({id:req.user.id,name:req.user.username});await query('UPDATE games SET players=$1 WHERE id=$2',[JSON.stringify(players),req.params.id]);res.json({players});});
router.post('/games/:id/leave',requireAuth,async(req,res)=>{const r=await query('SELECT players FROM games WHERE id=$1',[req.params.id]);const players=(r.rows[0]?.players||[]).filter(p=>String(p.id)!==String(req.user.id));await query('UPDATE games SET players=$1 WHERE id=$2',[JSON.stringify(players),req.params.id]);res.json({ok:true});});

router.get('/cinema',async(req,res)=>{const r=await query('SELECT c.*,u.username owner_name FROM cinema_rooms c JOIN users u ON u.id=c.owner_id ORDER BY c.id DESC');res.json({rooms:r.rows});});
router.post('/cinema',requireAuth,async(req,res)=>{const r=await query('INSERT INTO cinema_rooms(owner_id,title,media_url) VALUES($1,$2,$3) RETURNING *',[req.user.id,req.body.title||'جلسة MLD',req.body.media_url||null]);res.json({room:r.rows[0]});});

router.get('/logs',requireAuth,ownerOnly,async(req,res)=>{const r=await query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300');res.json({logs:r.rows});});
router.patch('/users/:id/role',requireAuth,ownerOnly,async(req,res)=>{if(Number(req.params.id)===Number(req.user.id))return res.status(400).json({error:'لا تغير صلاحية الأونر'});const role=req.body.role||'member';await query('UPDATE users SET role=$1,is_owner=false WHERE id=$2',[role,req.params.id]);await log(req,'role_change',req.params.id,{role});res.json({ok:true});});
router.delete('/users/:id',requireAuth,ownerOnly,async(req,res)=>{if(Number(req.params.id)===Number(req.user.id))return res.status(400).json({error:'لا تحذف نفسك'});await query('DELETE FROM users WHERE id=$1',[req.params.id]);await log(req,'delete_user',req.params.id);res.json({ok:true});});

export default router;