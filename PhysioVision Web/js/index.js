/* ============================================================
   PHYSIO-VISION — index.js
   Joint diagram cycling + stat counters
   ============================================================ */

'use strict';

// ── JOINT DIAGRAM ANIMATION ──────────────────────────────────
// Cycles through "active" joints on the SVG skeleton
(function initJointCycle() {
  const nodes = document.querySelectorAll('.j-node');
  const lines = document.querySelectorAll('.j-line');
  if (!nodes.length) return;

  // Pairs of [node-index, line-index] that activate together
  const sequences = [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, null],
  ];

  let current = 0;

  function clearAll() {
    nodes.forEach((n) => n.classList.remove('active'));
    lines.forEach((l) => l.classList.remove('active'));
  }

  function activateNext() {
    clearAll();
    const [nodeIdx, lineIdx] = sequences[current % sequences.length];
    if (nodes[nodeIdx]) nodes[nodeIdx].classList.add('active');
    if (lineIdx !== null && lines[lineIdx]) lines[lineIdx].classList.add('active');
    current++;
    setTimeout(activateNext, 900);
  }

  activateNext();
})();


// ── ANIMATED STAT COUNTERS ───────────────────────────────────
// Counts up spec numbers when they scroll into view
(function initCounters() {
  const nums = document.querySelectorAll('[data-count]');
  if (!nums.length) return;

  function animateCount(el) {
    const target  = parseFloat(el.dataset.count);
    const suffix  = el.dataset.suffix || '';
    const dur     = 1400; // ms
    const start   = performance.now();

    function tick(now) {
      const pct = Math.min((now - start) / dur, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - pct, 3);
      const val   = target * eased;
      el.textContent = (Number.isInteger(target) ? Math.round(val) : val.toFixed(1)) + suffix;
      if (pct < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        animateCount(e.target);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });

  nums.forEach((n) => io.observe(n));
})();


// ── ANNOUNCE BAR DISMISS ─────────────────────────────────────
(function () {
  const bar    = document.querySelector('.announce-bar');
  const close  = document.getElementById('bar-close');
  if (!bar || !close) return;

  close.addEventListener('click', () => {
    bar.style.maxHeight = bar.offsetHeight + 'px';
    requestAnimationFrame(() => {
      bar.style.transition = 'max-height 0.35s ease, opacity 0.35s ease';
      bar.style.maxHeight  = '0';
      bar.style.opacity    = '0';
      bar.style.overflow   = 'hidden';
    });
    // Remove body padding
    document.body.classList.remove('has-bar');
  });
})();
