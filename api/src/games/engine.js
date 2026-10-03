export async function initGame(gameType, players = []) {
  const gameConfig = {
    uno: { minPlayers: 2, maxPlayers: 6, startCards: 7 },
    jaccaro: { minPlayers: 2, maxPlayers: 4, startCards: 5 },
    codenames: { minPlayers: 4, maxPlayers: 8, timeLimit: 300 },
    baloot: { minPlayers: 4, maxPlayers: 4, startCards: 5 },
    ludo: { minPlayers: 2, maxPlayers: 4, boardSize: 40 },
    monopoly: { minPlayers: 2, maxPlayers: 6, startMoney: 1500 },
    maqousar: { minPlayers: 4, maxPlayers: 8, startCards: 5 }
  };

  const config = gameConfig[gameType] || gameConfig.uno;
  const activePlayers = (players || []).filter(p => p).length || 2;

  if (activePlayers < config.minPlayers) {
    return { error: `الحد الأدنى من اللاعبين: ${config.minPlayers}` };
  }

  return {
    gameType,
    status: 'playing',
    currentTurn: 0,
    round: 1,
    players: (players || []).map((p, i) => ({
      id: i,
      name: p.name || `لاعب ${i + 1}`,
      userId: p.userId || null,
      isBot: p.isBot || false,
      score: 0,
      hand: [],
      status: 'active'
    })),
    finished: false,
    winner: null,
    createdAt: Date.now()
  };
}

export async function handleAction(gameType, state, playerName, action) {
  if (!state || state.finished) return state;
  const newState = JSON.parse(JSON.stringify(state));
  newState.updatedAt = Date.now();
  return newState;
}

export async function tickGame(gameType, state) {
  if (!state || state.finished) return { changed: false, state };
  return { changed: false, state };
}
