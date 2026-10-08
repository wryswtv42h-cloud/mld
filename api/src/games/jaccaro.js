// ===== جاكارو =====

function buildDeck() {
  const deck = [];
  for (let i = 0; i < 4; i++) {
    deck.push({ type: 'start', value: 0 });
    deck.push({ type: 'safe', value: 0 });
  }
  for (let i = 1; i <= 12; i++) {
    deck.push({ type: 'move', value: i });
    deck.push({ type: 'move', value: i });
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ type: 'back', value: 4 });
    deck.push({ type: 'swap' });
    deck.push({ type: 'skip' });
    deck.push({ type: 'draw' });
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

export function initJaccaro(players) {
  const deck = buildDeck();
  const hands = {};
  for (const p of players) {
    hands[p] = deck.splice(0, 5);
  }

  const marbles = {};
  for (const p of players) {
    marbles[p] = { home: 4, track: 0, safe: 0, finished: 0 };
  }

  return {
    game: 'jaccaro',
    players,
    hands,
    deck,
    discard: [],
    marbles,
    currentIndex: 0,
    finished: false,
    winner: null,
    log: [`بدأت جاكارو بـ ${players.length} لاعبين`]
  };
}

export function handleJaccaroAction(state, playerName, action) {
  const s = JSON.parse(JSON.stringify(state));
  const currentPlayer = s.players[s.currentIndex];

  if (currentPlayer !== playerName) return s;

  if (action.type === 'play') {
    const hand = s.hands[playerName];
    const idx = action.cardIndex;

    if (idx < 0 || idx >= hand.length) return s;

    const card = hand[idx];
    hand.splice(idx, 1);
    s.discard.push(card);

    const m = s.marbles[playerName];

    switch (card.type) {
      case 'move':
        if (m.home > 0) {
          m.home--;
          m.track += card.value;
        } else {
          m.track += card.value;
        }
        break;
      case 'start':
        if (m.home > 0) {
          m.home--;
          m.track = 1;
        }
        break;
      case 'safe':
        m.safe++;
        break;
      case 'back':
        m.track = Math.max(0, m.track - card.value);
        break;
      case 'swap':
        // تبديل مع لاعب آخر
        break;
      case 'skip':
        s.currentIndex = nextIndex(s.currentIndex, s.players.length, 2);
        break;
      case 'draw':
        s.hands[playerName].push(s.deck.pop());
        break;
    }

    if (m.track >= 60) {
      m.finished++;
      m.track = 0;
    }

    if (m.finished >= 4) {
      s.finished = true;
      s.winner = playerName;
    }

    s.log.push(`${playerName} لعب ${card.type}${card.value ? ' ' + card.value : ''}`);
    s.currentIndex = nextIndex(s.currentIndex, s.players.length, 1);

    // سحب ورقة جديدة
    const newCard = s.deck.pop();
    if (newCard) s.hands[playerName].push(newCard);
  }

  return s;
}

function nextIndex(current, total, steps) {
  return (current + steps) % total;
}

export function tickJaccaro(state) {
  return { changed: false, state };
}
