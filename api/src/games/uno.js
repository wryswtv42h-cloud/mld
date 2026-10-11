// ===== أونو =====

const COLORS = ['red', 'blue', 'green', 'yellow'];

function buildDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: String(i) }, { color, value: String(i) });
    }
    deck.push({ color, value: 'skip' }, { color, value: 'skip' });
    deck.push({ color, value: 'reverse' }, { color, value: 'reverse' });
    deck.push({ color, value: 'draw2' }, { color, value: 'draw2' });
  }
  for (let i = 0; i < 4; i++) deck.push({ color: 'wild', value: 'wild' }, { color: 'wild', value: 'wild4' });
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

// Keep the visible discard card and recycle the rest when the draw pile is empty.
function drawCard(state) {
  if (!state.deck.length && state.discard.length > 1) {
    const top = state.discard.pop();
    state.deck = shuffle(state.discard);
    state.discard = [top];
  }
  return state.deck.pop() || null;
}

function drawMany(state, player, count) {
  for (let i = 0; i < count; i++) {
    const card = drawCard(state);
    if (!card) break;
    state.hands[player].push(card);
  }
}

export function initUno(players) {
  const deck = buildDeck();
  const hands = {};
  for (const p of players) hands[p] = deck.splice(0, 7);

  let firstCard = deck.pop();
  while (firstCard?.color === 'wild') {
    deck.unshift(firstCard);
    firstCard = deck.pop();
  }

  return {
    game: 'uno', players, hands, deck, discard: [firstCard],
    currentIndex: 0, direction: 1, currentColor: firstCard.color,
    finished: false, winner: null,
    log: [`بدأت اللعبة بـ ${players.length} لاعبين`]
  };
}

export function handleUnoAction(state, playerName, action = {}) {
  const s = JSON.parse(JSON.stringify(state));
  if (s.finished || s.players[s.currentIndex] !== playerName) return s;

  if (action.type === 'play') {
    const hand = s.hands[playerName];
    if (!Array.isArray(hand) || !action.card || typeof action.card !== 'object') return s;
    const cardIndex = Number.isInteger(action.cardIndex)
      ? action.cardIndex
      : hand.findIndex(c => c.color === action.card.color && c.value === action.card.value);
    if (cardIndex < 0 || cardIndex >= hand.length) return s;

    const card = hand[cardIndex];
    // Do not trust client-supplied card properties: use the actual card in the player's hand.
    const topCard = s.discard[s.discard.length - 1];
    if (!topCard) return s;
    const canPlay = card.color === 'wild' || card.color === s.currentColor || card.value === topCard.value;
    if (!canPlay) return s;
    if (card.value === 'wild4' && hand.some(c => c.color === s.currentColor && c.color !== 'wild')) return s;

    const chosenColor = String(action.color || 'red').toLowerCase();
    if (card.color === 'wild' && !COLORS.includes(chosenColor)) return s;

    hand.splice(cardIndex, 1);
    s.discard.push(card);
    s.currentColor = card.color === 'wild' ? chosenColor : card.color;

    if (card.value === 'skip') {
      s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, 2);
    } else if (card.value === 'reverse') {
      s.direction *= -1;
      // In a two-player UNO game, reverse acts like skip.
      s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, s.players.length === 2 ? 2 : 1);
    } else if (card.value === 'draw2' || card.value === 'wild4') {
      const penalty = card.value === 'draw2' ? 2 : 4;
      const next = nextIndex(s.currentIndex, s.players.length, s.direction, 1);
      drawMany(s, s.players[next], penalty);
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
    const card = drawCard(s);
    if (card) {
      s.hands[playerName].push(card);
      s.log.push(`${playerName} سحب ورقة`);
    } else {
      s.log.push('نفدت أوراق السحب');
    }
    s.currentIndex = nextIndex(s.currentIndex, s.players.length, s.direction, 1);
  }
  return s;
}

function nextIndex(current, total, direction, steps) {
  return (current + direction * steps + total * 10) % total;
}

export function tickUno(state) {
  return { changed: false, state };
}
