// ── PRESENCE + READ RECEIPTS ──────────────────────────────────────────────────
// "He's watching" ambient dot. Read receipt flash on choice submit.
import { S } from '../state.js';

export function initPresence() {
  updatePresence();
  setInterval(updatePresence, 60_000);
}

export function updatePresence() {
  const dot = document.getElementById('presence-dot');
  if (!dot) return;
  const last = S.lastAdminSeen || 0;
  const age  = Date.now() - last;
  const watching = age < 5 * 60 * 1000;

  dot.classList.toggle('watching', watching);

  if (watching) {
    const mins = Math.floor(age / 60000);
    dot.title = mins < 1 ? 'He\'s here' : `He was here ${mins}m ago`;
  } else {
    dot.title = '';
  }
}

export function triggerPresenceBurst() {
  const dot = document.getElementById('presence-dot');
  if (!dot) return;
  dot.classList.add('triggered');
  setTimeout(() => dot.classList.remove('triggered'), 1200);
}

// ── Read receipt ──────────────────────────────────────────────────────────────
export function flashReadReceipt() {
  const receipt = document.createElement('div');
  receipt.className = 'read-receipt';
  receipt.textContent = '✓ received by him';
  document.body.appendChild(receipt);

  receipt.animate([
    { opacity: 0, transform: 'translateY(6px)' },
    { opacity: 1, transform: 'translateY(0)',      offset: 0.15 },
    { opacity: 1, transform: 'translateY(0)',      offset: 0.70 },
    { opacity: 0, transform: 'translateY(-6px)' }
  ], { duration: 2400, easing: 'ease', fill: 'forwards' })
    .finished.then(() => receipt.remove());
}
