// ── HOLD TO REVEAL ────────────────────────────────────────────────────────────
// Sustained touch/mousedown unlocks hidden content.
import { haptic } from '../cursor.js';

export function initHoldReveal() {
  document.querySelectorAll('[data-hold-reveal]').forEach(attachHold);

  // Re-init on DOM changes
  const mo = new MutationObserver(() => {
    document.querySelectorAll('[data-hold-reveal]:not([data-hold-init])')
      .forEach(el => { attachHold(el); el.dataset.holdInit = '1'; });
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

function attachHold(el) {
  el.dataset.holdInit = '1';
  const duration = parseInt(el.dataset.holdDuration || '1500');
  const ring = el.querySelector('.hold-ring');
  let raf = null;

  const start = (e) => {
    e.preventDefault();
    haptic(10);
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      if (ring) ring.style.setProperty('--progress', progress);
      if (progress >= 1) { reveal(el); return; }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  };

  const cancel = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (ring) ring.style.setProperty('--progress', 0);
  };

  el.addEventListener('mousedown',  start);
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('mouseup',    cancel);
  el.addEventListener('mouseleave', cancel);
  el.addEventListener('touchend',   cancel);
  el.addEventListener('touchcancel',cancel);
}

function reveal(el) {
  el.classList.add('revealed');
  haptic([20, 40, 60]);
  const content = el.querySelector('.hold-content');
  if (content) content.removeAttribute('hidden');
  const prompt = el.querySelector('.hold-prompt');
  if (prompt) prompt.style.opacity = '0';
}
