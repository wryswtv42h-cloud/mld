// ===== لودو =====

const COLORS = ['red', 'blue', 'green', 'yellow'];

export function initLudo(players) {
  const tokens = {};
  for (const p of players) {
    tokens[p] = [
      { pos: -1, color: COLORS[players.indexOf(p) % 4] }, // -1 = في البيت
      { pos: -1, color: COLORS[players.indexOf(p) % 4] },
      { pos: -1, color: COLORS[players.indexOf(p) % 4] },
      { pos: -1, color: COLORS[players.indexOf(p) % 4] }
    ];
  }

  return {
    game: 'ludo',
    players,
    tokens,
    currentIndex: 0,
    dice: null,
    finished: false,
    winner: null,
    log: ['بدأت لودو بـ ' + players.length + ' لاعبين']
  };
}

export function handleLudoAction(state, playerName, action) {
  const s = JSON.parse(JSON.stringify(state));
  const currentPlayer = s.players[s.currentIndex];

  if (currentPlayer !== playerName) return s;

  if (action.type === 'roll') {
    s.dice = Math.floor(Math.random() * 6) + 1;
    s.log.push(`${playerName} رما ${s.dice}`);

    // إذا ما فيه حركة ممكنة
    const possible = s.tokens[playerName].some(t => t.pos === -1 ? s.dice === 6 : t.pos + s.dice <= 56);
    if (!possible) {
      s.currentIndex = (s.currentIndex + 1) % s.players.length;
      s.dice = null;
    }
  }

  if (action.type === 'move') {
    if (!Number.isInteger(action.tokenIndex) || !s.dice) return s;
    const token = s.tokens[playerName]?.[action.tokenIndex];
    if (!token) return s;

    if (token.pos === -1) {
      if (s.dice !== 6) return s;
      token.pos = 0;
      s.log.push(`${playerName} أخرج قطعة من البيت`);
    } else {
      const destination = token.pos + s.dice;
      if (destination > 56) return s;
      token.pos = destination;
      s.log.push(`${playerName} حرّك قطعة إلى ${token.pos}`);
    }

    if (s.tokens[playerName].every(t => t.pos === 56)) {
      s.finished = true;
      s.winner = playerName;
      return s;
    }

    s.currentIndex = (s.currentIndex + 1) % s.players.length;
    s.dice = null;
  }

  return s;
}

export function tickLudo(state) {
  return { changed: false, state };
}
