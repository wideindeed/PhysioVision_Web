'use strict';

/* ── PASSWORD TOGGLE ── */
const pwToggle = document.querySelector('.pw-toggle');
const pwInput  = document.getElementById('password');
if (pwToggle && pwInput) {
  pwToggle.addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    pwToggle.querySelector('.eye-open').style.display  = show ? 'none' : '';
    pwToggle.querySelector('.eye-closed').style.display = show ? '' : 'none';
  });
}

/* ── FORM VALIDATION ── */
(function initLogin() {
  const form   = document.getElementById('login-form');
  const submit = document.getElementById('btn-submit');
  if (!form) return;

  function validate(input) {
    const group = input.closest('.form-group');
    if (!group) return true;
    const errEl = group.querySelector('.error-msg');
    let msg = '';
    if (input.required && !input.value.trim()) msg = 'This field is required.';
    else if (input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) msg = 'Please enter a valid email address.';
    else if (input.id === 'password' && input.value && input.value.length < 8) msg = 'Password must be at least 8 characters.';
    group.classList.toggle('error', !!msg);
    if (errEl) errEl.textContent = msg;
    return !msg;
  }

  form.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('blur', () => validate(input));
    input.addEventListener('input', () => {
      if (input.closest('.form-group')?.classList.contains('error')) validate(input);
    });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;
    form.querySelectorAll('.form-input[required]').forEach(i => { if (!validate(i)) valid = false; });
    if (!valid) return;
    submit.disabled = true;
    submit.innerHTML = 'Signing in…';
    // hand off to backend
  });
})();


