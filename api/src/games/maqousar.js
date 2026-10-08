// ===== مقوصر =====
// لعبة سعودية على ورق البالوت
// الفكرة: اجمع أقل عدد نقاط

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function rankValue(rank) {
  const values = {
    '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 1
  };
  return values[rank] || 0;
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: rankValue(rank) });
    }
  }
  // جوكرين
  deck.push({ suit: 'joker', rank: 'JOKER1', value: 20 });
  deck.push({ suit: 'joker', rank: 'JOKER2', value: 20 });
  // شايب = 0
  deck.push({ suit: 'spades', rank: 'K', value: 0 });
  deck.push({ suit: 'hearts', rank: 'K', value: 0 });
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

export function initMaqousar(players) {
  if (players.length < 4) {
    throw new Error('مقوصر يحتاج 4 لاعبين على الأقل');
  }

  const deck = buildDeck();
  const hands = {};

  // كل لاعب ياخذ 4 أوراق (2 فوق + 2 تحت)
  for (const p of players) {
    hands[p] = {
      top: deck.splice(0, 2),    // مكشوفة
      bottom: deck.splice(0, 2), // مخفية
      swapped: false
    };
  }

  // الخبيصة (الكوم)
  const pile = deck;

  return {
    game: 'maqousar',
    players,
    hands,
    pile,
    discard: [],       // الأوراق المطشوشة
    currentIndex: 0,
    currentCard: null, // الورقة اللي بالسحب
    phase: 'draw',     // draw = يسحب، decide = يقرر
    maqousarCalls: {}, // من ضغط زر قوصر
    scores: {},
    totalScores: {},
    round: 1,
    finished: false,
    winner: null,
    log: ['بدأت مقوصر بـ ' + players.length + ' لاعبين']
  };
}

export function handleMaqousarAction(state, playerName, action) {
  const s = JSON.parse(JSON.stringify(state));
  const currentPlayer = s.players[s.currentIndex];

  if (currentPlayer !== playerName) return s;

  // ===== السحب من الخبيصة =====
  if (action.type === 'draw' && s.phase === 'draw') {
    const card = s.pile.pop();
    if (!card) {
      // خلصت الخبيصة، نخلط المطشوشة
      s.pile = shuffle(s.discard);
      s.discard = [];
      s.log.push('أعيد خلط المطشوشة');
      return s;
    }
    s.currentCard = card;
    s.phase = 'decide';
    s.log.push(`${playerName} سحب ورقة`);
  }

  // ===== تبديل مع ورقة فوق (المكشوفة) =====
  else if (action.type === 'swap-top' && s.phase === 'decide') {
    const topIdx = action.index;
    if (topIdx < 0 || topIdx > 1) return s;

    const old = s.hands[playerName].top[topIdx];
    s.hands[playerName].top[topIdx] = s.currentCard;
    s.discard.push(old);
    s.currentCard = null;
    s.phase = 'draw';
    s.currentIndex = (s.currentIndex + 1) % s.players.length;
    s.log.push(`${playerName} بدّل ورقة فوق`);
  }

  // ===== تبديل مع ورقة تحت (المخفية) =====
  else if (action.type === 'swap-bottom' && s.phase === 'decide') {
    const botIdx = action.index;
    if (botIdx < 0 || botIdx > 1) return s;

    // ما يقدر يبدل ورقة تحت أكثر من مرة إلا بـ 8 أو 9
    const old = s.hands[playerName].bottom[botIdx];
    s.hands[playerName].bottom[botIdx] = s.currentCard;
    s.discard.push(old);
    s.hands[playerName].swapped = true;
    s.currentCard = null;
    s.phase = 'draw';
    s.currentIndex = (s.currentIndex + 1) % s.players.length;
    s.log.push(`${playerName} بدّل ورقة تحت`);
  }

  // ===== طش الورقة (رميها بالنص) =====
  else if (action.type === 'discard' && s.phase === 'decide') {
    // إذا الورقة 8 أو 9 → يكشف ورقة من أوراقه المخفية
    const isEightOrNine = ['8', '9'].includes(s.currentCard?.rank);

    s.discard.push(s.currentCard);
    s.log.push(`${playerName} طش ورقة`);

    if (isEightOrNine) {
      s.phase = 'peek-own';
    } else {
      s.currentCard = null;
      s.phase = 'draw';
      s.currentIndex = (s.currentIndex + 1) % s.players.length;
    }
  }

  // ===== كشف ورقة من أوراقه (بعد 8 أو 9) =====
  else if (action.type === 'peek-own' && s.phase === 'peek-own') {
    const idx = action.index;
    if (idx < 0 || idx > 1) return s;
    s.log.push(`${playerName} كشف ورقة مخفية`);
    s.currentCard = null;
    s.phase = 'draw';
    s.currentIndex = (s.currentIndex + 1) % s.players.length;
  }

  // ===== أخذ الورقة المطشوشة =====
  else if (action.type === 'take-discard' && s.phase === 'draw') {
    if (s.discard.length === 0) return s;

    const last = s.discard[s.discard.length - 1];
    const swapIdx = action.index;
    const old = s.hands[playerName].top[swapIdx];
    s.hands[playerName].top[swapIdx] = last;
    s.discard[s.discard.length - 1] = old;
    s.log.push(`${playerName} أخذ الورقة المطشوشة`);
  }

  // ===== حرق الورقة (8 تطابق 8) =====
  else if (action.type === 'burn' && s.phase === 'draw') {
    const card = action.card;
    const topCard = s.discard[s.discard.length - 1];
    if (card.rank === '8' && topCard?.rank === '8') {
      // احرق ورقتك
      const hand = s.hands[playerName].top;
      const idx = hand.findIndex(c => c.rank === '8');
      if (idx !== -1) {
        const burned = hand.splice(idx, 1)[0];
        s.discard.push(burned);
        s.hands[playerName].top = hand;
        s.log.push(`${playerName} حرق 8!`);
      }
    }
  }

  // ===== 9 الأحمر (هاص/ديمن) → كشف ورقة أي لاعب =====
  else if (action.type === 'peek-any' && s.phase === 'draw') {
    const card = action.card;
    const isRedNine = card.rank === '9' && (card.suit === 'hearts' || card.suit === 'diamonds');
    if (isRedNine) {
      s.log.push(`${playerName} كشف ورقة من ${action.targetPlayer}`);
    }
  }

  // ===== الولد الأحمر (J هاص/ديمن) → تبديل أي ورقة =====
  else if (action.type === 'swap-any' && s.phase === 'draw') {
    const card = action.card;
    const isRedJack = card.rank === 'J' && (card.suit === 'hearts' || card.suit === 'diamonds');
    if (isRedJack) {
      s.log.push(`${playerName} بدّل ورقة مع ${action.targetPlayer}`);
    }
  }

  // ===== زر قوصر =====
  else if (action.type === 'maqousar') {
    s.maqousarCalls[playerName] = true;
    s.log.push(`${playerName} قال قوصر!`);

    // إذا كل اللاعبين قالوا قوصر → نهاية الجولة
    if (s.players.every(p => s.maqousarCalls[p])) {
      return endRound(s);
    }
  }

  return s;
}

