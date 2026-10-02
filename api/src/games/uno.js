// ===== أونو =====

const COLORS = ['red', 'blue', 'green', 'yellow'];

function buildDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: String(i) });
      deck.push({ color, value: String(i) });
    }
    deck.push({ color, value: 'skip' }, { color, value: 'skip' });
    deck.push({ color, value: 'reverse' }, { color, value: 'reverse' });
    deck.push({ color, value: 'draw2' }, { color, value: 'draw2' });
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild' });
    deck.push({ color: 'wild', value: 'wild4' });
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

export function initUno(players) {
  let deck = buildDeck();
  const hands = {};
  for (const p of players) {
    hands[p] = deck.splice(0, 7);
  }

  let firstCard = deck.pop();
  while (firstCard.color === 'wild') {
    deck.unshift(firstCard);
    firstCard = deck.pop();
  }

  return {
    game: 'uno',
    players,
    hands,
    deck,
    discard: [firstCard],
    currentIndex: 0,
    direction: 1,
    currentColor: firstCard.color,
    finished: false,
    winner: null,
    log: [`بدأت اللعبة بـ ${players.length} لاعبين`]
  };
}

export function handleUnoAction(state, playerName, action) {
  const s = JSON.parse(JSON.stringify(state));
  const currentPlayer = s.players[s.currentIndex];

  if (currentPlayer !== playerName) {
    return s;
  }

  if (action.type === 'play') {
    const hand = s.hands[playerName];
    const cardIndex = hand.findIndex(c => c.color === action.card.color && c.value === action.card.value);
    if (cardIndex === -1) return s;

    const card = hand[cardIndex];
    const topCard = s.discard[s.discard.length - 1];

    // التحقق من صحة اللعب
    const canPlay =
      card.color === 'wild' ||
      card.color === s.currentColor ||
      card.value === topCard.value;

    if (!canPlay) return s;

    hand.splice(cardIndex, 1);
    s.discard.push(card);
    s.currentColor = card.color === 'wild' ? (action.color || 'red') : card.color;

    // تأثيرات
    if (card.value === 'skip') {
      s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, 2);
    } else if (card.value === 'reverse') {
      s.direction *= -1;
      s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, 1);
    } else if (card.value === 'draw2') {
      const next = nextIndex(s.currentIndex, s.players.length, s.direction, 1);
      s.hands[s.players[next]].push(s.deck.pop(), s.deck.pop());
      s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, 2);
    } else if (card.value === 'wild4') {
      const next = nextIndex(s.currentIndex, s.players.length, s.direction, 1);
      s.hands[s.players[next]].push(s.deck.pop(), s.deck.pop(), s.deck.pop(), s.deck.pop());
      s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, 2);
    } else {
      s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, 1);
    }

    s.log.push(`${playerName} لعب ${card.value} ${card.color}`);

    if (hand.length === 0) {
      s.finished = true;
      s.winner = playerName;
    }
  } else if (action.type === 'draw') {
    const card = s.deck.pop();
    if (card) s.hands[playerName].push(card);
    s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, 1);
    s.log.push(`${playerName} سحب ورقة`);
  }

  return s;
}

function nextIndex(current, total, direction, steps) {
  return (current + direction * steps + total * 10) % total;
}

export function tickUno(state) {
  return { changed: false, state };
}