/* ══════════════════════════════════════════════════════
   RAGDOLL PHYSICS
   Verlet integration with distance constraints
══════════════════════════════════════════════════════ */
(function initRagdoll() {
  const canvas = document.getElementById('ragdoll-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); initPoints(); });

  const GRAVITY   = 0.45;
  const DAMPING   = 0.972;
  const ITERS     = 20;       // more iterations = stiffer
  const STIFFNESS = 0.92;     // global stiffness multiplier
  const JOINT_R   = 6;
  const HEAD_R    = 22;

  let points = [], sticks = [], dragging = null, mouse = { x: 0, y: 0 };
  let frozen = true;
  let everDragged = false;

  function pt(x, y, pinned = false) {
    return { x, y, px: x, py: y, pinned };
  }

  function initPoints() {
    const cx = canvas.width  * 0.5;
    const cy = canvas.height * 0.38;
    const s  = Math.min(canvas.height * 0.55, 260);
    const u = s / 6;
    points = [
      pt(cx,        cy - u*3.2),  // 0 head
      pt(cx,        cy - u*2.0),  // 1 neck/chest top
      pt(cx,        cy),          // 2 chest mid / pelvis
      pt(cx - u,    cy + u*0.6),  // 3 lHip
      pt(cx + u,    cy + u*0.6),  // 4 rHip
      pt(cx - u*1.8,cy - u*1.4),  // 5 lShoulder
      pt(cx + u*1.8,cy - u*1.4),  // 6 rShoulder
      pt(cx - u*2.6,cy),          // 7 lElbow
      pt(cx + u*2.6,cy),          // 8 rElbow
      pt(cx - u*2.8,cy + u*1.4),  // 9 lHand
      pt(cx + u*2.8,cy + u*1.4),  // 10 rHand
      pt(cx - u,    cy + u*2.4),  // 11 lKnee
      pt(cx + u,    cy + u*2.4),  // 12 rKnee
      pt(cx - u*1.0,cy + u*4.0),  // 13 lFoot
      pt(cx + u*1.0,cy + u*4.0),  // 14 rFoot
    ];
    // sync px/py so there's zero velocity on init
    for (const p of points) { p.px = p.x; p.py = p.y; }
    frozen = true;
    everDragged = false;

    function d(a, b) {
      const dx = points[a].x - points[b].x, dy = points[a].y - points[b].y;
      return Math.sqrt(dx*dx + dy*dy);
    }
    function link(a, b, stiff = 1) { sticks.push({ a, b, len: d(a,b), stiff: stiff * STIFFNESS }); }

    sticks = [];
    // spine
    link(0,1); link(1,2); link(2,3); link(2,4);
    // shoulders
    link(1,5); link(1,6); link(5,6,0.5);
    // arms
    link(5,7); link(7,9); link(6,8); link(8,10);
    // legs
    link(3,11); link(4,12); link(11,13); link(12,14);
    // cross-hips (stability)
    link(3,4,0.8);
    // cross-shoulders (stability)
    link(5,2,0.6); link(6,2,0.6);
  }

  initPoints();

  function dist(a, b) {
    const dx = a.x-b.x, dy = a.y-b.y;
    return Math.sqrt(dx*dx+dy*dy);
  }

  function constrain() {
    for (let i = 0; i < ITERS; i++) {
      for (const s of sticks) {
        const a = points[s.a], b = points[s.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx*dx + dy*dy) || 0.001;
        const diff = ((d - s.len) / d) * 0.5 * s.stiff;
        const ox = dx * diff, oy = dy * diff;
        if (!a.pinned) { a.x += ox; a.y += oy; }
        if (!b.pinned) { b.x -= ox; b.y -= oy; }
      }
      // floor/ceiling/walls
      const floor = canvas.height - 20;
      for (const p of points) {
        if (p.pinned) continue;
        if (p.y > floor) { p.y = floor; p.py = p.y + (p.y - p.py) * 0.3; }
        if (p.y < 0)     { p.y = 0; }
        if (p.x < 0)     { p.x = 0; }
        if (p.x > canvas.width) { p.x = canvas.width; }
      }
    }
  }

  function update() {
    if (frozen && !dragging) return;
    for (const p of points) {
      if (p.pinned || p === dragging) continue;
      const vx = (p.x - p.px) * DAMPING;
      const vy = (p.y - p.py) * DAMPING;
      p.px = p.x; p.py = p.y;
      p.x += vx;
      p.y += vy + GRAVITY;
    }
    if (dragging) {
      dragging.px = dragging.x;
      dragging.py = dragging.y;
      dragging.x += (mouse.x - dragging.x) * 0.6;
      dragging.y += (mouse.y - dragging.y) * 0.6;
    }
    constrain();
  }

  // Accent orange from CSS
  const ACCENT = '#E8420A';
  const BONE   = 'rgba(255,255,255,0.85)';
  const JOINT  = 'rgba(255,255,255,0.55)';
  const JOINT_ACTIVE = ACCENT;

  function drawLimb(ai, bi, thickness) {
    const a = points[ai], b = points[bi];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth  = thickness;
    ctx.strokeStyle = BONE;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawJoint(p, r, active = false) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    ctx.fillStyle = active ? JOINT_ACTIVE : JOINT;
    ctx.fill();
    if (active) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(232,66,10,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  let tooltipAlpha = 1;

  function drawTooltip(head) {
    if (everDragged) { tooltipAlpha = Math.max(0, tooltipAlpha - 0.03); }
    if (tooltipAlpha <= 0) return;

    const text  = '✦ Click & drag me!';
    const tx    = head.x;
    const ty    = head.y - HEAD_R - 36;
    const pad   = { x: 14, y: 8 };

    ctx.save();
    ctx.globalAlpha = tooltipAlpha;
    ctx.font = '600 12px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const bx = tx - tw/2 - pad.x;
    const by = ty - 14 - pad.y;
    const bw = tw + pad.x*2;
    const bh = 22 + pad.y*2;
    const br = 8;

    // bubble
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, br);
    ctx.fillStyle = 'rgba(232,66,10,0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,66,10,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // tail
    ctx.beginPath();
    ctx.moveTo(tx - 6, by + bh);
    ctx.lineTo(tx,     by + bh + 8);
    ctx.lineTo(tx + 6, by + bh);
    ctx.closePath();
    ctx.fillStyle = 'rgba(232,66,10,0.15)';
    ctx.fill();

    // text
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tx, by + bh/2);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Glow behind figure
    const head = points[0];
    const grad = ctx.createRadialGradient(head.x, canvas.height*0.5, 10, head.x, canvas.height*0.5, 160);
    grad.addColorStop(0, 'rgba(232,66,10,0.06)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Limbs
    // torso/spine thick
    drawLimb(0,1,4); drawLimb(1,2,5); drawLimb(2,3,4); drawLimb(2,4,4);
    // arms
    drawLimb(1,5,4); drawLimb(5,7,3.5); drawLimb(7,9,3);
    drawLimb(1,6,4); drawLimb(6,8,3.5); drawLimb(8,10,3);
    // legs
    drawLimb(3,11,4); drawLimb(11,13,3.5);
    drawLimb(4,12,4); drawLimb(12,14,3.5);

    // Head circle
    ctx.beginPath();
    ctx.arc(head.x, head.y, HEAD_R, 0, Math.PI*2);
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // Face dots
    const eyeOff = HEAD_R * 0.28;
    const eyeY   = head.y - HEAD_R * 0.1;
    ctx.fillStyle = BONE;
    ctx.beginPath(); ctx.arc(head.x - eyeOff, eyeY, 2.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(head.x + eyeOff, eyeY, 2.2, 0, Math.PI*2); ctx.fill();
    // Mouth arc
    ctx.beginPath();
    ctx.arc(head.x, head.y + HEAD_R*0.1, HEAD_R*0.28, 0.2, Math.PI-0.2);
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Joints (skip head=0)
    for (let i = 1; i < points.length; i++) {
      drawJoint(points[i], JOINT_R, points[i] === dragging);
    }

    drawTooltip(head);
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();

  // ── DRAG ──
  function getCanvasPos(e) {
    const r = canvas.getBoundingClientRect();
    const ev = e.touches ? e.touches[0] : e;
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function findNearest(pos) {
    let nearest = null, best = 30;
    for (const p of points) {
      const d = dist(p, pos);
      if (d < best) { best = d; nearest = p; }
    }
    return nearest;
  }

  canvas.addEventListener('mousedown', e => {
    const pos = getCanvasPos(e);
    const hit = findNearest(pos);
    if (hit) {
      dragging = hit;
      frozen = false;
      everDragged = true;
    }
    mouse = pos;
  });
  canvas.addEventListener('mousemove', e => { mouse = getCanvasPos(e); });
  canvas.addEventListener('mouseup',   () => { dragging = null; });
  canvas.addEventListener('mouseleave',() => { dragging = null; });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const hit = findNearest(pos);
    if (hit) {
      dragging = hit;
      frozen = false;
      everDragged = true;
    }
    mouse = pos;
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    mouse = getCanvasPos(e);
  }, { passive: false });
  canvas.addEventListener('touchend', () => { dragging = null; });
})();
