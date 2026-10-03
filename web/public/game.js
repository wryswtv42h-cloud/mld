const API_BASE='https://api-production-5bddb.up.railway.app';
"use strict";

const params = new URLSearchParams(location.search);
const sessionId = params.get('id');
const gameType = params.get('type');
const guestName = params.get('name') || localStorage.getItem('guestName') || 'زائر';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');
const playerName = user?.username || guestName;

let socket = null;
let session = null;

function $(s) { return document.querySelector(s); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function setTitle(t) { $('#gameTitle').textContent = t; }
function setStatus(t) { $('#tableStatus').textContent = t; }

// ===== بدء الاتصال =====
async function init() {
  if (sessionId) {
    // الانضمام لجلسة موجودة
    const r = await fetch(API_BASE + '/api/games/sessions/' + sessionId);
    const d = await r.json();
    if (!d.session) {
      alert('الجلسة غير موجودة');
      location.href = '/';
      return;
    }
    session = d.session;
  } else if (gameType) {
    // إنشاء جلسة جديدة
    const r = await fetch(API_BASE + '/api/games/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_type: gameType, guest_name: playerName, max_players: 6 })
    });
    const d = await r.json();
    session = d.session;
    history.replaceState(null, '', '?id=' + session.id);
  } else {
    location.href = '/';
    return;
  }

  setTitle(gameTypeToName(session.game_type));
  connectSocket();
  renderPlayers();
}

function gameTypeToName(t) {
  const names = {
    uno: '🎴 أونو',
    jaccaro: '🎲 جاكارو',
    codenames: '🕵️ كود نيمز',
    baloot: '♠️ بلوت',
    ludo: '🎯 لودو',
    monopoly: '🏠 مونوبولي',
    maqousar: '🃏 مقوصر'
  };
  return names[t] || t;
}

// ===== Socket =====
function connectSocket() {
  socket = io(API_BASE, { auth: { token } });

  socket.on('connect', () => {
    socket.emit('game:join', { sessionId: session.id, asSpectator: false });
  });

  socket.on('game:update', (data) => {
    session.players = data.players;
    session.spectators = data.spectators;
    session.state = data.state;
    session.status = data.status;
    renderPlayers();
    renderState();
  });

  socket.on('game:started', () => {
    $('#startOverlay').style.display = 'none';
  });

  socket.on('game:finished', (data) => {
    setStatus('🏆 فاز: ' + data.winner);
  });

  socket.on('game:ended', () => {
    alert('انتهت الجلسة');
    location.href = '/';
  });

  socket.on('game:chat', (data) => {
    addChat(data.name, data.message);
  });

  socket.on('game:error', (data) => {
    alert(data.error);
  });
}

// ===== عرض اللاعبين =====
function renderPlayers() {
  const box = $('#gamePlayers');
  if (!session.players) return;
  box.innerHTML = session.players.map((p, i) => `
    <div class="player-chip ${i === (session.state?.currentIndex || 0) ? 'active' : ''}">
      <span class="dot"></span>
      ${esc(p.name)}
    </div>
  `).join('');
}

// ===== عرض الحالة =====
function renderState() {
  const state = session.state;
  if (!state) return;

  const isHost = session.host_name === playerName;
  const isOwner = user?.is_owner;

  if (session.status === 'waiting') {
    setStatus('بانتظار اللاعبين... (' + (session.players?.length || 0) + ')');
    if (isHost || isOwner) {
      $('#startBtn').style.display = 'inline-block';
      $('#startBtn').onclick = () => socket.emit('game:start', { sessionId: session.id });
      $('#overlayText').textContent = 'أنت صاحب الجلسة — اضغط ابدأ عندما يكون الجميع جاهزين';
    } else {
      $('#startBtn').style.display = 'none';
      $('#overlayText').textContent = 'بانتظار صاحب الجلسة ليبدأ...';
    }
    return;
  }

  $('#startOverlay').style.display = 'none';

  // عرض الأزرار حسب اللعبة
  const actions = $('#gameActions');
  if (state.finished) {
    setStatus('🏆 فاز: ' + state.winner);
    actions.innerHTML = '';
    return;
  }

  const isMyTurn = state.players?.[state.currentIndex] === playerName;
  setStatus(isMyTurn ? '🎯 دورك!' : 'بانتظار ' + (state.players?.[state.currentIndex] || ''));

  // أزرار حسب اللعبة
  let html = '';
  if (session.game_type === 'uno') {
    html = `
      <button class="action-btn" onclick="gameAction({type:'draw'})" ${isMyTurn ? '' : 'disabled'}>اسحب</button>
      <button class="action-btn secondary" onclick="gameAction({type:'play'})" ${isMyTurn ? '' : 'disabled'}>العب</button>
    `;
  } else if (session.game_type === 'jaccaro') {
    html = `<button class="action-btn" onclick="gameAction({type:'play',cardIndex:0})" ${isMyTurn ? '' : 'disabled'}>العب ورقة</button>`;
  } else if (session.game_type === 'ludo') {
    html = `
      <button class="action-btn" onclick="gameAction({type:'roll'})" ${isMyTurn ? '' : 'disabled'}>ارمِ النرد</button>
    `;
  } else if (session.game_type === 'monopoly') {
    html = `<button class="action-btn" onclick="gameAction({type:'roll'})" ${isMyTurn ? '' : 'disabled'}>ارمِ النرد</button>`;
  } else if (session.game_type === 'codenames') {
    html = `
      <button class="action-btn" onclick="promptClue()">تلميح</button>
      <button class="action-btn secondary" onclick="gameAction({type:'end-turn'})">إنهاء الدور</button>
    `;
  } else if (session.game_type === 'maqousar') {
    html = `
      <button class="action-btn" onclick="gameAction({type:'draw'})" ${isMyTurn ? '' : 'disabled'}>اسحب</button>
      <button class="action-btn secondary" onclick="gameAction({type:'discard'})" ${isMyTurn ? '' : 'disabled'}>طش</button>
      <button class="action-btn secondary" onclick="gameAction({type:'maqousar'})">قوصر!</button>
    `;
  } else if (session.game_type === 'baloot') {
    html = `<button class="action-btn" onclick="gameAction({type:'play',card:{suit:'hearts',rank:'A'}})" ${isMyTurn ? '' : 'disabled'}>العب</button>`;
  }
  actions.innerHTML = html;

  // معلومات إضافية
  const info = $('#gameInfo');
  if (state.round) info.textContent = 'الجولة: ' + state.round;
  else info.textContent = '';
}

window.gameAction = (action) => {
  if (!socket) return;
  socket.emit('game:action', { sessionId: session.id, action });
};

window.promptClue = () => {
  const word = prompt('التلميح:');
  if (!word) return;
  const num = prompt('العدد:') || '1';
  gameAction({ type: 'clue', word, number: parseInt(num) });
};

// ===== الشات =====
function addChat(name, message) {
  const body = $('#chatBody');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<b>${esc(name)}</b> ${esc(message)}`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

$('#chatSend').onclick = () => {
  const input = $('#chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('game:chat', { sessionId: session.id, message: msg });
  input.value = '';
};

$('#chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#chatSend').click();
});

// ===== خروج =====
window.addEventListener('beforeunload', () => {
  if (socket && session) {
    socket.emit('game:leave', { sessionId: session.id });
  }
});

init();
