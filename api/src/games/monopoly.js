// ===== مونوبولي =====

const BOARD = [
  { name: 'البداية', type: 'start', price: 0 },
  { name: 'طريق 1', type: 'property', price: 60, rent: 2, color: 'brown' },
  { name: 'صندوق 1', type: 'chest', price: 0 },
  { name: 'طريق 2', type: 'property', price: 60, rent: 4, color: 'brown' },
  { name: 'ضريبة', type: 'tax', price: 0, amount: 200 },
  { name: 'محطة 1', type: 'railroad', price: 200, rent: 25 },
  { name: 'شارع 1', type: 'property', price: 100, rent: 6, color: 'cyan' },
  { name: 'فرصة 1', type: 'chance', price: 0 },
  { name: 'شارع 2', type: 'property', price: 100, rent: 6, color: 'cyan' },
  { name: 'شارع 3', type: 'property', price: 120, rent: 8, color: 'cyan' },
  { name: 'السجن', type: 'jail', price: 0 },
  { name: 'شارع 4', type: 'property', price: 140, rent: 10, color: 'pink' },
  { name: 'كهرباء', type: 'utility', price: 150, rent: 4 },
  { name: 'شارع 5', type: 'property', price: 140, rent: 10, color: 'pink' },
  { name: 'شارع 6', type: 'property', price: 160, rent: 12, color: 'pink' },
  { name: 'محطة 2', type: 'railroad', price: 200, rent: 25 },
  { name: 'شارع 7', type: 'property', price: 180, rent: 14, color: 'orange' },
  { name: 'صندوق 2', type: 'chest', price: 0 },
  { name: 'شارع 8', type: 'property', price: 180, rent: 14, color: 'orange' },
  { name: 'شارع 9', type: 'property', price: 200, rent: 16, color: 'orange' },
  { name: 'موقف', type: 'parking', price: 0 },
  { name: 'شارع 10', type: 'property', price: 220, rent: 18, color: 'red' },
  { name: 'فرصة 2', type: 'chance', price: 0 },
  { name: 'شارع 11', type: 'property', price: 220, rent: 18, color: 'red' },
  { name: 'شارع 12', type: 'property', price: 240, rent: 20, color: 'red' },
  { name: 'محطة 3', type: 'railroad', price: 200, rent: 25 },
  { name: 'شارع 13', type: 'property', price: 260, rent: 22, color: 'yellow' },
  { name: 'شارع 14', type: 'property', price: 260, rent: 22, color: 'yellow' },
  { name: 'ماء', type: 'utility', price: 150, rent: 4 },
  { name: 'شارع 15', type: 'property', price: 280, rent: 24, color: 'yellow' },
  { name: 'الشرطة', type: 'gotojail', price: 0 },
  { name: 'شارع 16', type: 'property', price: 300, rent: 26, color: 'green' },
  { name: 'شارع 17', type: 'property', price: 300, rent: 26, color: 'green' },
  { name: 'صندوق 3', type: 'chest', price: 0 },
  { name: 'شارع 18', type: 'property', price: 320, rent: 28, color: 'green' },
  { name: 'محطة 4', type: 'railroad', price: 200, rent: 25 },
  { name: 'فرصة 3', type: 'chance', price: 0 },
  { name: 'شارع 19', type: 'property', price: 350, rent: 35, color: 'blue' },
  { name: 'ضريبة 2', type: 'tax', price: 0, amount: 100 },
  { name: 'شارع 20', type: 'property', price: 400, rent: 50, color: 'blue' }
];

export function initMonopoly(players) {
  const state = {
    game: 'monopoly',
    players,
    money: {},
    positions: {},
    properties: {},
    currentIndex: 0,
    dice: null,
    finished: false,
    winner: null,
    log: ['بدأت مونوبولي بـ ' + players.length + ' لاعبين']
  };

  for (const p of players) {
    state.money[p] = 1500;
    state.positions[p] = 0;
    state.properties[p] = [];
  }

  return state;
}

export function handleMonopolyAction(state, playerName, action) {
  const s = JSON.parse(JSON.stringify(state));
  const currentPlayer = s.players[s.currentIndex];

  if (currentPlayer !== playerName) return s;

  if (action.type === 'roll') {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    s.dice = d1 + d2;

    const pos = (s.positions[playerName] + s.dice) % BOARD.length;
    s.positions[playerName] = pos;

    const tile = BOARD[pos];
    s.log.push(`${playerName} رمى ${s.dice} ووصل إلى ${tile.name}`);

    // تطبيق تأثير البلاطة
    if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
      if (!s.properties[tile.name]) {
        // شراء تلقائي إذا عنده فلوس
        if (s.money[playerName] >= tile.price) {
          s.money[playerName] -= tile.price;
          s.properties[tile.name] = playerName;
          s.properties[playerName].push(tile.name);
          s.log.push(`${playerName} اشترى ${tile.name} بـ ${tile.price}`);
        }
      } else if (s.properties[tile.name] !== playerName) {
        // دفع إيجار
        const rent = tile.rent || 10;
        s.money[playerName] -= rent;
        s.money[s.properties[tile.name]] += rent;
        s.log.push(`${playerName} دفع ${rent} إيجار لـ ${s.properties[tile.name]}`);
      }
    }

    if (tile.type === 'tax') {
      s.money[playerName] -= tile.amount;
      s.log.push(`${playerName} دفع ضريبة ${tile.amount}`);
    }

    if (tile.type === 'gotojail') {
      s.positions[playerName] = 10;
      s.log.push(`${playerName} ذهب للسجن`);
    }

    // فحص الإفلاس
    if (s.money[playerName] <= 0) {
      s.log.push(`${playerName} أفلس!`);
      s.players = s.players.filter(p => p !== playerName);
      if (s.players.length === 1) {
        s.finished = true;
        s.winner = s.players[0];
        return s;
      }
      s.currentIndex = s.currentIndex % s.players.length;
    } else {
      s.currentIndex = (s.currentIndex + 1) % s.players.length;
    }

    s.dice = null;
  }

  return s;
}

export function tickMonopoly(state) {
  return { changed: false, state };
}
