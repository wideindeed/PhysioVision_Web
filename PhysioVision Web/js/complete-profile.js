'use strict';

/* ── COUNTRY LIST ── */
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
  COUNTRIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    select.appendChild(opt);
  });
})();


/* ── LOAD IDENTITY FROM TOKEN ──
   In production, decode the ?token= query param from your Pi and
   populate these fields. This stub reads URL params for demo purposes. */
(function loadIdentity() {
  const params = new URLSearchParams(window.location.search);
  const name   = params.get('name')  || 'Jane Doe';
  const email  = params.get('email') || 'jane@gmail.com';

  const nameEl   = document.getElementById('identity-name');
  const emailEl  = document.getElementById('identity-email');
  const avatarEl = document.getElementById('identity-avatar');

  if (nameEl)   nameEl.textContent  = name;
  if (emailEl)  emailEl.textContent = email;
  if (avatarEl) {
    const parts = name.trim().split(' ');
    avatarEl.textContent = (
      (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
    ).toUpperCase() || '??';
  }
})();


/* ── USERNAME AVAILABILITY CHECK ── */
(function initUsernameCheck() {
  const input = document.getElementById('username');
  const hint  = document.getElementById('username-hint');
  if (!input || !hint) return;

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const val = input.value.trim();
    if (val.length < 3) { hint.textContent = ''; return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(val)) return;

    hint.textContent = 'Checking…';
    hint.style.color = 'var(--ink-faint)';

    timer = setTimeout(() => {
      // TODO: replace with real fetch('/api/check-username?u=' + val)
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


/* ── FORM VALIDATION & SUBMIT ── */
(function initForm() {
  const form   = document.getElementById('cp-form');
  const submit = document.getElementById('btn-submit');
  const eula   = document.getElementById('eula');
  if (!form) return;

  if (eula && submit) {
    eula.addEventListener('change', () => { submit.disabled = !eula.checked; });
  }

  function validateField(input) {
    const group = input.closest('.form-group');
    if (!group) return true;
    const errEl = group.querySelector('.error-msg');
    let msg = '';

    if (input.required && !input.value.trim()) {
      msg = 'This field is required.';
    } else if (input.id === 'username' && input.value && !/^[a-zA-Z0-9_]{3,20}$/.test(input.value)) {
      msg = '3–20 characters, letters, numbers, and underscores only.';
    } else if (input.id === 'height' && input.value && (input.value < 50 || input.value > 280)) {
      msg = 'Please enter a height between 50 and 280 cm.';
    } else if (input.id === 'weight' && input.value && (input.value < 10 || input.value > 500)) {
      msg = 'Please enter a weight between 10 and 500 kg.';
    }

    group.classList.toggle('error', !!msg);
    if (errEl) errEl.textContent = msg;
    return !msg;
  }

  form.querySelectorAll('.form-input, .form-select').forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.closest('.form-group')?.classList.contains('error')) validateField(input);
    });
  });

  const limiter = (typeof PV !== 'undefined' && PV.rateLimiter) ? PV.rateLimiter(5, 120000) : null;
  const trimFn = (typeof PV !== 'undefined' && PV.trimInput) ? PV.trimInput : (v => v.trim());

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;

    form.querySelectorAll('.form-input[required], .form-select[required]').forEach(i => {
      if (!validateField(i)) valid = false;
    });

    if (!eula?.checked) {
      valid = false;
      const g = eula?.closest('.form-group');
      if (g) {
        g.classList.add('error');
        const err = g.querySelector('.error-msg');
        if (err) err.textContent = 'You must accept the EULA to continue.';
      }
    }

    if (!valid) return;

    if (limiter && !limiter.allow()) {
      alert('Too many attempts. Please wait ' + limiter.remainingSeconds() + ' seconds.');
      return;
    }

    submit.disabled = true;
    // Grab the Cloudflare Token
    const cfToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
    if (!cfToken) {
        alert("Please confirm you are not a robot.");
        submit.disabled = false;
        submit.textContent = 'Try Again';
        return;
    }
    submit.textContent = 'Encrypting & Saving…';

    // Grab the Google token from the URL bar!
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
        alert("Security token missing. Please try logging in with Google again.");
        submit.disabled = false;
        submit.textContent = 'Finish & Create Account';
        return;
    }

    const payload = {
        registration_token: token,
        username: trimFn(document.getElementById('username').value, 50),
        country: document.getElementById('country').value,
        fitness_level: document.getElementById('level').value,
        height_cm: parseFloat(document.getElementById('height').value),
        weight_kg: parseFloat(document.getElementById('weight').value),
        cf_token: cfToken 
    };

    try {
        const response = await fetch('https://api.physiovision.app/complete_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok || response.status === 201) {
            submit.innerHTML = '✓ Account Created — Welcome!';
            submit.style.background = '#3DAA6E';
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            setTimeout(() => window.location.href = 'dashboard.html', 1500);
        } else if (response.status === 422) {
            alert("Security Check Failed: Please ensure all inputs are valid.");
            submit.disabled = false;
            submit.innerHTML = 'Finish & Create Account';
        } else {
            alert(data.detail || "Registration failed.");
            submit.disabled = false;
            submit.innerHTML = 'Finish & Create Account';
        }
    } catch (error) {
        alert("Network error. Please try again.");
        submit.disabled = false;
        submit.innerHTML = 'Finish & Create Account';
    }
  });
})();
