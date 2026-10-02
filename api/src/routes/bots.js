import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const router=express.Router();
router.get('/',requireAuth,async(req,res)=>{const {rows}=await query('SELECT * FROM bots WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id]);res.json({bots:rows.map(({token,...b})=>b)});});
router.post('/',requireAuth,async(req,res)=>{const {name,token,guild_id}=req.body;if(!name||!token)return res.status(400).json({error:'أدخل اسم البوت والتوكن'});const {rows}=await query('INSERT INTO bots(user_id,name,token,guild_id) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,name,token,guild_id||null]);const {token:_,...bot}=rows[0];res.json({bot});});
router.patch('/:id',requireAuth,async(req,res)=>{const {rows}=await query('SELECT * FROM bots WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);if(!rows[0])return res.status(404).json({error:'البوت غير موجود'});const allowed=['name','guild_id','avatar','active'];const sets=[],params=[];for(const k of allowed){if(req.body[k]!==undefined){params.push(req.body[k]);sets.push(k+'=$'+params.length)}}if(!sets.length)return res.json({ok:true});params.push(req.params.id,req.user.id);await query('UPDATE bots SET '+sets.join(',')+' WHERE id=$'+(params.length-1)+' AND user_id=$'+params.length,params);res.json({ok:true});});
router.delete('/:id',requireAuth,async(req,res)=>{await query('DELETE FROM bots WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);res.json({ok:true});});
export default router;
