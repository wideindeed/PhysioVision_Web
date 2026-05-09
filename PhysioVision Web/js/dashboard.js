'use strict';

/* ══════════════════════════════════════════════
   1. AUTHENTICATION & TOKEN CATCHER
══════════════════════════════════════════════ */
(function checkAuth() {
  // Catch tokens from Google SSO redirect (URL Hash)
  const hash = window.location.hash.substring(1);
  if (hash) {
    const params = new URLSearchParams(hash);
    const access = params.get('access');
    const refresh = params.get('refresh');
    
    if (access && refresh) {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      // Clean the URL so it looks professional and hides the tokens
      window.history.replaceState(null, null, window.location.pathname); 
    }
  }

  // If no token exists at all, boot them back to login
  if (!localStorage.getItem('access_token')) {
    window.location.href = 'login.html';
  }
})();

/* ══════════════════════════════════════════════
   2. GLOBAL DATA VARIABLES (Overwritten by Pi)
══════════════════════════════════════════════ */
let USER = {
  name:     'Loading...',
  username: 'loading',
  streak:   0,
  stats: {
    sessions: 0,
    avgScore: 0,
    minutes:  0,
    flags:    0,
  }
};

let SESSIONS = [];
let chartData14 = [0];
let chartData30 = [0];

// ── JOINT HEALTH stub (Placeholder until built on Pi) ──────────
const JOINTS = [
  { name: 'Left Knee',    pct: 91 },
  { name: 'Right Knee',   pct: 85 },
  { name: 'Left Hip',     pct: 78 },
  { name: 'Right Hip',    pct: 82 },
  { name: 'Lower Back',   pct: 69 },
  { name: 'Left Shoulder',pct: 94 },
];

// ── TODAY'S PLAN stub (Placeholder until built on Pi) ──────────
const EXERCISES = [
  { name: 'Wall Sit',         detail: 'Quad strengthening',      sets: '3 × 45s',  done: true  },
  { name: 'Hip Flexor Stretch', detail: 'Mobility · both sides', sets: '2 × 60s',  done: false },
  { name: 'Glute Bridge',     detail: 'Posterior chain',         sets: '3 × 15',   done: false },
];


/* ══════════════════════════════════════════════
   3. DATA FETCHING (Talk to Raspberry Pi)
══════════════════════════════════════════════ */
async function loadDashboardData() {
  const token = localStorage.getItem('access_token');
  if (!token) return;

  try {
    const response = await fetch('https://api.physiovision.app/dashboard_data', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // Token expired! Boot them back to login.
      localStorage.removeItem('access_token');
      window.location.href = 'login.html';
      return;
    }

    const data = await response.json();

    if (data.status === 'success') {
      // 1. Overwrite USER data
      USER.name = data.user.first_name; 
      if (data.user.last_name) USER.name += " " + data.user.last_name;
      
      USER.stats = data.stats;

      // 2. Overwrite SESSIONS array
      SESSIONS.length = 0; 
      SESSIONS.push(...data.recent_sessions);

      // 3. Overwrite Chart Data
      chartData14 = data.chart_data_14 && data.chart_data_14.length ? data.chart_data_14 : [0];
      chartData30 = data.chart_data_30 && data.chart_data_30.length ? data.chart_data_30 : [0];
    }
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
  }
}


/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Fetch real data from the Raspberry Pi first!
  await loadDashboardData();

  // 2. Then draw the page using that data
  initUser();
  initGreeting();
  initStats();
  initSessions();
  initJoints();
  initExercises();
  initChart(chartData14);
  initNav();
  initSidebarToggle();
  setTopbarDate();
});


function initUser() {
  const nameEl   = document.getElementById('dash-name');
  const avatarEl = document.getElementById('dash-avatar');
  const welcomeEl= document.getElementById('welcome-name');
  const streakEl = document.getElementById('streak-count');

  if (nameEl)    nameEl.textContent    = USER.name;
  if (welcomeEl) welcomeEl.textContent = USER.name.split(' ')[0];
  if (streakEl)  streakEl.textContent  = USER.streak;
  if (avatarEl) {
    const parts = USER.name.trim().split(' ');
    avatarEl.textContent = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
}

function initGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('time-greeting');
  if (!el) return;
  if (h < 12)      el.textContent = 'morning';
  else if (h < 18) el.textContent = 'afternoon';
  else             el.textContent = 'evening';
}

function setTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

function initStats() {
  setText('stat-sessions', USER.stats.sessions);
  setText('stat-score',    USER.stats.avgScore);
  setText('stat-minutes',  USER.stats.minutes);
  setText('stat-flags',    USER.stats.flags);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const span = el.querySelector('span');
  el.firstChild && el.firstChild.nodeType === 3
    ? (el.firstChild.textContent = val)
    : el.prepend(document.createTextNode(val));
  if (!span) el.textContent = val;
  else { el.textContent = val; el.appendChild(span); }
}

function initSessions() {
  const list = document.getElementById('session-list');
  if (!list) return;
  
  if (SESSIONS.length === 0) {
      list.innerHTML = `<p style="color:var(--ink-faint); font-size: 13px; text-align: center; padding: 20px 0;">No sessions logged yet.</p>`;
      return;
  }

  list.innerHTML = SESSIONS.map(s => `
    <div class="session-row">
      <div class="session-dot" style="background:${s.color}"></div>
      <div class="session-meta">
        <p class="session-name">${s.name}</p>
        <p class="session-time">${s.date}</p>
      </div>
      <span class="session-score" style="color:${s.color}">${s.score}%</span>
    </div>
  `).join('');
}

