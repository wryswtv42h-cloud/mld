import express from 'express';
import { query } from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getGameConfig } from '../games/engine.js';

const router=express.Router();

function normalize(row){
  return {
    id:row.id,name:row.name,type:row.type,game_type:row.type,status:row.status,
    host_id:row.host_id,host_name:row.host_name||null,
    players:Array.isArray(row.players)?row.players:[],
    spectators:Array.isArray(row.spectators)?row.spectators:[],
    state:row.state||null,min_players:Number(row.min_players||2),
    max_players:Number(row.max_players||4),created_at:row.created_at
  };
}

router.get('/sessions',optionalAuth,async(req,res)=>{
  try{
    const {rows}=await query(`SELECT g.*,u.username host_name
      FROM games g LEFT JOIN users u ON u.id=g.host_id
      WHERE g.status IN ('open','waiting','playing')
      ORDER BY g.created_at DESC LIMIT 50`);
    res.json({sessions:rows.map(normalize)});
  }catch(e){console.error('games list',e);res.status(500).json({error:'تعذر تحميل الجلسات'});}
});

router.post('/sessions',requireAuth,async(req,res)=>{
  try{
    const type=String(req.body.game_type||req.body.type||'');
    const cfg=getGameConfig(type);
    if(!cfg)return res.status(400).json({error:'اللعبة غير متاحة'});
    const max=Number(req.body.max_players||cfg.max);
    if(!Number.isInteger(max)||max<cfg.min||max>cfg.max)return res.status(400).json({error:`عدد اللاعبين يجب أن يكون بين ${cfg.min} و${cfg.max}`});
    const hostId=req.user.id;
    const hostName=req.user.username;
    const players=[{name:hostName,userId:hostId,isBot:false,isHost:true}];
    const {rows}=await query(`INSERT INTO games(name,type,status,host_id,players,min_players,max_players,state,spectators)
      VALUES($1,$2,'waiting',$3,$4,$5,$6,NULL,'[]'::jsonb) RETURNING *`,
      [req.body.name||type,type,hostId,JSON.stringify(players),cfg.min,max]);
    res.json({session:normalize(rows[0])});
  }catch(e){console.error('games create',e);res.status(500).json({error:'تعذر إنشاء الجلسة'});}
});

router.get('/sessions/:id',optionalAuth,async(req,res)=>{
  const {rows}=await query(`SELECT g.*,u.username host_name FROM games g LEFT JOIN users u ON u.id=g.host_id WHERE g.id=$1`,[req.params.id]);
  if(!rows[0])return res.status(404).json({error:'الجلسة غير موجودة'});
  res.json({session:normalize(rows[0])});
});

router.delete('/sessions/:id',requireAuth,async(req,res)=>{
  const {rows}=await query('SELECT * FROM games WHERE id=$1',[req.params.id]); const s=rows[0];
  if(!s)return res.status(404).json({error:'الجلسة غير موجودة'});
  if(String(s.host_id||'')!==String(req.user?.id||'')&&!req.user?.is_owner)return res.status(403).json({error:'مالك الجلسة أو الأونر فقط'});
  await query('DELETE FROM games WHERE id=$1',[req.params.id]);
  res.json({message:'تم إنهاء الجلسة'});
});
export default router;