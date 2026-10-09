import { query } from '../db.js';
import { initGame, handleAction, getGameConfig } from '../games/engine.js';
const room=id=>'game:'+id; const safeJson=v=>Array.isArray(v)?v:[];
function personalizedState(state, userName){if(!state||!state.hands)return state;const copy=JSON.parse(JSON.stringify(state));for(const [name,hand] of Object.entries(copy.hands)){if(name!==userName)copy.hands[name]={hidden:true,count:Array.isArray(hand)?hand.length:0};}return copy;}
async function emitGameUpdate(io,sessionId,payload){const sockets=await io.in(room(sessionId)).fetchSockets();for(const client of sockets){const name=client.user?.username||'';client.emit('game:update',{...payload,state:personalizedState(payload.state,name)});}}
export function setupGameSocket(io,socket){
 socket.on('game:join',async({sessionId,asSpectator=false}={})=>{try{
  const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const session=rows[0];if(!session)return socket.emit('game:error',{error:'الجلسة غير موجودة'});
  if(!socket.user)return socket.emit('game:error',{error:'سجّل دخولك للعب'});
  const name=socket.user.username;
  const player={name,userId:socket.user?.id||null,isBot:false,socketId:socket.id};
  let players=safeJson(session.players),spectators=safeJson(session.spectators);const existingPlayer=players.find(p=>String(p.userId||'')===String(socket.user.id)),existingSpectator=spectators.find(p=>String(p.userId||'')===String(socket.user.id));players=players.filter(p=>String(p.userId||'')!==String(socket.user.id));spectators=spectators.filter(p=>String(p.userId||'')!==String(socket.user.id));
  const mustSpectate=asSpectator||session.status==='finished'||(session.status==='playing'&&!existingPlayer)||players.length>=Number(session.max_players||4);
  if(existingPlayer&&session.status==='playing'&&!asSpectator)players.push({...existingPlayer,socketId:socket.id,connected:true});else if(mustSpectate||existingSpectator)spectators.push({...player,isHost:String(session.host_id)===String(socket.user.id)});else players.push({...player,isHost:String(session.host_id)===String(socket.user.id)});
  await query('UPDATE games SET players=$1,spectators=$2 WHERE id=$3',[JSON.stringify(players),JSON.stringify(spectators),sessionId]);
  socket.join(room(sessionId));await emitGameUpdate(io,sessionId,{sessionId,players,spectators,state:session.state,status:session.status,gameType:session.type});
 }catch(e){console.error('game join',e);socket.emit('game:error',{error:'تعذر الانضمام للجلسة'})}});
 socket.on('game:start',async({sessionId}={})=>{try{
  const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const s=rows[0];if(!s)return;
  if(!socket.user)return socket.emit('game:error',{error:'سجّل دخولك للعب'});
  if(s.status!=='waiting')return socket.emit('game:error',{error:'لا يمكن بدء جلسة بدأت أو انتهت بالفعل'});
  const name=socket.user.username;
  const host=s.players?.[0]?.name||name;const isHost=String(s.host_id||'')===String(socket.user.id)||(!s.host_id&&host===name);
  if(!isHost&&!socket.user?.is_owner)return socket.emit('game:error',{error:'صاحب الجلسة أو الأونر فقط'});
  const cfg=getGameConfig(s.type);if(!cfg)return socket.emit('game:error',{error:'اللعبة غير مدعومة'});
  const activePlayers=safeJson(s.players).filter(p=>p.userId&&p.isBot!==true).map(p=>({...p,isBot:false}));if(activePlayers.length<cfg.min)return socket.emit('game:error',{error:'تحتاج اللعبة إلى '+cfg.min+' لاعبين حقيقيين على الأقل قبل البدء'});const state=await initGame(s.type,activePlayers);await query('UPDATE games SET state=$1,status=$2 WHERE id=$3',[JSON.stringify(state),'playing',sessionId]);
  await emitGameUpdate(io,sessionId,{sessionId,players:activePlayers,spectators:safeJson(s.spectators),state,status:'playing',gameType:s.type});
 }catch(e){console.error('game start',e);socket.emit('game:error',{error:e.message||'تعذر بدء اللعبة'})}});
 socket.on('game:action',async({sessionId,action}={})=>{try{
  const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const s=rows[0];if(!s||s.status!=='playing'||!s.state)return;
  if(!socket.user)return socket.emit('game:error',{error:'سجّل دخولك للعب'}); const name=socket.user.username;
  const activePlayer=safeJson(s.players).find(p=>String(p.userId||'')===String(socket.user.id));if(!activePlayer||activePlayer.connected===false||(activePlayer.socketId&&activePlayer.socketId!==socket.id)||safeJson(s.spectators).some(p=>String(p.userId||'')===String(socket.user.id)))return socket.emit('game:error',{error:'أنت مشاهد أو انفصلت عن الطاولة؛ أعد الانضمام للعب'});
  const next=await handleAction(s.type,s.state,name,action);const status=next.finished?'finished':'playing';
  await query('UPDATE games SET state=$1,status=$2 WHERE id=$3',[JSON.stringify(next),status,sessionId]);await emitGameUpdate(io,sessionId,{sessionId,players:s.players||[],spectators:s.spectators||[],state:next,status,gameType:s.type});if(next.finished)io.to(room(sessionId)).emit('game:finished',{winner:next.winner});
 }catch(e){console.error('game action',e);socket.emit('game:error',{error:'الحركة غير صالحة'})}});
 socket.on('game:chat',({sessionId,message}={})=>{if(!socket.user)return socket.emit('game:error',{error:'سجّل دخولك للعب'});const text=String(message||'').trim().slice(0,500);if(!text)return;const roomName=room(sessionId);if(!socket.rooms.has(roomName))return socket.emit('game:error',{error:'انضم إلى الطاولة قبل إرسال الرسائل'});io.to(roomName).emit('game:chat',{sessionId,name:socket.user.username||'عضو',message:text,time:Date.now()})});
 socket.on('game:leave',async({sessionId}={})=>{try{const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const s=rows[0];if(!s)return;const userId=String(socket.user?.id||'');let players;if(s.status==='playing'){players=safeJson(s.players).map(p=>String(p.userId||'')===userId?{...p,connected:false}:p)}else{players=safeJson(s.players).filter(p=>String(p.userId||'')!==userId)}const spectators=safeJson(s.spectators).filter(p=>String(p.userId||'')!==userId);await query('UPDATE games SET players=$1,spectators=$2 WHERE id=$3',[JSON.stringify(players),JSON.stringify(spectators),sessionId]);socket.leave(room(sessionId));await emitGameUpdate(io,sessionId,{sessionId,players,spectators,state:s.state,status:s.status,gameType:s.type})}catch(e){console.error('game leave',e)}});
 socket.on('game:end',async({sessionId}={})=>{try{const {rows}=await query('SELECT * FROM games WHERE id=$1',[sessionId]);const s=rows[0];if(!s)return;const host=String(s.host_id||'')===String(socket.user?.id||'');if(!host&&!socket.user?.is_owner)return;await query('DELETE FROM games WHERE id=$1',[sessionId]);io.to(room(sessionId)).emit('game:ended')}catch(e){console.error('game end',e)}});
}
