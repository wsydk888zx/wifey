// ── DESIRE DIAL ───────────────────────────────────────────────────────────────
// She sets it. He reads it in the admin panel.
import { S, save } from '../state.js';
import { haptic } from '../cursor.js';

const DIAL_LABELS = [
  { threshold: 0,  label: 'Not yet—' },
  { threshold: 15, label: 'Aware of you' },
  { threshold: 35, label: 'Restless' },
  { threshold: 55, label: 'Aching' },
  { threshold: 75, label: 'Desperate' },
  { threshold: 90, label: 'Yours, completely' },
];

function getDialLabel(val) {
  let label = DIAL_LABELS[0].label;
  for (const l of DIAL_LABELS) {
    if (val >= l.threshold) label = l.label;
  }
  return label;
}

function formatTimeSince(ts) {
  if (!ts) return 'never';
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1)  return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

// ── Her panel ─────────────────────────────────────────────────────────────────
export function initDial() {
  const panel = document.getElementById('dial-panel');
  if (!panel) return;

  const dial  = panel.querySelector('#desire-dial');
  const label = panel.querySelector('#dial-label');
  if (!dial || !label) return;

  dial.value = S.desireDial || 0;
  label.textContent = getDialLabel(dial.value);

  dial.addEventListener('input', e => {
    const val = parseInt(e.target.value);
    S.desireDial = val;
    S.desireDialUpdated = Date.now();
    save();
    label.textContent = getDialLabel(val);
    haptic(5);
  });
}

export function openDialPanel() {
  document.getElementById('dial-panel').classList.add('open');
}
export function closeDialPanel() {
  document.getElementById('dial-panel').classList.remove('open');
}

// ── Admin view ────────────────────────────────────────────────────────────────
export function renderDesireDialAdmin(containerEl) {
  const val   = S.desireDial || 0;
  const label = getDialLabel(val);
  const since = formatTimeSince(S.desireDialUpdated);
  containerEl.innerHTML = `
    <div class="admin-section-title">Her Desire</div>
    <div class="admin-desire-reading">
      <span class="admin-desire-val">${val}</span>
      <span class="admin-desire-label">${label}</span>
      <span class="admin-desire-since">updated ${since}</span>
    </div>
    <div class="admin-desire-bar">
      <div class="admin-desire-fill" style="width:${val}%"></div>
    </div>
  `;
}
