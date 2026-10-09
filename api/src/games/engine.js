import { initUno, handleUnoAction, tickUno } from './uno.js';
import { initJaccaro, handleJaccaroAction, tickJaccaro } from './jaccaro.js';
import { initCodeNames, handleCodeNamesAction, tickCodeNames } from './codeNames.js';
import { initBaloot, handleBalootAction, tickBaloot } from './baloot.js';
import { initLudo, handleLudoAction, tickLudo } from './ludo.js';
import { initMonopoly, handleMonopolyAction, tickMonopoly } from './monopoly.js';
import { initMaqousar, handleMaqousarAction, tickMaqousar } from './maqousar.js';

const GAMES = {
  uno:{init:initUno,action:handleUnoAction,tick:tickUno,min:2,max:6,bots:true},
  jaccaro:{init:initJaccaro,action:handleJaccaroAction,tick:tickJaccaro,min:2,max:4,bots:true},
  codenames:{init:initCodeNames,action:handleCodeNamesAction,tick:tickCodeNames,min:4,max:6,bots:false},
  baloot:{init:initBaloot,action:handleBalootAction,tick:tickBaloot,min:4,max:4,bots:false},
  ludo:{init:initLudo,action:handleLudoAction,tick:tickLudo,min:2,max:4,bots:true},
  monopoly:{init:initMonopoly,action:handleMonopolyAction,tick:tickMonopoly,min:2,max:6,bots:true},
  maqousar:{init:initMaqousar,action:handleMaqousarAction,tick:tickMaqousar,min:4,max:6,bots:false}
};

export function getGameConfig(type){ return GAMES[type] || null; }

export async function initGame(gameType,players){
 const game=GAMES[gameType];if(!game)throw new Error('لعبة غير معروفة: '+gameType);
 const names=players.map(p=>typeof p==='string'?p:p.name).filter(Boolean).slice(0,game.max);
 if(names.length<game.min&&!game.bots)throw new Error(`تحتاج اللعبة إلى ${game.min} لاعبين حقيقيين على الأقل؛ البوتات غير مسموحة هنا`);
 const botPlayers=[];while(names.length<game.min&&game.bots){const n='بوت '+(botPlayers.length+1);names.push(n);botPlayers.push(n);}
 const state=await game.init(names.slice(0,game.max));state.lastMove=Date.now();state.botPlayers=botPlayers;return state;
}

export async function handleAction(gameType,state,playerName,action){
  const game=GAMES[gameType];
  if(!game) throw new Error('لعبة غير معروفة');
  const next=await game.action(state,playerName,action||{});
  next.lastMove=Date.now();
  return next;
}

export async function tickGame(gameType,state){
 const game=GAMES[gameType];if(!game||!state)return {changed:false,state};
 const current=state.players?.[state.currentIndex];
 if(current&&Array.isArray(state.botPlayers)&&state.botPlayers.includes(current)){
  const action=getBotAction(gameType,state,current);if(!action)return {changed:false,state};
  const next=await game.action(state,current,action);next.lastMove=Date.now();next.botPlayers=state.botPlayers;return {changed:true,state:next};
 }
 return game.tick(state);
}
export function replaceBot(state,botName,realName){
 if(!state||!Array.isArray(state.players)||!state.players.includes(botName))return {success:false,state};
 const rename=value=>{if(Array.isArray(value))return value.map(rename);if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k===botName?realName:k]=rename(v);return out;}return value===botName?realName:value;};
 const next=rename(JSON.parse(JSON.stringify(state)));next.botPlayers=(next.botPlayers||[]).filter(n=>n!==realName);return {success:true,state:next};
}

function getBotAction(type,state,player){
 switch(type){
 case 'uno':{const hand=state.hands?.[player]||[],top=state.discard?.[state.discard.length-1],card=hand.find(c=>c.color==='wild'||c.color===state.currentColor||c.value===top?.value);return card?{type:'play',card,color:['red','blue','green','yellow'][Math.floor(Math.random()*4)]}:{type:'draw'};}
 case 'jaccaro':return state.hands?.[player]?.length?{type:'play',cardIndex:0}:null;
 case 'ludo':{if(!state.dice)return {type:'roll'};const tokens=state.tokens?.[player]||[],index=tokens.findIndex(x=>x.pos===-1?state.dice===6:x.pos+state.dice<=56);return index>=0?{type:'move',tokenIndex:index}:{type:'roll'};}
 case 'monopoly':return {type:'roll'};
 default:return null;
 }
}