function initJoints() {
  const list = document.getElementById('joint-list');
  if (!list) return;
  list.innerHTML = JOINTS.map(j => {
    const color = j.pct >= 85 ? '#3DAA6E' : j.pct >= 70 ? '#E8A020' : '#D94040';
    return `
      <div class="joint-row">
        <div class="joint-info">
          <span class="joint-name">${j.name}</span>
          <span class="joint-pct" style="color:${color}">${j.pct}%</span>
        </div>
        <div class="joint-bar">
          <div class="joint-fill" data-pct="${j.pct}" style="background:${color}"></div>
        </div>
      </div>
    `;
  }).join('');

  requestAnimationFrame(() => {
    document.querySelectorAll('.joint-fill').forEach(el => {
      el.style.width = el.dataset.pct + '%';
    });
  });
}

function initExercises() {
  const list     = document.getElementById('exercise-list');
  const badgeEl  = document.getElementById('plan-progress');
  if (!list) return;

  let doneCount = EXERCISES.filter(e => e.done).length;

  const updateBadge = () => {
    if (badgeEl) badgeEl.textContent = `${doneCount} / ${EXERCISES.length} done`;
  };

  updateBadge();

  list.innerHTML = EXERCISES.map((e, i) => `
    <div class="exercise-row ${e.done ? 'done' : ''}" data-index="${i}">
      <div class="exercise-check">
        ${e.done ? '<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
      </div>
      <div class="exercise-meta">
        <p class="exercise-name">${e.name}</p>
        <p class="exercise-detail">${e.detail}</p>
      </div>
      <span class="exercise-sets">${e.sets}</span>
    </div>
  `).join('');

  list.querySelectorAll('.exercise-row').forEach(row => {
    row.addEventListener('click', () => {
      const i = +row.dataset.index;
      EXERCISES[i].done = !EXERCISES[i].done;
      doneCount = EXERCISES.filter(e => e.done).length;
      updateBadge();
      initExercises();
    });
  });
}


/* ══════════════════════════════════════════════
   CANVAS CHART (no external library)
══════════════════════════════════════════════ */
let chartData = chartData14;

function initChart(data) {
  chartData = data;
  drawChart(data);
}

function drawChart(data) {
  const canvas = document.getElementById('score-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const W = canvas.offsetWidth;
  const H = 160;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const minVal = Math.max(0,  Math.min(...data) - 10);
  const maxVal = Math.min(100, Math.max(...data) + 5);

  function xPos(i) { 
      if (data.length <= 1) return pad.left + plotW / 2;
      return pad.left + (i / (data.length - 1)) * plotW; 
  }
  function yPos(val) { 
      if (maxVal === minVal) return pad.top + plotH / 2;
      return pad.top + plotH - ((val - minVal) / (maxVal - minVal)) * plotH; 
  }

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  [0, 0.25, 0.5, 0.75, 1].forEach(t => {
    const y = pad.top + t * plotH;
    const val = Math.round(maxVal - t * (maxVal - minVal));
    ctx.beginPath();
    ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#A0A0A5';
    ctx.font = '500 10px DM Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val + '%', pad.left - 6, y + 4);
  });

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  grad.addColorStop(0, 'rgba(232,66,10,0.18)');
  grad.addColorStop(1, 'rgba(232,66,10,0)');

  ctx.beginPath();
  data.forEach((v, i) => {
    i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v));
  });
  
  if (data.length > 1) {
      ctx.lineTo(xPos(data.length - 1), pad.top + plotH);
      ctx.lineTo(xPos(0), pad.top + plotH);
  } else {
      ctx.lineTo(xPos(0), pad.top + plotH);
  }
  
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  data.forEach((v, i) => {
    i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v));
  });
  ctx.strokeStyle = '#E8420A';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dots on key points (first, last, min, max)
  const keyIdxs = new Set([0, data.length - 1,
    data.indexOf(Math.min(...data)), data.indexOf(Math.max(...data))]);
  keyIdxs.forEach(i => {
    ctx.beginPath();
    ctx.arc(xPos(i), yPos(data[i]), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#E8420A';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // X axis labels (sparse)
  const step = Math.max(1, Math.ceil(data.length / 7));
  ctx.fillStyle = '#A0A0A5';
  ctx.font = '500 10px DM Mono, monospace';
  ctx.textAlign = 'center';
  data.forEach((_, i) => {
    if (i % step === 0 || i === data.length - 1) {
      ctx.fillText(`#${i + 1}`, xPos(i), H - 6);
    }
  });
}

// Resize chart
window.addEventListener('resize', () => drawChart(chartData));

// Chart tab switching
document.querySelectorAll('.chart-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    initChart(btn.dataset.range === '14' ? chartData14 : chartData30);
  });
});


/* ══════════════════════════════════════════════
   NAV & SIDEBAR
══════════════════════════════════════════════ */
function initNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const page = item.dataset.page;
      const titleEl = document.getElementById('page-title');
      if (titleEl) titleEl.textContent = item.textContent.trim();
      if (window.innerWidth <= 860) {
        document.getElementById('sidebar')?.classList.remove('open');
      }
    });
  });
}

function initSidebarToggle() {
  const toggle  = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  document.addEventListener('click', e => {
    if (window.innerWidth <= 860 &&
        !sidebar.contains(e.target) &&
        !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

/* ══════════════════════════════════════════════
   BUTTON HANDLERS
══════════════════════════════════════════════ */
document.getElementById('new-session-btn')?.addEventListener('click', () => {
  alert('Session start — connect to your Pi backend here.');
});

// LOGOUT BUTTON
document.querySelector('.signout-btn')?.addEventListener('click', () => {
   localStorage.removeItem('access_token');
   localStorage.removeItem('refresh_token');
   window.location.href = 'login.html';
});