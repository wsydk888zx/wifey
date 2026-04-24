// ── STATE ─────────────────────────────────────────────────────────────────────
// localStorage schema v4. Handles migration from v3.

const SAVE_KEY_V4 = 'between_us_v4';
const SAVE_KEY_V3 = 'between_us_v3';

export function defaultState() {
  return {
    version: 4,
    her: '',
    his: '',
    tone: 'sensual',
    hours: 24,
    started: false,
    chapters: {},
    currentDay: 0,
    notifAsked: false,
    // New fields (v4)
    desireDial: 0,
    desireDialUpdated: null,
    triggerLog: [],
    scheduledMessages: [],
    lastAdminSeen: null,
  };
}

export let S = load();

export function load() {
  try {
    // Try v4 first
    const v4 = localStorage.getItem(SAVE_KEY_V4);
    if (v4) return Object.assign(defaultState(), JSON.parse(v4));

    // Migrate from v3
    const v3 = localStorage.getItem(SAVE_KEY_V3);
    if (v3) {
      const old = JSON.parse(v3);
      const migrated = Object.assign(defaultState(), old, { version: 4 });
      localStorage.setItem(SAVE_KEY_V4, JSON.stringify(migrated));
      return migrated;
    }
  } catch (e) {
    console.warn('State load error, using defaults:', e);
  }
  return defaultState();
}

export function save() {
  localStorage.setItem(SAVE_KEY_V4, JSON.stringify(S));
}

export function resetState() {
  localStorage.removeItem(SAVE_KEY_V4);
  localStorage.removeItem(SAVE_KEY_V3);
  S = defaultState();
}

// ── Name helpers ─────────────────────────────────────────────────────────────
export const her = () => escapeHTML(S.her || 'darling');
export const his = () => escapeHTML(S.his || 'him');
export const Her = () => cap(her());
export const His = () => cap(his());

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Build the context object passed to story functions
export function buildCtx() {
  const ac = allChoicesArray();
  return {
    her: her(),
    his: his(),
    Her: Her(),
    His: His(),
    d1: ac[0] || {},
    d2: ac[1] || {},
    d3: ac[2] || {},
    d4: ac[3] || {},
  };
}

export function allChoicesArray() {
  return [0, 1, 2, 3, 4].map(i => S.chapters[i] ? S.chapters[i].choices : {});
}

// ── XSS safety ───────────────────────────────────────────────────────────────
export function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
