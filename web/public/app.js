// MLD Dashboard - تطبيق لوحة التحكم
const API = 'http://localhost:3000/api';
let token = localStorage.getItem('mld_token');
let user = null;
let socket = null;

function showError(msg) {
  alert(msg);
}

function showSuccess(msg) {
  console.log('✅', msg);
}

async function fetchAPI(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('mld_token');
    window.location.href = 'index.html';
    return null;
  }

  return response.json();
}

async function init() {
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const me = await fetchAPI('/auth/me');
  if (!me || !me.user) {
    localStorage.removeItem('mld_token');
    window.location.href = 'index.html';
    return;
  }

  user = me.user;
  renderUI();
  connectSocket();
}

function connectSocket() {
  socket = io(window.location.origin, {
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('✅ متصل بـ Socket.IO');
  });

  socket.on('disconnect', () => {
    console.log('❌ قطع الاتصال');
  });
}

function renderUI() {
  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = `
    <section class="dashboard-hero">
      <h1>مرحبًا يا ${user.username}</h1>
      <p>أهلًا بك في لوحة تحكم MLD</p>
    </section>

    <div class="dashboard-grid">
      <div class="card clickable" onclick="goToSection('profile')">
        <h3>👤 بروفايلي</h3>
        <p>عدّل بيانات ملفك الشخصي</p>
      </div>
      <div class="card clickable" onclick="goToSection('bots')">
        <h3>🤖 البوتات</h3>
        <p>إدارة بوتاتك الخاصة</p>
      </div>
      <div class="card clickable" onclick="goToSection('games')">
        <h3>🎮 الألعاب</h3>
        <p>اجلس مع أصدقائك والعب</p>
      </div>
      <div class="card clickable" onclick="goToSection('chat')">
        <h3>💬 الشات</h3>
        <p>الدردشة مع المجتمع</p>
      </div>
    </div>
  `;
}

function goToSection(section) {
  const content = document.getElementById('content');
  if (!content) return;

  if (section === 'profile') {
    renderProfile();
  } else if (section === 'bots') {
    renderBots();
  } else if (section === 'games') {
    renderGames();
  } else if (section === 'chat') {
    renderChat();
  }
}

async function renderProfile() {
  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = `
    <section class="profile-section">
      <h2>🔧 تحرير بروفايلك</h2>
      <form id="profile-form">
        <div class="form-group">
          <label>اسم المستخدم</label>
          <input type="text" id="username" value="${user.username}" required>
        </div>
        <div class="form-group">
          <label>النبذة</label>
          <textarea id="bio">${user.bio || ''}</textarea>
        </div>
        <button type="submit" class="primary-btn">حفظ</button>
      </form>
    </section>
  `;

  document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const result = await fetchAPI('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({
        username: document.getElementById('username').value,
        bio: document.getElementById('bio').value
      })
    });
    if (result?.user) {
      user = result.user;
      showSuccess('تم حفظ البيانات');
      renderUI();
    } else {
      showError('فشل حفظ البيانات');
    }
  };
}

async function renderBots() {
  const content = document.getElementById('content');
  if (!content) return;

  const result = await fetchAPI('/bots');
  const bots = result?.bots || [];

  content.innerHTML = `
    <section class="bots-section">
      <h2>🤖 بوتاتي</h2>
      <button class="primary-btn" onclick="showAddBotForm()">+ إضافة بوت جديد</button>
      <div id="bots-list" class="grid">
        ${bots.map(bot => `
          <div class="card">
            <h3>${bot.name}</h3>
            <p>السيرفر: ${bot.guild_id || 'غير محدد'}</p>
            <button onclick="deleteBotDialog('${bot.id}')">حذف</button>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function showAddBotForm() {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modal-content');
  
  content.innerHTML = `
    <h2>➕ إضافة بوت جديد</h2>
    <form id="add-bot-form">
      <div class="form-group">
        <label>اسم البوت</label>
        <input type="text" id="bot-name" required>
      </div>
      <div class="form-group">
        <label>توكن البوت</label>
        <input type="password" id="bot-token" required>
      </div>
      <div class="form-group">
        <label>معرف السيرفر (اختياري)</label>
        <input type="text" id="bot-guild">
      </div>
      <button type="submit" class="primary-btn">إضافة</button>
    </form>
  `;

  document.getElementById('add-bot-form').onsubmit = async (e) => {
    e.preventDefault();
    const result = await fetchAPI('/bots', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('bot-name').value,
        token: document.getElementById('bot-token').value,
        guild_id: document.getElementById('bot-guild').value || null
      })
    });
    if (result?.bot) {
      showSuccess('تم إضافة البوت');
      modal.classList.add('hidden');
      renderBots();
    } else {
      showError('فشل إضافة البوت');
    }
  };

  modal.classList.remove('hidden');
}

