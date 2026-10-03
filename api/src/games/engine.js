import { initUno, handleUnoAction, tickUno } from './uno.js';
import { initJaccaro, handleJaccaroAction, tickJaccaro } from './jaccaro.js';
import { initCodeNames, handleCodeNamesAction, tickCodeNames } from './codeNames.js';
import { initBaloot, handleBalootAction, tickBaloot } from './baloot.js';
import { initLudo, handleLudoAction, tickLudo } from './ludo.js';
import { initMonopoly, handleMonopolyAction, tickMonopoly } from './monopoly.js';
import { initMaqousar, handleMaqousarAction, tickMaqousar } from './maqousar.js';

const GAMES = {
  uno: { init: initUno, action: handleUnoAction, tick: tickUno },
  jaccaro: { init: initJaccaro, action: handleJaccaroAction, tick: tickJaccaro },
  codenames: { init: initCodeNames, action: handleCodeNamesAction, tick: tickCodeNames },
  baloot: { init: initBaloot, action: handleBalootAction, tick: tickBaloot },
  ludo: { init: initLudo, action: handleLudoAction, tick: tickLudo },
  monopoly: { init: initMonopoly, action: handleMonopolyAction, tick: tickMonopoly },
  maqousar: { init: initMaqousar, action: handleMaqousarAction, tick: tickMaqousar }
};

export async function initGame(gameType, players) {
  const game = GAMES[gameType];
  if (!game) throw new Error('لعبة غير معروفة: ' + gameType);

  const minPlayers = getMinPlayers(gameType);
  const realPlayers = players.filter(p => !p.isBot);
  if (realPlayers.length < minPlayers) throw new Error(`تحتاج إلى ${minPlayers} لاعبين حقيقيين لبدء اللعبة`);
  return game.init(realPlayers.map(p => p.name));
}

export async function handleAction(gameType, state, playerName, action) {
  const game = GAMES[gameType];
  if (!game) throw new Error('لعبة غير معروفة');

  return game.action(state, playerName, action);
}

export async function tickGame(gameType, state) {
  const game = GAMES[gameType];
  if (!game) return { changed: false, state };

  return game.tick(state);
}

function getMinPlayers(gameType) {
  const mins = {
    uno: 2,
    jaccaro: 2,
    codenames: 4,
    baloot: 4,
    ludo: 2,
    monopoly: 2,
    maqousar: 4
  };
  return mins[gameType] || 2;
}
