/* ============================================================
   PHYSIO-VISION — shared.js
   ============================================================ */

'use strict';

// ── 1. NAV SCROLL STATE ──────────────────────────────────────
(function () {
  const nav = document.querySelector('nav');
  if (!nav) return;
  const tick = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', tick, { passive: true });
  tick();
})();


// ── 2. SCROLL REVEAL ─────────────────────────────────────────
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  els.forEach((el) => io.observe(el));
})();


// ── 3. ACTIVE NAV LINK ───────────────────────────────────────
(function () {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach((a) => {
    const href = (a.getAttribute('href') || '').split('#')[0].split('/').pop();
    if (href === page) a.classList.add('active');
  });
})();


// ── 4. SMOOTH ANCHORS ────────────────────────────────────────
(function () {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
