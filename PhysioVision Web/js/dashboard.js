'use strict';

(function checkAuth() {
  const hash = window.location.hash.substring(1);
  if (hash) {
    const params = new URLSearchParams(hash);
    const access = params.get('access');
    const refresh = params.get('refresh');
    if (access && refresh) {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      window.history.replaceState(null, null, window.location.pathname);
    }
  }
  if (!localStorage.getItem('access_token')) {
    window.location.href = 'login.html';
  }
})();

const API = 'https://api.physiovision.app';
let USER = { name: 'Loading...', streak: 0, stats: { total_sessions: 0, avg_score: 0, active_minutes: 0 } };
let SESSIONS = [];
let ALL_SESSIONS = [];
let chartData14 = [0];
let chartData30 = [0];
let sessionPage = 1;
let sessionSort = { key: 'date', asc: false };
const PER_PAGE = 15;

const BADGE_DEFS = [
  { id: 'first_rep', name: 'First Rep', icon: '\u{1F3C1}', desc: 'Complete your first repetition' },
  { id: 'ten_sessions', name: 'Consistent', icon: '\u{1F51F}', desc: 'Complete 10 sessions' },
  { id: 'fifty_sessions', name: 'Dedicated', icon: '\u{1F3C5}', desc: 'Complete 50 sessions' },
  { id: 'hundred_sessions', name: 'Centurion', icon: '\u{1F4AF}', desc: 'Complete 100 sessions' },
  { id: 'perfect_score', name: 'Flawless', icon: '⭐', desc: 'Achieve a perfect form score' },
  { id: 'high_scorer', name: 'High Performer', icon: '\u{1F4C8}', desc: '10+ sessions with avg score ≥ 90' },
  { id: 'all_rounder', name: 'All-Rounder', icon: '\u{1F3AF}', desc: 'Complete 5+ different exercises' },
  { id: 'pain_warrior', name: 'Pain Warrior', icon: '\u{1F6E1}️', desc: 'Exercise while managing pain' },
  { id: 'hundred_reps', name: 'The Century', icon: '\u{1F4AA}', desc: 'Reach 100 total reps' },
  { id: 'five_hundred_reps', name: 'Iron Will', icon: '\u{1F9BE}', desc: 'Reach 500 total reps' },
  { id: 'comeback_kid', name: 'Comeback Kid', icon: '\u{1F501}', desc: 'Return after a 7+ day break' },
  { id: 'streak_7', name: '7-Day Streak', icon: '\u{1F525}', desc: 'Exercise 7 days in a row' },
];

const ACHIEVEMENT_SERVER_DEFS = {};
BADGE_DEFS.forEach(d => { ACHIEVEMENT_SERVER_DEFS[d.id] = d; });
const TIER_MAP = {
  first_rep: 'bronze', ten_sessions: 'bronze', fifty_sessions: 'silver',
  hundred_sessions: 'gold', perfect_score: 'gold', high_scorer: 'gold',
  all_rounder: 'silver', pain_warrior: 'bronze', hundred_reps: 'silver',
  five_hundred_reps: 'gold', comeback_kid: 'bronze', streak_7: 'silver',
};
Object.keys(TIER_MAP).forEach(k => { if (ACHIEVEMENT_SERVER_DEFS[k]) ACHIEVEMENT_SERVER_DEFS[k].tier = TIER_MAP[k]; });

const EB_COLORS = ['#6C5CE7', '#00B894', '#0984E3', '#E17055', '#FDCB6E', '#00CEC9', '#A29BFE', '#D63031'];

function getToken() { return localStorage.getItem('access_token'); }

function handle401(res) {
  if (res.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
    return true;
  }
  return false;
}