function endRound(s) {
  // احسب مجموع كل لاعب
  const roundScores = {};
  for (const p of s.players) {
    const hand = s.hands[p];
    const total = [...hand.top, ...hand.bottom]
      .reduce((sum, c) => sum + (c.value || 0), 0);
    roundScores[p] = total;
  }

  // أقل واحد = 0
  const minScore = Math.min(...Object.values(roundScores));
  const winner = Object.keys(roundScores).find(p => roundScores[p] === minScore);

  // اللي عنده الأقل → 0، الباقي → مجموعهم
  for (const p of s.players) {
    if (p === winner) {
      roundScores[p] = 0;
    }
    s.totalScores[p] = (s.totalScores[p] || 0) + roundScores[p];
  }

  s.log.push(`انتهت الجولة! ${winner} فاز بأقل عدد`);

  // إذا وصل 50 → يتصفّر
  // إذا تصفّر 3 مرات → يخرج
  for (const p of s.players) {
    if (s.totalScores[p] >= 50) {
      s.totalScores[p] = 0;
      s.log.push(`${p} وصل 50 وتصفّر`);
    }
  }

  // إذا بقي لاعب واحد → فاز
  if (s.players.length === 1) {
    s.finished = true;
    s.winner = s.players[0];
  } else {
    // جولة جديدة
    s.round++;
    s.maqousarCalls = {};
    s.currentIndex = 0;
    s.phase = 'draw';
    s.currentCard = null;
    // توزيع أوراق جديدة
    const deck = buildDeck();
    for (const p of s.players) {
      s.hands[p] = {
        top: deck.splice(0, 2),
        bottom: deck.splice(0, 2),
        swapped: false
      };
    }
    s.pile = deck;
    s.discard = [];
  }

  return s;
}

export function tickMaqousar(state) {
  return { changed: false, state };
}
