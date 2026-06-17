/* ============================================================
   PHYSIO-VISION — faq.js
   ============================================================ */

'use strict';

// ── ANIMATED ACCORDION ───────────────────────────────────────
(function () {
  document.querySelectorAll('details.faq-item').forEach((item) => {
    const summary = item.querySelector('summary');
    const body    = item.querySelector('.faq-answer');
    if (!summary || !body) return;

    summary.addEventListener('click', (e) => {
      e.preventDefault();

      if (item.open) {
        // Collapse
        const h = body.scrollHeight;
        body.style.height     = h + 'px';
        body.style.overflow   = 'hidden';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            body.style.transition = 'height 0.32s cubic-bezier(0.22,1,0.36,1)';
            body.style.height     = '0';
          });
        });
        body.addEventListener('transitionend', () => {
          item.open             = false;
          body.style.height     = '';
          body.style.overflow   = '';
          body.style.transition = '';
        }, { once: true });
      } else {
        // Expand
        item.open           = true;
        body.style.overflow = 'hidden';
        body.style.height   = '0';
        requestAnimationFrame(() => {
          body.style.transition = 'height 0.32s cubic-bezier(0.22,1,0.36,1)';
          body.style.height     = body.scrollHeight + 'px';
        });
        body.addEventListener('transitionend', () => {
          body.style.height     = '';
          body.style.overflow   = '';
          body.style.transition = '';
        }, { once: true });
      }
    });
  });
})();


// ── LIVE SEARCH ──────────────────────────────────────────────
(function () {
  const input = document.getElementById('faq-search');
  if (!input) return;

  const items    = document.querySelectorAll('details.faq-item');
  const sections = document.querySelectorAll('.faq-section');

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();

    items.forEach((item) => {
      item.style.display = (!q || item.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });

    sections.forEach((s) => {
      const vis = [...s.querySelectorAll('details.faq-item')].some(i => i.style.display !== 'none');
      s.style.display = vis ? '' : 'none';
    });
  });
})();


// ── SIDEBAR ACTIVE TRACKING ──────────────────────────────────
(function () {
  const links    = document.querySelectorAll('.sidebar-nav a');
  const headings = document.querySelectorAll('.faq-category-title[id]');
  if (!links.length || !headings.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  headings.forEach((h) => io.observe(h));
})();
