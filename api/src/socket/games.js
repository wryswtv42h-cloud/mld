import { query } from '../db.js';
import { initGame, handleAction, tickGame, getGameConfig } from '../games/engine.js';
const room=id=>'game:'+id; const safeJson=v=>Array.isArray(v)?v:[];
export function setupGameSocket(io,socket){
 socket.on('game:join',async({sessionId,asSpectator=false}={})=>{try{
  const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const session=rows[0];if(!session)return socket.emit('game:error',{error:'الجلسة غير موجودة'});
  const name=socket.user?.username||socket.handshake.auth?.guestName||'زائر';
  const player={name,userId:socket.user?.id||null,isBot:false,socketId:socket.id};
  let players=safeJson(session.players),spectators=safeJson(session.spectators);players=players.filter(p=>p.socketId!==socket.id);spectators=spectators.filter(p=>p.socketId!==socket.id);
  if(asSpectator||players.length>=Number(session.max_players||4))spectators.push(player);else players.push(player);
  await query('UPDATE games SET players=$1,spectators=$2 WHERE id=$3',[JSON.stringify(players),JSON.stringify(spectators),sessionId]);
  socket.join(room(sessionId));io.to(room(sessionId)).emit('game:update',{sessionId,players,spectators,state:session.state,status:session.status,gameType:session.type});
 }catch(e){console.error('game join',e);socket.emit('game:error',{error:'تعذر الانضمام للجلسة'})}});
 socket.on('game:start',async({sessionId}={})=>{try{
  const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const s=rows[0];if(!s)return;
  const name=socket.user?.username||socket.handshake.auth?.guestName||'زائر';
  const host=s.players?.[0]?.name||name;const isHost=(String(s.host_id||'')===String(socket.user?.id||'')&&!(!socket.user?.id))||(!s.host_id&&host===name);
  if(!isHost&&!socket.user?.is_owner)return socket.emit('game:error',{error:'صاحب الجلسة أو الأونر فقط'});
  const cfg=getGameConfig(s.type);if(!cfg)return socket.emit('game:error',{error:'اللعبة غير مدعومة'});
  const state=await initGame(s.type,s.players||[]);await query('UPDATE games SET state=$1,status=$2 WHERE id=$3',[JSON.stringify(state),'playing',sessionId]);
  io.to(room(sessionId)).emit('game:update',{sessionId,players:s.players||[],spectators:s.spectators||[],state,status:'playing',gameType:s.type});startBotLoop(io,sessionId);
 }catch(e){console.error('game start',e);socket.emit('game:error',{error:e.message||'تعذر بدء اللعبة'})}});
 socket.on('game:action',async({sessionId,action}={})=>{try{
  const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const s=rows[0];if(!s||s.status!=='playing'||!s.state)return;
  const name=socket.user?.username||socket.handshake.auth?.guestName||'زائر';if(!name)return socket.emit('game:error',{error:'تعذر تحديد اللاعب'});
  const next=await handleAction(s.type,s.state,name,action);const status=next.finished?'finished':'playing';
  await query('UPDATE games SET state=$1,status=$2 WHERE id=$3',[JSON.stringify(next),status,sessionId]);io.to(room(sessionId)).emit('game:update',{sessionId,players:s.players||[],spectators:s.spectators||[],state:next,status,gameType:s.type});if(next.finished)io.to(room(sessionId)).emit('game:finished',{winner:next.winner});
 }catch(e){console.error('game action',e);socket.emit('game:error',{error:'الحركة غير صالحة'})}});
 socket.on('game:chat',({sessionId,message}={})=>{const text=String(message||'').trim().slice(0,500);if(!text)return;io.to(room(sessionId)).emit('game:chat',{name:socket.user?.username||socket.handshake.auth?.guestName||'زائر',message:text,time:Date.now()})});
 socket.on('game:leave',async({sessionId}={})=>{try{const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const s=rows[0];if(!s)return;const players=safeJson(s.players).filter(p=>p.socketId!==socket.id),spectators=safeJson(s.spectators).filter(p=>p.socketId!==socket.id);await query('UPDATE games SET players=$1,spectators=$2 WHERE id=$3',[JSON.stringify(players),JSON.stringify(spectators),sessionId]);socket.leave(room(sessionId));io.to(room(sessionId)).emit('game:update',{sessionId,players,spectators,state:s.state,status:s.status,gameType:s.type})}catch(e){console.error('game leave',e)}});
 socket.on('game:end',async({sessionId}={})=>{try{const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const s=rows[0];if(!s)return;const host=String(s.host_id||'')===String(socket.user?.id||'');if(!host&&!socket.user?.is_owner)return;await query('DELETE FROM games WHERE id=$1',[sessionId]);io.to(room(sessionId)).emit('game:ended')}catch(e){console.error('game end',e)}});
}
const loops=new Map();
function startBotLoop(io,id){if(loops.has(id))return;const interval=setInterval(async()=>{try{const {rows}=await query('SELECT * FROM games WHERE id=$1',[id]);const s=rows[0];if(!s||s.status!=='playing'||!s.state){clearInterval(interval);loops.delete(id);return}const result=await tickGame(s.type,s.state);if(result.changed){const status=result.state.finished?'finished':'playing';await query('UPDATE games SET state=$1,status=$2 WHERE id=$3',[JSON.stringify(result.state),status,id]);io.to(room(id)).emit('game:update',{sessionId:id,players:s.players||[],spectators:s.spectators||[],state:result.state,status,gameType:s.type});if(result.state.finished){io.to(room(id)).emit('game:finished',{winner:result.state.winner});clearInterval(interval);loops.delete(id)}}}catch(e){console.error('bot loop',e);clearInterval(interval);loops.delete(id)}},3000);loops.set(id,interval)}