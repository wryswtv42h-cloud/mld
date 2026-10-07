import { initUno, handleUnoAction, tickUno } from './uno.js';
import { initJaccaro, handleJaccaroAction, tickJaccaro } from './jaccaro.js';
import { initCodeNames, handleCodeNamesAction, tickCodeNames } from './codeNames.js';
import { initBaloot, handleBalootAction, tickBaloot } from './baloot.js';
import { initLudo, handleLudoAction, tickLudo } from './ludo.js';
import { initMonopoly, handleMonopolyAction, tickMonopoly } from './monopoly.js';
import { initMaqousar, handleMaqousarAction, tickMaqousar } from './maqousar.js';

const GAMES = {
  uno:{init:initUno,action:handleUnoAction,tick:tickUno,min:2,max:6},
  jaccaro:{init:initJaccaro,action:handleJaccaroAction,tick:tickJaccaro,min:2,max:4},
  codenames:{init:initCodeNames,action:handleCodeNamesAction,tick:tickCodeNames,min:4,max:6},
  baloot:{init:initBaloot,action:handleBalootAction,tick:tickBaloot,min:4,max:4},
  ludo:{init:initLudo,action:handleLudoAction,tick:tickLudo,min:2,max:4},
  monopoly:{init:initMonopoly,action:handleMonopolyAction,tick:tickMonopoly,min:2,max:6},
  maqousar:{init:initMaqousar,action:handleMaqousarAction,tick:tickMaqousar,min:4,max:6}
};

export function getGameConfig(type){ return GAMES[type] || null; }

export async function initGame(gameType, players){
  const game=GAMES[gameType];
  if(!game) throw new Error('لعبة غير معروفة: '+gameType);
  const names=players.map(p=>typeof p==='string'?p:p.name).filter(Boolean);
  if(names.length<game.min) throw new Error(`تحتاج اللعبة إلى ${game.min} لاعبين حقيقيين على الأقل`);
  const state=await game.init(names.slice(0,game.max));
  state.lastMove=Date.now();
  state.botPlayers=[];
  return state;
}

export async function handleAction(gameType,state,playerName,action){
  const game=GAMES[gameType];
  if(!game) throw new Error('لعبة غير معروفة');
  const next=await game.action(state,playerName,action||{});
  next.lastMove=Date.now();
  return next;
}

export async function tickGame(gameType,state){
  const game=GAMES[gameType];
  if(!game||!state) return {changed:false,state};
  const current=state.players?.[state.currentIndex];
  return game.tick(state);
}

function getBotAction(type,state){
  switch(type){
    case 'uno': return {type:'draw'};
    case 'jaccaro': return {type:'play',cardIndex:0};
    case 'codenames': return {type:'end-turn'};
    case 'baloot': return {type:'play',cardIndex:0};
    case 'ludo': return {type:'roll'};
    case 'monopoly': return {type:'roll'};
    case 'maqousar': return {type:'draw'};
    default:return {type:'draw'};
  }
}