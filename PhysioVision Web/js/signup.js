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

  const CHECKS = {
    length:  pw => pw.length >= 8,
    upper:   pw => /[A-Z]/.test(pw),
    lower:   pw => /[a-z]/.test(pw),
    number:  pw => /[0-9]/.test(pw),
    special: pw => /[^A-Za-z0-9]/.test(pw),
  };

  const reqItems = document.querySelectorAll('#pw-reqs li[data-req]');

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

    reqItems.forEach(li => {
      const key = li.dataset.req;
      li.classList.toggle('met', !!CHECKS[key]?.(input.value));
    });
  });
})();

// ── FORM VALIDATION & SUBMISSION ──────────────────────────────
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

  // Submit to API
  const limiter = (typeof PV !== 'undefined' && PV.rateLimiter) ? PV.rateLimiter(5, 120000) : null;
  const trimFn = (typeof PV !== 'undefined' && PV.trimInput) ? PV.trimInput : (v => v.trim());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    form.querySelectorAll('.form-input[required], .form-select[required]').forEach((input) => {
      if (!validateField(input)) valid = false;
    });

    // Enforce password complexity
    const pwdVal = document.getElementById('password')?.value || '';
    if (pwdVal.length < 8 || !/[A-Z]/.test(pwdVal) || !/[0-9]/.test(pwdVal) || !/[^A-Za-z0-9]/.test(pwdVal)) {
      valid = false;
      const pwdGroup = document.getElementById('password')?.closest('.form-group');
      if (pwdGroup) {
        pwdGroup.classList.add('error');
        const errEl = pwdGroup.querySelector('.error-msg');
        if (errEl) errEl.textContent = 'Password must meet complexity requirements.';
      }
    }

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

    if (limiter && !limiter.allow()) {
      alert('Too many attempts. Please wait ' + limiter.remainingSeconds() + ' seconds.');
      return;
    }

    // ── SECURE API HANDOFF ──
    submit.textContent = 'Encrypting & Sending...';
    // Grab the Cloudflare Token
    const cfToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
    if (!cfToken) {
        alert("Please confirm you are not a robot.");
        submit.disabled = false;
        submit.textContent = 'Try Again';
        return;
    }
    submit.disabled = true;

    const payload = {
      first_name: trimFn(document.getElementById('first-name').value, 100),
      last_name: trimFn(document.getElementById('last-name').value, 100),
      username: trimFn(document.getElementById('username').value, 50),
      email: trimFn(document.getElementById('email').value, 254),
      password: pwdVal, 
      country: document.getElementById('country').value,
      fitness_level: document.getElementById('level').value,
      height_cm: parseFloat(document.getElementById('height').value),
      weight_kg: parseFloat(document.getElementById('weight').value),
      cf_token: cfToken 
    };

    try {
      const response = await fetch('https://api.physiovision.app/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 201) {
        submit.innerHTML = '✓ Verification Email Sent';
        submit.style.background = '#3DAA6E';
        
        alert("Account created successfully! Please check your email to verify your account before logging in.");
        
        // Optional: Redirect to login page
        // setTimeout(() => { window.location.href = 'login.html'; }, 3000);

      } else if (response.status === 422) {
        let errorString = "Security Check Failed:\n";
        if (Array.isArray(data.detail)) {
            data.detail.forEach(err => {
                let fieldName = err.loc[err.loc.length - 1];
                errorString += `• ${fieldName}: ${err.msg}\n`;
            });
        } else {
            errorString += "Please check your inputs.";
        }
        alert(errorString);
        resetSubmitButton();
      } else if (response.status === 429) {
        alert("Too many registration attempts. Please try again in an hour.");
        resetSubmitButton();
      } else {
        alert(data.detail || "Registration failed. Please try again.");
        resetSubmitButton();
      }

    } catch (error) {
      console.error("Network Error:", error);
      alert("Unable to securely connect to the server. Please check your internet connection.");
      resetSubmitButton();
    }

    function resetSubmitButton() {
      submit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Create Account';
      submit.disabled = false;
      submit.style.background = 'var(--ink)';
    }
  });
})();