async function deleteBotDialog(botId) {
  if (confirm('هل تريد حذف هذا البوت؟')) {
    await fetchAPI(`/bots/${botId}`, { method: 'DELETE' });
    showSuccess('تم الحذف');
    renderBots();
  }
}

async function renderGames() {
  const content = document.getElementById('content');
  if (!content) return;

  const result = await fetchAPI('/games/sessions');
  const sessions = result?.sessions || [];

  content.innerHTML = `
    <section class="games-section">
      <h2>🎮 الألعاب</h2>
      <button class="primary-btn" onclick="showCreateGameForm()">+ جلسة جديدة</button>
      <div id="games-list" class="grid">
        ${sessions.map(session => `
          <div class="card">
            <h3>${session.name}</h3>
            <p>النوع: ${session.game_type}</p>
            <p>الحالة: ${session.status}</p>
            <button onclick="joinGame('${session.id}')">انضم</button>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function showCreateGameForm() {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modal-content');
  const games = ['uno', 'baloot', 'ludo', 'monopoly', 'jaccaro', 'codenames', 'maqousar'];
  
  content.innerHTML = `
    <h2>🎮 إنشاء جلسة لعبة</h2>
    <form id="create-game-form">
      <div class="form-group">
        <label>نوع اللعبة</label>
        <select id="game-type">
          ${games.map(g => `<option value="${g}">${g}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>اسم الجلسة (اختياري)</label>
        <input type="text" id="session-name">
      </div>
      <button type="submit" class="primary-btn">إنشاء</button>
    </form>
  `;

  document.getElementById('create-game-form').onsubmit = async (e) => {
    e.preventDefault();
    const result = await fetchAPI('/games/sessions', {
      method: 'POST',
      body: JSON.stringify({
        game_type: document.getElementById('game-type').value,
        name: document.getElementById('session-name').value || 'جلسة لعبة'
      })
    });
    if (result?.session) {
      showSuccess('تم إنشاء الجلسة');
      modal.classList.add('hidden');
      renderGames();
    }
  };

  modal.classList.remove('hidden');
}

async function joinGame(sessionId) {
  if (socket) {
    socket.emit('game:join', { sessionId, asSpectator: false });
    showSuccess('انضممت للجلسة');
  }
}

async function renderChat() {
  const content = document.getElementById('content');
  if (!content) return;

  const result = await fetchAPI('/community/chat');
  const messages = result?.messages || [];

  content.innerHTML = `
    <section class="chat-section">
      <h2>💬 الشات العام</h2>
      <div id="chat-messages" class="chat-box">
        ${messages.map(msg => `
          <div class="chat-message">
            <strong>${msg.username}:</strong> ${msg.content}
          </div>
        `).join('')}
      </div>
      <form id="chat-form">
        <input type="text" id="chat-input" placeholder="اكتب رسالتك..." required>
        <button type="submit" class="primary-btn">إرسال</button>
      </form>
    </section>
  `;

  document.getElementById('chat-form').onsubmit = async (e) => {
    e.preventDefault();
    const message = document.getElementById('chat-input').value.trim();
    if (message) {
      await fetchAPI('/community/chat', {
        method: 'POST',
        body: JSON.stringify({ content: message })
      });
      document.getElementById('chat-input').value = '';
      renderChat();
    }
  };
}

document.addEventListener('DOMContentLoaded', init);
