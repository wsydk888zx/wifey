// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
import { S, save, resetState } from '../state.js';
import { checkUnlocks, renderStory, transitionTo, showToast } from '../engine.js';
import { renderSchedulerAdmin } from './scheduler.js';
import { renderDesireDialAdmin } from './dial.js';

export function openAdmin() {
  // Stamp last-seen for presence indicator
  S.lastAdminSeen = Date.now();
  save();

  document.getElementById('admin-her').value = S.her;
  document.getElementById('admin-his').value = S.his;
  document.getElementById('admin-hours').value = S.hours;

  // Day 5 panel
  const d5 = S.chapters[4];
  const d5panel = document.getElementById('admin-day5-panel');
  if (d5 && d5.choices && d5.choices.decider === 'him' &&
    !(d5.choices.location && d5.choices.dinner && d5.choices.warmup &&
      d5.choices.oral && d5.choices.position && d5.choices.finish)) {
    d5panel.style.display = 'block';
  } else {
    d5panel.style.display = 'none';
  }

  // Render sub-panels
  const scheduleEl = document.getElementById('admin-scheduler');
  if (scheduleEl) renderSchedulerAdmin(scheduleEl);

  const dialEl = document.getElementById('admin-desire-dial');
  if (dialEl) renderDesireDialAdmin(dialEl);

  document.getElementById('admin-modal').classList.add('open');
}

export function closeAdmin() {
  const herVal = document.getElementById('admin-her').value.trim();
  const hisVal = document.getElementById('admin-his').value.trim();
  if (herVal) S.her = herVal;
  if (hisVal) S.his = hisVal;
  const h = parseInt(document.getElementById('admin-hours').value);
  if (!isNaN(h) && h > 0) { S.hours = h; save(); }
  document.getElementById('admin-modal').classList.remove('open');
}

export function adminSendDay5() {
  if (!S.chapters[4]) S.chapters[4] = { unlockedAt: Date.now(), completedAt: null, choices: {} };
  const c = S.chapters[4].choices;
  c.decider   = 'him';
  c.location  = document.getElementById('a5-location').value;
  c.dinner    = document.getElementById('a5-dinner').value;
  c.warmup    = document.getElementById('a5-warmup').value;
  c.oral      = document.getElementById('a5-oral').value;
  c.position  = document.getElementById('a5-position').value;
  c.finish    = document.getElementById('a5-finish').value;
  S.chapters[4].hisLetterOpened = false;
  S.chapters[4].envelopeOpened  = true;
  save();
  showToast('Your choices have been sent to her.');
  closeAdmin();
  renderStory();
}

export function adminUnlockNext() {
  checkUnlocks();
  for (let i = 0; i < 5; i++) {
    if (!S.chapters[i]) {
      const prev = S.chapters[i - 1];
      if (prev) {
        S.chapters[i] = { unlockedAt: Date.now(), completedAt: null, choices: {} };
        if (!prev.completedAt) prev.completedAt = Date.now();
      }
      save(); break;
    }
    if (!S.chapters[i].completedAt) {
      S.chapters[i].completedAt = Date.now();
      if (i + 1 < 5) S.chapters[i + 1] = { unlockedAt: Date.now(), completedAt: null, choices: {} };
      save(); break;
    }
  }
  closeAdmin(); renderStory();
}

export function adminUnlockAll() {
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    if (!S.chapters[i]) S.chapters[i] = { unlockedAt: now, completedAt: null, choices: {} };
    if (i < 4 && !S.chapters[i].completedAt) S.chapters[i].completedAt = now;
  }
  save(); closeAdmin(); renderStory();
}

export function adminReset() {
  if (!confirm('Reset everything? All story progress will be erased.')) return;
  resetState();
  closeAdmin();
  transitionTo('screen-setup', null);
}
