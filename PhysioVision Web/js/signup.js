/* ============================================================
   PHYSIO-VISION — signup.js
   Form validation, password strength, EULA gate, field UX
   ============================================================ */

'use strict';

// ── COUNTRY LIST ─────────────────────────────────────────────
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Bulgaria','Burkina Faso',
  'Cambodia','Cameroon','Canada','Chile','China','Colombia','Congo','Costa Rica',
  'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Dominican Republic','Ecuador',
  'Egypt','El Salvador','Estonia','Ethiopia','Finland','France','Georgia','Germany',
  'Ghana','Greece','Guatemala','Honduras','Hungary','India','Indonesia','Iran','Iraq',
  'Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kosovo',
  'Kuwait','Latvia','Lebanon','Libya','Lithuania','Luxembourg','Madagascar','Malaysia',
  'Maldives','Mali','Malta','Mexico','Moldova','Mongolia','Montenegro','Morocco',
  'Mozambique','Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nicaragua',
  'Niger','Nigeria','North Macedonia','Norway','Oman','Pakistan','Palestine','Panama',
  'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia',
  'Rwanda','Saudi Arabia','Senegal','Serbia','Singapore','Slovakia','Slovenia',
  'Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden',
  'Switzerland','Syria','Taiwan','Tanzania','Thailand','Tunisia','Turkey','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
  'Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
];

(function populateCountries() {
  const select = document.getElementById('country');
  if (!select) return;
  COUNTRIES.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
})();


// ── PASSWORD STRENGTH ─────────────────────────────────────────
(function initPasswordStrength() {
  const input  = document.getElementById('password');
  const bars   = document.querySelectorAll('.pw-bar');
  const label  = document.querySelector('.pw-label');
  if (!input || !bars.length) return;

  function score(pw) {
    let s = 0;
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s; // 0-5
  }

  const LEVELS = [
    { max: 1, cls: 'weak',   txt: 'Too weak',       color: '#E55' },
    { max: 3, cls: 'ok',     txt: 'Could be better', color: '#E8A020' },
    { max: 5, cls: 'strong', txt: 'Strong',          color: '#3DAA6E' },
  ];

  input.addEventListener('input', () => {
    const s   = score(input.value);
    const lvl = LEVELS.find((l) => s <= l.max) || LEVELS[2];
    const filled = input.value.length > 0 ? Math.ceil((s / 5) * bars.length) : 0;

    bars.forEach((b, i) => {
      b.className = 'pw-bar';
      if (i < filled) b.classList.add(lvl.cls);
    });

    if (label) {
      label.textContent = input.value.length > 0 ? lvl.txt : '';
      label.style.color = lvl.color;
    }
  });
})();


// ── FORM VALIDATION ───────────────────────────────────────────
(function initValidation() {
  const form   = document.getElementById('signup-form');
  const submit = document.getElementById('btn-submit');
  const eula   = document.getElementById('eula');
  if (!form) return;

  // Enable/disable submit based on EULA
  if (eula && submit) {
    const check = () => { submit.disabled = !eula.checked; };
    eula.addEventListener('change', check);
    check();
  }

  // Validate a single field
  function validateField(input) {
    const group = input.closest('.form-group');
    if (!group) return true;

    const errEl = group.querySelector('.error-msg');
    let   msg   = '';

    if (input.required && !input.value.trim()) {
      msg = 'This field is required.';
    } else if (input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
      msg = 'Please enter a valid email address.';
    } else if (input.id === 'username' && input.value && !/^[a-zA-Z0-9_]{3,20}$/.test(input.value)) {
      msg = '3–20 characters, letters, numbers, and underscores only.';
    } else if (input.id === 'password' && input.value && input.value.length < 8) {
      msg = 'Password must be at least 8 characters.';
    } else if (input.id === 'height' && input.value && (input.value < 50 || input.value > 280)) {
      msg = 'Please enter a height between 50 and 280 cm.';
    } else if (input.id === 'weight' && input.value && (input.value < 10 || input.value > 500)) {
      msg = 'Please enter a weight between 10 and 500 kg.';
    }

    group.classList.toggle('error', !!msg);
    if (errEl) errEl.textContent = msg;
    return !msg;
  }

  // Inline validation on blur
  form.querySelectorAll('.form-input, .form-select').forEach((input) => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.closest('.form-group')?.classList.contains('error')) {
        validateField(input);
      }
    });
  });

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    form.querySelectorAll('.form-input[required], .form-select[required]').forEach((input) => {
      if (!validateField(input)) valid = false;
    });

    if (!eula?.checked) {
      valid = false;
      const eulaGroup = eula?.closest('.form-group');
      if (eulaGroup) {
        eulaGroup.classList.add('error');
        const errEl = eulaGroup.querySelector('.error-msg');
        if (errEl) errEl.textContent = 'You must accept the EULA to continue.';
      }
    }

    if (!valid) return;

    // All valid — hand off to your backend here
    // Example: fetch('/api/register', { method: 'POST', body: new FormData(form) })

    submit.textContent = 'Creating account…';
    submit.disabled = true;

    // Simulate for demo — remove in production
    setTimeout(() => {
      submit.textContent = '✓ Account Created';
      submit.style.background = '#3DAA6E';
    }, 1500);
  });
})();


// ── USERNAME AVAILABILITY (stub) ─────────────────────────────
// Wire this to your backend endpoint
(function initUsernameCheck() {
  const input = document.getElementById('username');
  const hint  = document.getElementById('username-hint');
  if (!input || !hint) return;

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const val = input.value.trim();
    if (val.length < 3) { hint.textContent = ''; return; }

    hint.textContent = 'Checking…';
    hint.style.color = 'var(--ink-faint)';

    timer = setTimeout(() => {
      // TODO: replace with real fetch to /api/check-username?u=val
      // Stub: usernames starting with 'admin' are taken
      if (val.toLowerCase().startsWith('admin')) {
        hint.textContent = '✗ Username already taken';
        hint.style.color = '#D94040';
        input.closest('.form-group')?.classList.add('error');
      } else {
        hint.textContent = '✓ Username available';
        hint.style.color = '#3DAA6E';
        input.closest('.form-group')?.classList.remove('error');
      }
    }, 600);
  });
})();
