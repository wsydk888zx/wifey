// ── CURSOR + HAPTICS ──────────────────────────────────────────────────────────
// Magnetic cursor with blob trail. Hidden on touch devices.
// Also exports haptic() utility used throughout the app.

export function haptic(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export function initCursor() {
  // Don't show custom cursor on touch-primary devices
  if ('ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches) return;

  const dot  = document.getElementById('cursor-dot');
  const blob = document.getElementById('cursor-blob');
  if (!dot || !blob) return;

  document.documentElement.style.cursor = 'none';

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let bx = mx, by = my;

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  let active = false;
  function animate() {
    dot.style.transform  = `translate(${mx - 4}px, ${my - 4}px)`;
    bx += (mx - bx) * 0.08;
    by += (my - by) * 0.08;
    blob.style.transform = `translate(${bx - 20}px, ${by - 20}px)`;
    requestAnimationFrame(animate);
  }
  animate();

  // Expand blob on interactive elements
  const interactiveSelector = 'a, button, .choice-card, .env-seal, .env-outer, [data-magnetic], .btn, input, select';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(interactiveSelector)) {
      blob.classList.add('expanded');
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(interactiveSelector)) {
      blob.classList.remove('expanded');
    }
  });

  // Press state
  document.addEventListener('mousedown', () => blob.classList.add('pressed'));
  document.addEventListener('mouseup',   () => blob.classList.remove('pressed'));
}
