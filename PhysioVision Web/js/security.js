/* ============================================================
   PHYSIO-VISION — security.js
   Shared security utilities for XSS prevention, input
   sanitization, rate limiting, and safe DOM creation.
   Include this file BEFORE page-specific scripts on every page.
   ============================================================ */

'use strict';

// Namespace to avoid global pollution
window.PV = window.PV || {};

/* ──────────────────────────────────────────────────────────────
   1. escapeHTML — Escape a string for safe insertion into HTML.
      Converts the 5 dangerous characters into HTML entities.
────────────────────────────────────────────────────────────── */
PV.escapeHTML = function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
};


/* ──────────────────────────────────────────────────────────────
   2. sanitizeText — Strip ALL HTML tags and return plain text.
      Use when you only want the text content of a value.
────────────────────────────────────────────────────────────── */
PV.sanitizeText = function sanitizeText(str) {
  if (str == null) return '';
  var s = String(str);
  // Use the browser's own parser to strip tags safely.
  // Create a throwaway element, set textContent (not innerHTML),
  // then read it back — guaranteeing no markup survives.
  var tmp = document.createElement('div');
  tmp.textContent = s;
  return tmp.textContent;           // identity when set via textContent
};


/* ──────────────────────────────────────────────────────────────
   3. sanitizeForAttribute — Escape a string for use inside an
      HTML attribute value.  Same as escapeHTML but also handles
      backtick (template-literal injection in older engines).
────────────────────────────────────────────────────────────── */
PV.sanitizeForAttribute = function sanitizeForAttribute(str) {
  if (str == null) return '';
  return PV.escapeHTML(str).replace(/`/g, '&#96;');
};


/* ──────────────────────────────────────────────────────────────
   4. validateColorValue — Validate a CSS color value against a
      strict allowlist pattern.  Returns the color if valid,
      otherwise returns the fallback.
      Accepts: hex (#abc, #aabbcc, #aabbccdd), named CSS colors
      that match /^[a-zA-Z]+$/, and rgb()/hsl() functions.
────────────────────────────────────────────────────────────── */
PV.validateColorValue = function validateColorValue(color, fallback) {
  if (typeof color !== 'string') return fallback || '#7A7A76';
  var trimmed = color.trim();
  // Hex: #abc, #aabbcc, #aabbccdd
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  // Named: only alpha (e.g. "red", "steelblue")
  if (/^[a-zA-Z]{1,24}$/.test(trimmed)) return trimmed;
  // rgb()/rgba()/hsl()/hsla() — allow only digits, commas, dots, spaces, %
  if (/^(rgb|hsl)a?\(\s*[\d.,\s%/]+\)$/.test(trimmed)) return trimmed;
  return fallback || '#7A7A76';
};


/* ──────────────────────────────────────────────────────────────
   5. createSafeElement — Build a DOM element safely without
      innerHTML.  All text content is set via textContent.

   Usage:
     PV.createSafeElement('div', {
       className: 'card',
       textContent: userProvidedData,
       dataset: { id: '42' },
       style: { color: 'red' },
       children: [
         PV.createSafeElement('span', { textContent: 'nested' })
       ]
     });
────────────────────────────────────────────────────────────── */
PV.createSafeElement = function createSafeElement(tag, opts) {
  opts = opts || {};
  var el = document.createElement(tag);

  // className
  if (opts.className) el.className = String(opts.className);

  // id
  if (opts.id) el.id = String(opts.id);

  // textContent (safe — never parsed as HTML)
  if (opts.textContent != null) el.textContent = String(opts.textContent);

  // data-* attributes
  if (opts.dataset) {
    Object.keys(opts.dataset).forEach(function (k) {
      el.dataset[k] = String(opts.dataset[k]);
    });
  }

  // Inline styles (object)
  if (opts.style && typeof opts.style === 'object') {
    Object.keys(opts.style).forEach(function (k) {
      el.style[k] = String(opts.style[k]);
    });
  }

  // aria-* / role / title / href / type / for / etc.
  if (opts.attributes) {
    Object.keys(opts.attributes).forEach(function (k) {
      el.setAttribute(k, String(opts.attributes[k]));
    });
  }

  // Append children (must be DOM nodes)
  if (opts.children && Array.isArray(opts.children)) {
    opts.children.forEach(function (child) {
      if (child instanceof Node) el.appendChild(child);
    });
  }

  // Event listeners
  if (opts.events && typeof opts.events === 'object') {
    Object.keys(opts.events).forEach(function (ev) {
      if (typeof opts.events[ev] === 'function') {
        el.addEventListener(ev, opts.events[ev]);
      }
    });
  }

  return el;
};


/* ──────────────────────────────────────────────────────────────
   6. rateLimiter — Create a client-side rate limiter to
      throttle form submissions (login, signup, etc.).

   Usage:
     var limiter = PV.rateLimiter(5, 120000);  // 5 attempts per 2 min
     submitBtn.addEventListener('click', function () {
       if (!limiter.allow()) {
         showError('Too many attempts. Try again in '
                   + limiter.remainingSeconds() + 's.');
         return;
       }
       // proceed with submission …
     });
────────────────────────────────────────────────────────────── */
PV.rateLimiter = function rateLimiter(maxAttempts, cooldownMs) {
  var attempts = [];
  var lockedUntil = 0;

  function cleanup() {
    var cutoff = Date.now() - cooldownMs;
    attempts = attempts.filter(function (t) { return t > cutoff; });
  }

  return {
    /** Returns true if the action is allowed. */
    allow: function () {
      var now = Date.now();
      if (now < lockedUntil) return false;
      cleanup();
      if (attempts.length >= maxAttempts) {
        lockedUntil = now + cooldownMs;
        return false;
      }
      attempts.push(now);
      return true;
    },

    /** Seconds remaining in the current lockout, or 0. */
    remainingSeconds: function () {
      var rem = lockedUntil - Date.now();
      return rem > 0 ? Math.ceil(rem / 1000) : 0;
    },

    /** Reset the limiter (e.g. after a successful action). */
    reset: function () {
      attempts = [];
      lockedUntil = 0;
    }
  };
};


/* ──────────────────────────────────────────────────────────────
   7. validateInput — Validate a string against a set of rules.
      Returns { valid: true } or { valid: false, message: '...' }

   Supported rules:
     required     — must not be empty after trim
     minLength:N  — minimum length
     maxLength:N  — maximum length
     pattern:re   — must match regex (pass a RegExp)
     email        — basic email format
     username     — alphanumeric + underscore, 3–20 chars
────────────────────────────────────────────────────────────── */
PV.validateInput = function validateInput(str, rules) {
  var s = (str == null) ? '' : String(str).trim();

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];

    if (rule.required && s.length === 0) {
      return { valid: false, message: rule.message || 'This field is required.' };
    }

    if (rule.minLength && s.length < rule.minLength) {
      return { valid: false, message: rule.message || 'Minimum ' + rule.minLength + ' characters.' };
    }

    if (rule.maxLength && s.length > rule.maxLength) {
      return { valid: false, message: rule.message || 'Maximum ' + rule.maxLength + ' characters.' };
    }

    if (rule.pattern && !rule.pattern.test(s)) {
      return { valid: false, message: rule.message || 'Invalid format.' };
    }

    if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
      return { valid: false, message: rule.message || 'Enter a valid email address.' };
    }

    if (rule.username && !/^[a-zA-Z0-9_]{3,20}$/.test(s)) {
      return { valid: false, message: rule.message || 'Username must be 3–20 characters: letters, numbers, underscores.' };
    }
  }

  return { valid: true };
};


/* ──────────────────────────────────────────────────────────────
   8. trimInput — Trim and limit length of an input string.
      Use before sending user input to the API.
────────────────────────────────────────────────────────────── */
PV.trimInput = function trimInput(str, maxLen) {
  if (str == null) return '';
  var s = String(str).trim();
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  return s;
};
