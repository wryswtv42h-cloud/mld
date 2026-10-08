// ===== بلوت =====

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initBaloot(players) {
  if (players.length !== 4) {
    throw new Error('بلوت يحتاج 4 لاعبين بالضبط');
  }

  const deck = buildDeck();
  const hands = {};
  for (const p of players) {
    hands[p] = deck.splice(0, 5);
  }

  return {
    game: 'baloot',
    players,
    hands,
    deck,
    table: [],
    currentIndex: 0,
    teams: [
      [players[0], players[2]], // فريق 1
      [players[1], players[3]]  // فريق 2
    ],
    scores: [0, 0],
    round: 1,
    finished: false,
    winner: null,
    log: ['بدأت بلوت بـ 4 لاعبين']
  };
}

export function handleBalootAction(state, playerName, action) {
  const s = JSON.parse(JSON.stringify(state));
  const currentPlayer = s.players[s.currentIndex];

  if (currentPlayer !== playerName) return s;

  if (action.type === 'play') {
    const hand = s.hands[playerName];
    const idx = hand.findIndex(c => c.suit === action.card.suit && c.rank === action.card.rank);
    if (idx === -1) return s;

    const card = hand.splice(idx, 1)[0];
    s.table.push({ player: playerName, card });
    s.log.push(`${playerName} لعب ${card.rank} ${card.suit}`);

    if (s.table.length === 4) {
      // نهاية الجولة
      const winner = evaluateRound(s.table);
      s.log.push(`فاز ${winner} بالجولة`);

      // إعادة الأوراق
      for (const p of s.players) {
        if (s.deck.length >= 5) {
          s.hands[p] = s.deck.splice(0, 5);
        }
      }
      s.table = [];
      s.round++;

      if (s.round > 8) {
        s.finished = true;
        const winnerTeam = s.scores[0] > s.scores[1] ? s.teams[0].join(' و ') : s.teams[1].join(' و ');
        s.winner = winnerTeam;
      }
    } else {
      s.currentIndex = (s.currentIndex + 1) % 4;
    }
  }

  return s;
}

function evaluateRound(table) {
  // الحكم: اللي عنده أعلى ورقة من نفس النوع
  const firstSuit = table[0].card.suit;
  let winner = table[0].player;
  let highest = rankValue(table[0].card.rank);

  for (const t of table) {
    if (t.card.suit === firstSuit && rankValue(t.card.rank) > highest) {
      highest = rankValue(t.card.rank);
      winner = t.player;
    }
  }
  return winner;
}

function rankValue(rank) {
  const values = { '7': 1, '8': 2, '9': 3, '10': 4, 'J': 5, 'Q': 6, 'K': 7, 'A': 8 };
  return values[rank] || 0;
}

export function tickBaloot(state) {
  return { changed: false, state };
}
