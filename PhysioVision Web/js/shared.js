/* ============================================================
   PHYSIO-VISION — shared.js
   Global utilities loaded on every public page.
   Requires: js/security.js loaded first (for PV namespace).
   ============================================================ */

'use strict';

window.PV = window.PV || {};

// ── 1. NAV SCROLL STATE ──────────────────────────────────────
// Adds 'scrolled' class to <nav> when the user scrolls down,
// enabling the navbar border highlight transition in style.css.
(function () {
  var nav = document.querySelector('nav');
  if (!nav) return;
  var tick = function () {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  };
  window.addEventListener('scroll', tick, { passive: true });
  tick();
})();


// ── 2. SCROLL REVEAL ─────────────────────────────────────────
// Fades in `.reveal` elements when they enter the viewport.
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  els.forEach(function (el) { io.observe(el); });
})();


// ── 3. ACTIVE NAV LINK ───────────────────────────────────────
// Highlights the nav link matching the current page filename.
(function () {
  var page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    var href = (a.getAttribute('href') || '').split('#')[0].split('/').pop();
    if (href === page) a.classList.add('active');
  });
})();


// ── 4. SMOOTH ANCHORS ────────────────────────────────────────
// Intercepts clicks on in-page anchor links for smooth scroll.
(function () {
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#') return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();


// ── 5. AUTH-AWARE NAV ────────────────────────────────────────
// Checks for an access_token in localStorage and swaps the
// "Sign In" nav link to "Dashboard" (and vice versa).
// Also provides PV.logout() for sign-out buttons.
//
// The nav is expected to have a link with id="nav-auth-link"
// and a mobile duplicate with id="nav-auth-link-mobile" (optional).
//
// <a href="login.html" class="btn btn-outline" id="nav-auth-link">Sign in</a>
//
(function () {
  /**
   * Update all auth-related nav elements on the page.
   * Call once on DOMContentLoaded (automatic), and again after
   * login/logout actions if staying on the same page.
   */
  function updateAuthNav() {
    var token = localStorage.getItem('access_token');
    var isLoggedIn = !!token;

    // Find all auth links (primary + mobile)
    var authLinks = document.querySelectorAll('[data-auth-link]');
    authLinks.forEach(function (link) {
      if (isLoggedIn) {
        link.href = 'dashboard.html';
        link.textContent = 'Dashboard';
      } else {
        link.href = 'login.html';
        link.textContent = 'Sign in';
      }
    });
  }

  // Expose for external use (e.g., after programmatic login/logout)
  PV.updateAuthNav = updateAuthNav;

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAuthNav);
  } else {
    updateAuthNav();
  }
})();


// ── 6. LOGOUT ────────────────────────────────────────────────
// Clears auth tokens from localStorage and redirects to the
// landing page.  Attach to any sign-out button/link.
//
// Usage:  <button onclick="PV.logout()">Sign out</button>
//   — or —
// Usage:  document.querySelector('.signout-btn')
//            .addEventListener('click', PV.logout);
//
PV.logout = function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
};


// ── 7. MOBILE NAV TOGGLE ────────────────────────────────────
// Handles the hamburger menu on small screens.
// Expects:  <button class="nav-toggle" aria-label="Toggle menu">
//           <div class="nav-mobile"> … links … </div>
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var mobileNav = document.querySelector('.nav-mobile');
  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', function () {
    var isOpen = mobileNav.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close mobile nav when a link is clicked
  mobileNav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      mobileNav.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();
