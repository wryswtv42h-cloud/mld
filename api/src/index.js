import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { Server } from 'socket.io';
import { initDB, query } from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import discordRoutes from './routes/discord.js';
import botRoutes from './routes/bots.js';
import platformRoutes from './routes/platform.js';
dotenv.config();

if(!process.env.DATABASE_URL||!(process.env.JWT_SECRET||process.env.OWNER_PASSWORD)){console.error('❌ DATABASE_URL أو مفتاح التوقيع ناقص');process.exit(1);}
const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:process.env.WEB_URL||'*',methods:['GET','POST']}});
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(cors({origin:process.env.WEB_URL||'*',credentials:true}));
app.use(express.json({limit:'10mb'}));
app.use('/api/',rateLimit({windowMs:15*60*1000,max:500}));
app.get('/',(req,res)=>res.json({name:'MLD API',owner:'MLD',developer:'فهد المطيري',discord:'w4px',status:'online'}));
app.get('/health',(req,res)=>res.json({ok:true,status:'online'}));
app.use('/api/auth',authRoutes);app.use('/api/users',userRoutes);app.use('/api/discord',discordRoutes);app.use('/api/bots',botRoutes);app.use('/api/platform',platformRoutes);
io.on('connection',socket=>{
  socket.on('join-chat',()=>socket.join('public-chat'));
  socket.on('chat-message',async data=>{
    try{
      const token=String(data?.token||''); if(!token)return;
      const jwt=await import('jsonwebtoken'); const secret=process.env.JWT_SECRET||process.env.OWNER_PASSWORD;
      const decoded=jwt.default.verify(token,secret);
      const r=await query('SELECT id,username,avatar,banned FROM users WHERE id=$1',[decoded.id]); const u=r.rows[0];
      const content=String(data?.content||'').trim(); if(!u||u.banned||!content)return;
      const saved=await query('INSERT INTO chat_messages(user_id,sender_name,sender_avatar,content) VALUES($1,$2,$3,$4) RETURNING *',[u.id,u.username,u.avatar,content.slice(0,1000)]);
      io.to('public-chat').emit('chat-message',saved.rows[0]);
    }catch{}
  });
});
app.use((err,req,res,next)=>{console.error(err);res.status(err.status||500).json({error:err.message||'خطأ'});});
const PORT=process.env.PORT||3000;
async function start(){try{await initDB();server.listen(PORT,()=>console.log(`🚀 MLD API على ${PORT}`));}catch(err){console.error('❌ فشل:',err.message);process.exit(1);}}
start();