async function apiFetch(path) {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(API + path, {
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    if (handle401(res)) return null;
    if (res.status === 404) return { _empty: true };
    return await res.json();
  } catch (e) {
    console.error('API error:', path, e);
    return null;
  }
}

async function loadDashboardData() {
  const data = await apiFetch('/dashboard_data');
  if (!data || data._empty) return;
  if (data.status === 'success') {
    USER.name = data.user?.first_name || data.user?.username || 'User';
    USER.stats = data.stats || {};
    USER.streak = data.stats?.streak || 0;
    SESSIONS = data.recent_sessions || [];
    chartData14 = data.chart_data_14 && data.chart_data_14.length ? data.chart_data_14 : [0];
    chartData30 = data.chart_data_30 && data.chart_data_30.length ? data.chart_data_30 : [0];
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  renderUser();
  renderStats();
  renderRecentSessions();
  initChart(chartData14);
  initNav();
  initSidebarToggle();
  setTopbarDate();
  loadAchievements();
  await loadHistory();
  renderExerciseBreakdown();
  renderPersonalBests();
  renderWeeklyHeatmap();
  loadGoals();
  loadPainHistory();
});

function renderUser() {
  const nameEl = document.getElementById('dash-name');
  const avatarEl = document.getElementById('dash-avatar');
  if (nameEl) nameEl.textContent = PV ? PV.escapeHTML(USER.name) : USER.name;
  if (avatarEl) {
    const parts = USER.name.trim().split(' ');
    avatarEl.textContent = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
}

function setTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (el) el.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

function renderStats() {
  setStatText('stat-sessions', USER.stats.total_sessions);
  setStatText('stat-score', USER.stats.avg_score);
  setStatText('stat-minutes', USER.stats.active_minutes);

  const streakEl = document.getElementById('stat-streak');
  if (streakEl) {
    const s = computeStreak();
    streakEl.textContent = s + (s === 1 ? ' day' : ' days');
  }
}

function computeStreak() {
  if (!ALL_SESSIONS.length) return USER.streak || 0;
  const dates = ALL_SESSIONS.map(s => {
    try { return new Date(s.date).toISOString().slice(0, 10); } catch { return null; }
  }).filter(Boolean);
  const unique = [...new Set(dates)].sort().reverse();
  if (!unique.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const diff = (new Date(unique[i - 1]) - new Date(unique[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function setStatText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderRecentSessions() {
  const container = document.getElementById('recent-sessions');
  if (!container) return;
  container.innerHTML = '';
  if (!SESSIONS.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No sessions logged yet.';
    container.appendChild(p);
    return;
  }
  const colorMap = { green: '#00B894', amber: '#E17055', red: '#D63031' };
  SESSIONS.slice(0, 5).forEach(s => {
    const row = document.createElement('div');
    row.className = 'session-row';
    const dot = document.createElement('div');
    dot.className = 'session-dot';
    const score = s.score || 0;
    const dotColor = score >= 80 ? colorMap.green : score >= 60 ? colorMap.amber : colorMap.red;
    const safeColor = PV ? PV.validateColorValue(dotColor, '#6C5CE7') : dotColor;
    dot.style.background = safeColor;
    const meta = document.createElement('div');
    meta.className = 'session-meta';
    const name = document.createElement('p');
    name.className = 'session-name';
    name.textContent = s.name || 'Unknown';
    const time = document.createElement('p');
    time.className = 'session-time';
    time.textContent = s.date || '';
    meta.appendChild(name);
    meta.appendChild(time);
    const scoreEl = document.createElement('span');
    scoreEl.className = 'session-score';
    scoreEl.style.color = safeColor;
    scoreEl.textContent = score + '%';
    row.appendChild(dot);
    row.appendChild(meta);
    row.appendChild(scoreEl);
    container.appendChild(row);
  });
}

function renderExerciseBreakdown() {
  const container = document.getElementById('exercise-breakdown');
  if (!container) return;
  container.innerHTML = '';

  if (!ALL_SESSIONS.length) {
    container.innerHTML = '<p class="empty-state">No data yet.</p>';
    return;
  }

  const counts = {};
  ALL_SESSIONS.forEach(s => {
    const name = s.exercise || s.name || 'Unknown';
    counts[name] = (counts[name] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  sorted.slice(0, 6).forEach(([name, count], i) => {
    const row = document.createElement('div');
    row.className = 'eb-row';

    const label = document.createElement('span');
    label.className = 'eb-label';
    label.textContent = name.replace(/_/g, ' ');

    const barWrap = document.createElement('div');
    barWrap.className = 'eb-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'eb-bar';
    bar.style.width = Math.round((count / max) * 100) + '%';
    bar.style.background = EB_COLORS[i % EB_COLORS.length];
    barWrap.appendChild(bar);

    const countEl = document.createElement('span');
    countEl.className = 'eb-count';
    countEl.textContent = count;

    row.appendChild(label);
    row.appendChild(barWrap);
    row.appendChild(countEl);
    container.appendChild(row);
  });
}

function renderPersonalBests() {
  const container = document.getElementById('personal-bests');
  if (!container) return;
  container.innerHTML = '';

  if (!ALL_SESSIONS.length) {
    container.innerHTML = '<p class="empty-state">No data yet.</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'pb-grid';

  const bestScore = Math.max(...ALL_SESSIONS.map(s => s.score || 0));
  const bestSession = ALL_SESSIONS.find(s => s.score === bestScore);
  const totalReps = ALL_SESSIONS.reduce((sum, s) => sum + (s.reps || 0), 0);
  const uniqueExercises = new Set(ALL_SESSIONS.map(s => s.exercise || s.name || '')).size;
  const maxRepsSession = ALL_SESSIONS.reduce((max, s) => (s.reps || 0) > (max.reps || 0) ? s : max, ALL_SESSIONS[0]);

  const bests = [
    { icon: '⭐', iconClass: 'gold', title: 'Best Score', detail: bestSession ? (bestSession.exercise || bestSession.name || '') .replace(/_/g, ' ') : '', value: bestScore + '%', valueClass: 'amber' },
    { icon: '\u{1F4AA}', iconClass: 'purple', title: 'Total Reps', detail: 'Across all sessions', value: totalReps.toLocaleString(), valueClass: 'accent' },
    { icon: '\u{1F3AF}', iconClass: 'green', title: 'Exercises Tried', detail: 'Unique exercises', value: String(uniqueExercises), valueClass: 'green' },
    { icon: '\u{1F525}', iconClass: 'blue', title: 'Most Reps (Single)', detail: maxRepsSession ? (maxRepsSession.exercise || maxRepsSession.name || '').replace(/_/g, ' ') : '', value: String(maxRepsSession?.reps || 0), valueClass: 'blue' },
  ];

  bests.forEach(b => {
    const row = document.createElement('div');
    row.className = 'pb-row';

    const icon = document.createElement('div');
    icon.className = 'pb-icon ' + b.iconClass;
    icon.textContent = b.icon;

    const info = document.createElement('div');
    info.className = 'pb-info';
    const title = document.createElement('p');
    title.className = 'pb-title';
    title.textContent = b.title;
    const detail = document.createElement('p');
    detail.className = 'pb-detail';
    detail.textContent = b.detail;
    info.appendChild(title);
    info.appendChild(detail);

    const value = document.createElement('span');
    value.className = 'pb-value ' + b.valueClass;
    value.textContent = b.value;

    row.appendChild(icon);
    row.appendChild(info);
    row.appendChild(value);
    grid.appendChild(row);
  });

  container.appendChild(grid);
}

function renderWeeklyHeatmap() {
  const container = document.getElementById('weekly-heatmap');
  const summaryEl = document.getElementById('activity-summary');
  if (!container) return;
  container.innerHTML = '';

  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  const dateCounts = {};
  ALL_SESSIONS.forEach(s => {
    try {
      const key = new Date(s.date).toISOString().slice(0, 10);
      dateCounts[key] = (dateCounts[key] || 0) + 1;
    } catch {}
  });

  let weekTotal = 0;
  days.forEach(d => {
    const key = d.toISOString().slice(0, 10);
    const count = dateCounts[key] || 0;
    weekTotal += count;

    const cell = document.createElement('div');
    const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : 3;
    cell.className = 'heatmap-day hm-' + level;

    const dayLabel = document.createElement('span');
    dayLabel.className = 'day-label';
    dayLabel.textContent = dayNames[d.getDay()];

    const dayCount = document.createElement('span');
    dayCount.className = 'day-count';
    dayCount.textContent = count;

    const dayDate = document.createElement('span');
    dayDate.className = 'day-date';
    dayDate.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    cell.appendChild(dayLabel);
    cell.appendChild(dayCount);
    cell.appendChild(dayDate);
    container.appendChild(cell);
  });

  if (summaryEl) {
    summaryEl.textContent = weekTotal + ' session' + (weekTotal !== 1 ? 's' : '') + ' this week';
  }
}

async function loadAchievements() {
  const data = await apiFetch('/get_achievements');
  const grid = document.getElementById('achievements-grid');
  const preview = document.getElementById('recent-achievements');
  if (!grid) return;
  grid.innerHTML = '';
  const earned = (data && !data._empty && Array.isArray(data.achievements)) ? data.achievements : [];
  const earnedMap = {};
  earned.forEach(a => {
    const key = a.achievement_key || a.id || a.name?.toLowerCase().replace(/\s/g,'_');
    const def = ACHIEVEMENT_SERVER_DEFS[key];
    earnedMap[key] = { ...a, tier: def?.tier || a.tier || 'bronze' };
  });
  let previewCount = 0;
  BADGE_DEFS.forEach(def => {
    const a = earnedMap[def.id];
    const card = document.createElement('div');
    card.className = 'badge-card' + (a ? ' tier-' + (a.tier || 'bronze').toLowerCase() : ' badge-locked');
    const icon = document.createElement('div');
    icon.className = 'badge-icon';
    icon.textContent = def.icon;
    const info = document.createElement('div');
    info.className = 'badge-info';
    const nameEl = document.createElement('p');
    nameEl.className = 'badge-name';
    nameEl.textContent = def.name;
    const descEl = document.createElement('p');
    descEl.className = 'badge-desc';
    descEl.textContent = a ? (a.tier || 'Bronze') + ' tier' : def.desc;
    info.appendChild(nameEl);
    info.appendChild(descEl);
    card.appendChild(icon);
    card.appendChild(info);
    grid.appendChild(card);
    if (a && preview && previewCount < 3) {
      const mini = card.cloneNode(true);
      preview.appendChild(mini);
      previewCount++;
    }
  });
  if (preview && previewCount === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No achievements earned yet.';
    preview.appendChild(p);
  }
}

async function loadHistory() {
  const data = await apiFetch('/get_history');
  if (!data || data._empty) {
    ALL_SESSIONS = [];
    renderSessionsEmpty();
    return;
  }
  ALL_SESSIONS = Array.isArray(data.history) ? data.history : (Array.isArray(data.sessions) ? data.sessions : (Array.isArray(data) ? data : []));
  populateFilter();
  renderSessionTable();
}

function populateFilter() {
  const sel = document.getElementById('session-filter');
  if (!sel) return;
  const exercises = [...new Set(ALL_SESSIONS.map(s => s.exercise || s.name || ''))].filter(Boolean).sort();
  sel.innerHTML = '';
  const all = document.createElement('option');
  all.value = '';
  all.textContent = 'All Exercises';
  sel.appendChild(all);
  exercises.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => { sessionPage = 1; renderSessionTable(); });
}

function getFilteredSessions() {
  const f = document.getElementById('session-filter')?.value || '';
  let list = f ? ALL_SESSIONS.filter(s => (s.exercise || s.name) === f) : [...ALL_SESSIONS];
  list.sort((a, b) => {
    let va = a[sessionSort.key] || '';
    let vb = b[sessionSort.key] || '';
    if (sessionSort.key === 'score') { va = +va; vb = +vb; }
    if (sessionSort.key === 'date') { va = new Date(va); vb = new Date(vb); }
    if (va < vb) return sessionSort.asc ? -1 : 1;
    if (va > vb) return sessionSort.asc ? 1 : -1;
    return 0;
  });
  return list;
}

function renderSessionTable() {
  const tbody = document.getElementById('session-tbody');
  const countEl = document.getElementById('session-count');
  if (!tbody) return;
  tbody.innerHTML = '';
  const filtered = getFilteredSessions();
  if (countEl) countEl.textContent = filtered.length + ' session' + (filtered.length !== 1 ? 's' : '');
  const pages = Math.ceil(filtered.length / PER_PAGE) || 1;
  if (sessionPage > pages) sessionPage = pages;
  const start = (sessionPage - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);
  if (!slice.length) { renderSessionsEmpty(); return; }
  slice.forEach(s => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = s.exercise || s.name || '';
    const td2 = document.createElement('td'); td2.textContent = s.date || '';
    const td3 = document.createElement('td'); td3.textContent = s.score != null ? s.score + '%' : '-';
    const td4 = document.createElement('td'); td4.textContent = s.reps != null ? s.reps : '-';
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
    tbody.appendChild(tr);
  });
  renderPagination(pages);
}

function renderSessionsEmpty() {
  const tbody = document.getElementById('session-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 4;
  td.className = 'empty-state';
  td.textContent = 'No session data yet.';
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function renderPagination(pages) {
  const container = document.getElementById('session-pagination');
  if (!container) return;
  container.innerHTML = '';
  if (pages <= 1) return;
  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.textContent = '← Prev';
  prev.disabled = sessionPage <= 1;
  prev.addEventListener('click', () => { sessionPage--; renderSessionTable(); });
  const info = document.createElement('span');
  info.className = 'page-info';
  info.textContent = sessionPage + ' / ' + pages;
  const next = document.createElement('button');
  next.className = 'page-btn';
  next.textContent = 'Next →';
  next.disabled = sessionPage >= pages;
  next.addEventListener('click', () => { sessionPage++; renderSessionTable(); });
  container.appendChild(prev);
  container.appendChild(info);
  container.appendChild(next);
}

document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sort;
    if (sessionSort.key === key) sessionSort.asc = !sessionSort.asc;
    else { sessionSort.key = key; sessionSort.asc = true; }
    sessionPage = 1;
    renderSessionTable();
  });
});

async function loadGoals() {
  const data = await apiFetch('/get_goals');
  const container = document.getElementById('goals-list');
  if (!container) return;
  container.innerHTML = '';
  const goals = (data && !data._empty) ? (Array.isArray(data.goals) ? data.goals : (Array.isArray(data) ? data : [])) : [];
  if (!goals.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No goals set yet.';
    container.appendChild(p);
    return;
  }
  goals.forEach(g => {
    const card = document.createElement('div');
    card.className = 'goal-card';
    const header = document.createElement('div');
    header.className = 'goal-header';
    const name = document.createElement('span');
    name.className = 'goal-name';
    name.textContent = (g.exercise || '').replace(/_/g, ' ') + ' (' + g.goal_type + ')';
    const pct = document.createElement('span');
    pct.className = 'goal-pct';
    const progress = g.target_value ? Math.min(100, Math.round(((g.current_value || 0) / g.target_value) * 100)) : 0;
    pct.textContent = progress + '%';
    if (g.is_completed) pct.style.color = 'var(--green)';
    header.appendChild(name);
    header.appendChild(pct);
    const barWrap = document.createElement('div');
    barWrap.className = 'progress-bar';
    const barFill = document.createElement('div');
    barFill.className = 'progress-fill';
    barFill.style.width = progress + '%';
    if (g.is_completed) barFill.style.background = 'linear-gradient(90deg, var(--green), #55EFC4)';
    barWrap.appendChild(barFill);
    const detail = document.createElement('p');
    detail.className = 'goal-detail';
    detail.textContent = (g.current_value || 0) + ' / ' + (g.target_value || 0) + (g.deadline ? ' · due ' + g.deadline : '');
    card.appendChild(header);
    card.appendChild(barWrap);
    card.appendChild(detail);
    container.appendChild(card);
  });
}

async function loadPainHistory() {
  const container = document.getElementById('pain-list');
  if (!container) return;
  container.innerHTML = '';
  const entries = ALL_SESSIONS.filter(s => s.pain_level && s.pain_level > 0);
  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No pain data recorded yet.';
    container.appendChild(p);
    return;
  }
  entries.forEach(e => {
    const entry = document.createElement('div');
    entry.className = 'pain-entry';
    const level = +(e.pain_level || 0);
    const colorClass = level <= 3 ? 'pain-low' : level <= 6 ? 'pain-mid' : 'pain-high';
    const badge = document.createElement('div');
    badge.className = 'pain-badge ' + colorClass;
    badge.textContent = level;
    const info = document.createElement('div');
    info.className = 'pain-info';
    const name = document.createElement('p');
    name.className = 'pain-exercise';
    name.textContent = e.exercise || 'Unknown';
    const date = document.createElement('p');
    date.className = 'pain-date';
    date.textContent = e.date || '';
    info.appendChild(name);
    info.appendChild(date);
    entry.appendChild(badge);
    entry.appendChild(info);
    container.appendChild(entry);
  });
}

let chartDataCurrent = chartData14;
function initChart(data) { chartDataCurrent = data; drawChart(data); }

function drawChart(data) {
  const canvas = document.getElementById('score-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth;
  const H = 180;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  const pad = { top: 20, right: 20, bottom: 32, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const minVal = Math.max(0, Math.min(...data) - 10);
  const maxVal = Math.min(100, Math.max(...data) + 5);
  function xPos(i) { return data.length <= 1 ? pad.left + plotW / 2 : pad.left + (i / (data.length - 1)) * plotW; }
  function yPos(val) { return maxVal === minVal ? pad.top + plotH / 2 : pad.top + plotH - ((val - minVal) / (maxVal - minVal)) * plotH; }

  ctx.clearRect(0, 0, W, H);

  [0, 0.25, 0.5, 0.75, 1].forEach(t => {
    const y = pad.top + t * plotH;
    const val = Math.round(maxVal - t * (maxVal - minVal));
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y);
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#9D9DA8'; ctx.font = '500 10px DM Mono, monospace'; ctx.textAlign = 'right';
    ctx.fillText(val + '%', pad.left - 8, y + 4);
  });

  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  grad.addColorStop(0, 'rgba(108,92,231,0.18)');
  grad.addColorStop(0.5, 'rgba(108,92,231,0.06)');
  grad.addColorStop(1, 'rgba(108,92,231,0)');

  if (data.length > 1) {
    ctx.beginPath();
    data.forEach((v, i) => { i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)); });
    ctx.lineTo(xPos(data.length - 1), pad.top + plotH);
    ctx.lineTo(xPos(0), pad.top + plotH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  }

  ctx.beginPath();
  data.forEach((v, i) => { i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)); });
  ctx.strokeStyle = '#6C5CE7'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

  const keyIdxs = new Set([0, data.length - 1, data.indexOf(Math.min(...data)), data.indexOf(Math.max(...data))]);
  keyIdxs.forEach(i => {
    ctx.beginPath(); ctx.arc(xPos(i), yPos(data[i]), 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(xPos(i), yPos(data[i]), 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#6C5CE7'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(xPos(i), yPos(data[i]), 2, 0, Math.PI * 2);
    ctx.fillStyle = '#6C5CE7'; ctx.fill();
  });

  const step = Math.max(1, Math.ceil(data.length / 7));
  ctx.fillStyle = '#9D9DA8'; ctx.font = '500 10px DM Mono, monospace'; ctx.textAlign = 'center';
  data.forEach((_, i) => { if (i % step === 0 || i === data.length - 1) ctx.fillText('#' + (i + 1), xPos(i), H - 8); });
}

window.addEventListener('resize', () => drawChart(chartDataCurrent));

document.querySelectorAll('.chart-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    initChart(btn.dataset.range === '14' ? chartData14 : chartData30);
  });
});

function initNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const page = item.dataset.page;
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      const tab = document.getElementById('tab-' + page);
      if (tab) tab.classList.add('active');
      const titleEl = document.getElementById('page-title');
      if (titleEl) titleEl.textContent = item.textContent.trim();
      if (window.innerWidth <= 860) document.getElementById('sidebar')?.classList.remove('open');
    });
  });
}

function initSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (window.innerWidth <= 860 && !sidebar.contains(e.target) && !toggle.contains(e.target))
      sidebar.classList.remove('open');
  });
}

document.querySelector('.signout-btn')?.addEventListener('click', () => {
  if (typeof PV !== 'undefined' && PV.logout) { PV.logout(); return; }
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
});
