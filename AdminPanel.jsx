// AdminPanel.jsx — Full content + flow admin panel

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const CONTENT_KEY = 'yoursWatching:contentEdits:v2';
const FLOW_KEY    = 'yoursWatching:flowMap:v2';

function makeRuleId() {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeDayId() {
  return `day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEnvelopeId(dayNumber, slotKey) {
  return `d${dayNumber}${slotKey[0]}-${Math.random().toString(36).slice(2, 6)}`;
}

const ENVELOPE_TIME_LABELS = ['Morning', 'Afternoon', 'Evening', 'Night', 'Late Night', 'After Midnight'];

function getDefaultTimeLabel(index = 0) {
  return ENVELOPE_TIME_LABELS[index] || `Envelope ${index + 1}`;
}

function inferLegacyTimeLabel(envelope, fallbackIndex = 0) {
  if (envelope?.timeLabel) return envelope.timeLabel;
  if (envelope?.slot === 'prologue') return 'Morning';
  if (envelope?.slot === 'morning') return 'Morning';
  if (envelope?.slot === 'evening') return 'Evening';
  return getDefaultTimeLabel(fallbackIndex);
}

const INPUT_TYPE_OPTIONS = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'single_select', label: 'Single Select' },
  { value: 'multi_select', label: 'Multiple Select' },
];

function normalizeInputType(type) {
  if (type === 'text') return 'short_text';
  if (type === 'textarea') return 'long_text';
  if (type === 'select') return 'single_select';
  if (type === 'multiselect') return 'multi_select';
  return type || 'short_text';
}

function isSelectInputType(type) {
  const normalized = normalizeInputType(type);
  return normalized === 'single_select' || normalized === 'multi_select';
}

function getInputTypeLabel(type) {
  const normalized = normalizeInputType(type);
  return INPUT_TYPE_OPTIONS.find((option) => option.value === normalized)?.label || 'Short Text';
}

function setValueAtPath(target, path, value) {
  const parts = path.split('.');
  let obj = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
}

function createEmptyEnvelope(dayNumber, slotKeyOrIndex = 0) {
  const timeLabel = typeof slotKeyOrIndex === 'string'
    ? (slotKeyOrIndex === 'morning' ? 'Morning' : slotKeyOrIndex === 'evening' ? 'Evening' : 'Morning')
    : getDefaultTimeLabel(slotKeyOrIndex);
  const slotKey = typeof slotKeyOrIndex === 'string' ? slotKeyOrIndex : `slot-${slotKeyOrIndex + 1}`;
  return {
    id: makeEnvelopeId(dayNumber, slotKey),
    slot: slotKey,
    timeLabel,
    label: `Day ${dayNumber} · ${timeLabel}`,
    sealMotif: String(dayNumber),
    intro: '',
    choicesHeading: '',
    choicesIntro: '',
    branchOnly: false,
    choices: [],
  };
}

function createEmptyDay(dayNumber) {
  return {
    id: makeDayId(),
    day: dayNumber,
    theme: `Day ${dayNumber}`,
    branchOnly: false,
    envelopes: [
      createEmptyEnvelope(dayNumber, 0),
      createEmptyEnvelope(dayNumber, 1),
    ],
  };
}

function getLegacyDayEnvelopes(day) {
  return ['prologue', 'morning', 'evening']
    .map((slot) => day?.[slot])
    .filter(Boolean);
}

function getDayEnvelopes(day) {
  const explicitEnvelopes = Array.isArray(day?.envelopes) ? day.envelopes.filter(Boolean) : [];
  const legacyEnvelopes = getLegacyDayEnvelopes(day);
  if (!explicitEnvelopes.length) return legacyEnvelopes;

  const explicitKeys = new Set(
    explicitEnvelopes.map((envelope) => envelope.id || envelope.slot || '').filter(Boolean)
  );

  const missingLegacyEnvelopes = legacyEnvelopes.filter((envelope) => {
    const key = envelope.id || envelope.slot || '';
    return !key || !explicitKeys.has(key);
  });

  return [...missingLegacyEnvelopes, ...explicitEnvelopes];
}

function normalizeEnvelope(envelope, dayNumber, envelopeIndex, inheritedBranchOnly = false, branchGroup = '') {
  const next = deepClone(envelope || {});
  next.slot = next.slot || `slot-${envelopeIndex + 1}`;
  next.timeLabel = inferLegacyTimeLabel(next, envelopeIndex);
  next.label = next.label || `Day ${dayNumber} · ${next.timeLabel}`;
  next.sealMotif = next.sealMotif || String(dayNumber);
  next.branchOnly = !!(next.branchOnly || inheritedBranchOnly);
  if (branchGroup) next.branchGroup = branchGroup;
  next.choices = Array.isArray(next.choices) ? next.choices : [];
  return next;
}

function normalizeDayPrelude(day, dayNumber) {
  const next = deepClone(day?.dayPrelude || {});
  return {
    enabled: !!next.enabled,
    kicker: next.kicker || `Day ${toRoman(dayNumber)}`,
    heading: next.heading || `Before Day ${dayNumber} Begins`,
    body: next.body || 'A brief, beautiful lead-in for this day. Use it to set mood, location, or emotional tension before the first envelope opens.',
    buttonLabel: next.buttonLabel || 'Begin the day',
  };
}

function normalizeContentModel(source) {
  const content = deepClone(source || window.GAME_CONTENT || {});
  const incomingDays = Array.isArray(content.days) ? content.days : [];
  const baseDays = incomingDays.slice(0, 5).map((day, index) => ({
    ...day,
    day: index + 1,
    dayPrelude: normalizeDayPrelude(day, index + 1),
    envelopes: getDayEnvelopes(day).map((envelope, envelopeIndex) =>
      normalizeEnvelope(envelope, index + 1, envelopeIndex, !!day?.branchOnly)
    ),
  }));

  const dayFive = baseDays[4];
  const overflowDays = incomingDays.slice(5);

  if (dayFive && overflowDays.length) {
    overflowDays.forEach((day) => {
      getDayEnvelopes(day).forEach((envelope) => {
        dayFive.envelopes.push(
          normalizeEnvelope(envelope, 5, dayFive.envelopes.length, !!day?.branchOnly, day?.id || '')
        );
      });
    });
  }

  content.days = baseDays;
  return content;
}

function toRoman(num) {
  const numerals = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
    ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
    ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
  ];
  let n = Math.max(1, num);
  let out = '';
  numerals.forEach(([symbol, value]) => {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  });
  return out;
}

function normalizeFlowMap(data) {
  if (data && Array.isArray(data.rules)) {
    return { rules: data.rules };
  }
  if (data && typeof data === 'object') {
    const rules = [];
    Object.entries(data).forEach(([sourceChoiceId, targetIds]) => {
      if (!Array.isArray(targetIds)) return;
      targetIds.forEach((targetEnvelopeId, index) => {
        rules.push({
          id: `legacy-${sourceChoiceId}-${targetEnvelopeId}-${index}`,
          sourceChoiceId,
          sourceFieldId: '',
          operator: 'always',
          value: '',
          targetEnvelopeId,
        });
      });
    });
    return { rules };
  }
  return { rules: [] };
}

function buildCompleteFlowMap(content, rawFlowMap) {
  const normalizedContent = normalizeContentModel(content);
  const explicit = normalizeFlowMap(rawFlowMap);
  const explicitRules = Array.isArray(explicit.rules) ? explicit.rules : [];
  const items = [];

  normalizedContent.days.forEach((day, dayIndex) => {
    getDayEnvelopes(day).forEach((envelope, envelopeIndex) => {
      items.push({
        dayIndex,
        envelopeIndex,
        day,
        envelope,
        dayId: day.id || `day-${dayIndex + 1}`,
        branchOnly: !!(day?.branchOnly || envelope?.branchOnly),
        branchGroup: envelope?.branchGroup || '',
      });
    });
  });

  const generatedRules = [];

  items.forEach((item, itemIndex) => {
    const choices = Array.isArray(item.envelope?.choices) ? item.envelope.choices : [];
    if (!choices.length) return;

    let nextTarget = null;
    if (item.branchGroup) {
      nextTarget = items.slice(itemIndex + 1).find((candidate) => candidate.branchGroup === item.branchGroup) || null;
    } else {
      nextTarget = items.slice(itemIndex + 1).find((candidate) => !candidate.branchOnly) || null;
    }

    if (!nextTarget?.envelope?.id) return;

    choices.forEach((choice) => {
      const hasDefaultRoute = explicitRules.some((rule) => rule.sourceChoiceId === choice.id && rule.operator === 'always');
      if (hasDefaultRoute) return;
      generatedRules.push({
        id: `generated-${choice.id}-${nextTarget.envelope.id}`,
        sourceChoiceId: choice.id,
        sourceFieldId: '',
        operator: 'always',
        value: '',
        targetEnvelopeId: nextTarget.envelope.id,
        generated: true,
      });
    });
  });

  return { rules: [...explicitRules, ...generatedRules] };
}

function getEditorDayStableId(day, dayIndex) {
  if (day?.id) return day.id;
  const envelopeSignature = JSON.stringify(
    (day?.envelopes || []).map((envelope) => envelope?.id || envelope?.label || envelope?.timeLabel || envelope?.slot || '')
  );
  return `day:${day?.theme || ''}:${envelopeSignature}`;
}

function getEditorEnvelopeStableId(envelope, dayIndex, envIndex) {
  if (envelope?.id) return envelope.id;
  const choiceSignature = JSON.stringify(
    (envelope?.choices || []).map((choice) => choice?.id || choice?.title || choice?.hint || '')
  );
  return `env:${envelope?.slot || ''}:${envelope?.timeLabel || ''}:${envelope?.label || ''}:${choiceSignature}`;
}

function getEditorChoiceStableId(choice, envelopeStableId, choiceIndex) {
  if (choice?.id) return `${envelopeStableId}::${choice.id}`;
  return `${envelopeStableId}::choice:${choice?.title || ''}:${choice?.hint || ''}:${choice?.card?.heading || ''}`;
}

function buildEditorDayLookup(content) {
  const byKey = new Map();
  const byStableId = new Map();

  (content?.days || []).forEach((day, dayIndex) => {
    const key = String(dayIndex);
    const stableId = getEditorDayStableId(day, dayIndex);
    byKey.set(key, stableId);
    byStableId.set(stableId, key);
  });

  return { byKey, byStableId };
}

function buildEditorEnvelopeLookup(content) {
  const byKey = new Map();
  const byStableId = new Map();

  (content?.days || []).forEach((day, dayIndex) => {
    (day?.envelopes || []).forEach((envelope, envIndex) => {
      const key = `${dayIndex}-${envIndex}`;
      const stableId = getEditorEnvelopeStableId(envelope, dayIndex, envIndex);
      byKey.set(key, stableId);
      byStableId.set(stableId, key);
    });
  });

  return { byKey, byStableId };
}

function buildEditorChoiceLookup(content) {
  const byKey = new Map();
  const byStableId = new Map();

  (content?.days || []).forEach((day, dayIndex) => {
    (day?.envelopes || []).forEach((envelope, envIndex) => {
      const envelopeStableId = getEditorEnvelopeStableId(envelope, dayIndex, envIndex);
      (envelope?.choices || []).forEach((choice, choiceIndex) => {
        const key = `${dayIndex}-${envIndex}-${choiceIndex}`;
        const stableId = getEditorChoiceStableId(choice, envelopeStableId, choiceIndex);
        byKey.set(key, stableId);
        byStableId.set(stableId, key);
      });
    });
  });

  return { byKey, byStableId };
}

function remapEditorObjectKeys(source, beforeLookup, afterLookup) {
  return Object.entries(source || {}).reduce((acc, [oldKey, value]) => {
    const stableId = beforeLookup.byKey.get(oldKey);
    const nextKey = stableId ? afterLookup.byStableId.get(stableId) : null;
    if (nextKey) acc[nextKey] = value;
    return acc;
  }, {});
}

function remapEditorSetKeys(sourceSet, beforeLookup, afterLookup, parseKey = (key) => key) {
  const next = new Set();
  (sourceSet || new Set()).forEach((oldKey) => {
    const stableId = beforeLookup.byKey.get(String(oldKey));
    const nextKey = stableId ? afterLookup.byStableId.get(stableId) : null;
    if (nextKey !== undefined && nextKey !== null) next.add(parseKey(nextKey));
  });
  return next;
}

function applyStoryChoiceEdits(base, edits) {
  const next = deepClone(base);
  Object.entries(edits || {}).forEach(([key, fields]) => {
    const parts = key.split('-');
    const choice = next.days[+parts[0]]?.envelopes?.[+parts[1]]?.choices?.[+parts[2]];
    if (!choice) return;
    if (!choice.card) choice.card = {};
    if (fields.title !== undefined) choice.title = fields.title;
    if (fields.hint !== undefined) choice.hint = fields.hint;
    if (fields.heading !== undefined) choice.card.heading = fields.heading;
    if (fields.body !== undefined) choice.card.body = fields.body;
    if (fields.rule !== undefined) choice.card.rule = fields.rule;
  });
  return next;
}

// ── Deep-clone helper ─────────────────────────────────────────────────────────
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Content storage ───────────────────────────────────────────────────────────
function loadContentEdits() {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (raw) return normalizeContentModel(JSON.parse(raw));
  } catch {}
  return normalizeContentModel(window.GAME_CONTENT);
}

function saveContentEdits(c) {
  try { localStorage.setItem(CONTENT_KEY, JSON.stringify(normalizeContentModel(c))); } catch {}
}

function loadFlowMap() {
  try {
    const raw = localStorage.getItem(FLOW_KEY);
    if (raw) return buildCompleteFlowMap(loadContentEdits(), JSON.parse(raw));
  } catch {}
  return buildCompleteFlowMap(loadContentEdits(), window.DEFAULT_FLOW_MAP || { rules: [] });
}

function saveFlowMap(m) {
  try { localStorage.setItem(FLOW_KEY, JSON.stringify(m)); } catch {}
}

// ── Snapshot storage ──────────────────────────────────────────────────────────
const SNAPSHOTS_KEY = 'yoursWatching:snapshots:v1';
const MAX_SNAPSHOTS = 10;

function loadSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveSnapshots(snaps) {
  try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps)); } catch {}
}

// ── Public API: other components call this to get (possibly edited) content ──
window.getGameContent = function() {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (raw) return normalizeContentModel(JSON.parse(raw));
  } catch {}
  return normalizeContentModel(window.GAME_CONTENT);
};
window.normalizeGameContent = normalizeContentModel;
window.getDayEnvelopes = getDayEnvelopes;
window.buildCompleteFlowMap = buildCompleteFlowMap;

// ── Placeholder system ────────────────────────────────────────────────────────
// Supported tokens: {{herName}} {{hisName}} {{HerName}} {{HisName}}
// Legacy {her} / {his} tokens still work too.
// Call window.replacePlaceholders(text, { herName, hisName }) from anywhere.
window.replacePlaceholders = function(text, tweaks) {
  if (!text || typeof text !== 'string') return text;
  const her = (tweaks?.herName || 'her').toLowerCase();
  const his = (tweaks?.hisName || 'him').toLowerCase();
  const Her = her.charAt(0).toUpperCase() + her.slice(1);
  const His = his.charAt(0).toUpperCase() + his.slice(1);
  return text
    .replace(/\{\{HerName\}\}/g, Her)
    .replace(/\{\{HisName\}\}/g, His)
    .replace(/\{\{herName\}\}/g, her)
    .replace(/\{\{hisName\}\}/g, his)
    .replace(/\{Her\}/g, Her)
    .replace(/\{His\}/g, His)
    .replace(/\{her\}/g, her)
    .replace(/\{his\}/g, his);
};

const PLACEHOLDERS = [
  { token: '{{herName}}', label: 'Her name', desc: 'insert the name from settings' },
  { token: '{{hisName}}', label: 'His name', desc: 'insert the name from settings' },
  { token: '{{HerName}}', label: 'Her name caps', desc: 'insert the capitalized name from settings' },
  { token: '{{HisName}}', label: 'His name caps', desc: 'insert the capitalized name from settings' },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(6px)',
    zIndex: 900,
    display: 'flex',
    fontFamily: "'Inter', sans-serif",
  },
  sidebar: {
    width: 200,
    minWidth: 200,
    borderRight: '1px solid rgba(201,169,97,0.15)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    background: 'rgba(10,8,6,0.6)',
    flexShrink: 0,
  },
  sideTitle: {
    color: 'rgba(201,169,97,0.5)',
    fontSize: 9,
    letterSpacing: '0.35em',
    textTransform: 'uppercase',
    padding: '0 20px 16px',
    borderBottom: '1px solid rgba(201,169,97,0.08)',
    marginBottom: 8,
  },
  navBtn: (active) => ({
    background: active ? 'rgba(201,169,97,0.08)' : 'transparent',
    border: 'none',
    borderLeft: active ? '2px solid rgba(201,169,97,0.6)' : '2px solid transparent',
    color: active ? 'rgba(237,227,209,0.9)' : 'rgba(237,227,209,0.4)',
    fontSize: 12,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '10px 20px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.15s',
  }),
  navSection: {
    color: 'rgba(201,169,97,0.3)',
    fontSize: 9,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    padding: '16px 20px 6px',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 28px',
    borderBottom: '1px solid rgba(201,169,97,0.12)',
    flexShrink: 0,
  },
  headerTitle: {
    color: 'rgba(237,227,209,0.8)',
    fontSize: 13,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid rgba(201,169,97,0.2)',
    color: 'rgba(201,169,97,0.5)',
    fontSize: 18,
    lineHeight: 1,
    width: 32, height: 32,
    cursor: 'pointer',
    borderRadius: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    padding: '24px 28px',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    color: 'rgba(201,169,97,0.5)',
    fontSize: 9,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(201,169,97,0.15)',
    borderRadius: 2,
    color: 'rgba(237,227,209,0.85)',
    fontSize: 13,
    padding: '8px 10px',
    fontFamily: "'Inter', sans-serif",
    boxSizing: 'border-box',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(201,169,97,0.15)',
    borderRadius: 2,
    color: 'rgba(237,227,209,0.85)',
    fontSize: 12,
    padding: '8px 10px',
    fontFamily: "'Inter', sans-serif",
    boxSizing: 'border-box',
    resize: 'vertical',
    lineHeight: 1.6,
    outline: 'none',
  },
  sectionHead: {
    color: 'rgba(237,227,209,0.7)',
    fontSize: 11,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    marginBottom: 14,
    marginTop: 28,
    borderBottom: '1px solid rgba(201,169,97,0.1)',
    paddingBottom: 8,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(201,169,97,0.1)',
    borderRadius: 4,
    padding: '16px',
    marginBottom: 12,
  },
  cardTitle: {
    color: 'rgba(201,169,97,0.7)',
    fontSize: 10,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandBtn: {
    background: 'transparent',
    border: '1px solid rgba(201,169,97,0.2)',
    color: 'rgba(201,169,97,0.5)',
    fontSize: 10,
    padding: '3px 8px',
    cursor: 'pointer',
    borderRadius: 2,
    letterSpacing: '0.1em',
  },
  btn: {
    background: 'rgba(201,169,97,0.1)',
    border: '1px solid rgba(201,169,97,0.3)',
    color: 'rgba(237,227,209,0.8)',
    fontSize: 11,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    padding: '9px 18px',
    cursor: 'pointer',
    borderRadius: 2,
    transition: 'all 0.15s',
  },
  btnDanger: {
    background: 'rgba(180,60,60,0.1)',
    border: '1px solid rgba(180,60,60,0.3)',
    color: 'rgba(220,140,140,0.8)',
    fontSize: 11,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    padding: '9px 18px',
    cursor: 'pointer',
    borderRadius: 2,
  },
  btnRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  toast: {
    position: 'fixed',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(201,169,97,0.15)',
    border: '1px solid rgba(201,169,97,0.3)',
    color: 'rgba(237,227,209,0.9)',
    fontSize: 11,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    padding: '10px 20px',
    borderRadius: 2,
    zIndex: 9999,
    pointerEvents: 'none',
  },
  addBtn: {
    background: 'transparent',
    border: '1px dashed rgba(201,169,97,0.25)',
    color: 'rgba(201,169,97,0.4)',
    fontSize: 10,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    padding: '8px 14px',
    cursor: 'pointer',
    borderRadius: 2,
    width: '100%',
    marginTop: 6,
  },
  removeBtn: {
    background: 'transparent',
    border: '1px solid rgba(180,60,60,0.25)',
    color: 'rgba(180,60,60,0.5)',
    fontSize: 10,
    padding: '3px 8px',
    cursor: 'pointer',
    borderRadius: 2,
  },
  splitPreview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 18,
    alignItems: 'start',
  },
  previewPane: {
    position: 'sticky',
    top: 0,
    alignSelf: 'start',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(201,169,97,0.1)',
    borderRadius: 4,
    padding: 16,
  },
  previewCard: {
    background: 'linear-gradient(180deg, rgba(246,236,216,0.98) 0%, rgba(237,227,209,0.95) 100%)',
    color: '#1a0f08',
    borderRadius: 4,
    padding: 18,
    boxShadow: '0 14px 34px -20px rgba(0,0,0,0.55)',
    marginBottom: 12,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5,4,3,0.72)',
    backdropFilter: 'blur(8px)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: 'min(960px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
    background: 'rgba(18,14,11,0.96)',
    border: '1px solid rgba(201,169,97,0.18)',
    boxShadow: '0 28px 80px rgba(0,0,0,0.45)',
    padding: 22,
    borderRadius: 4,
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
};

// ── PlaceholderBar ────────────────────────────────────────────────────────────
function PlaceholderBar({ inputRef, tweaks, value, onChange }) {
  // Live preview — only show if text contains a placeholder token
  const hasToken = value && /\{her\}|\{his\}|\{Her\}|\{His\}|\{\{herName\}\}|\{\{hisName\}\}|\{\{HerName\}\}|\{\{HisName\}\}/.test(value);
  const preview  = hasToken && tweaks ? window.replacePlaceholders(value, tweaks) : null;

  return (
    <div style={{ marginBottom: 4 }}>
      {preview && (
        <div style={{
          padding: '5px 8px',
          background: 'rgba(201,169,97,0.04)',
          border: '1px solid rgba(201,169,97,0.1)',
          borderRadius: 2,
          color: 'rgba(237,227,209,0.45)',
          fontSize: 10,
          fontStyle: 'italic',
          lineHeight: 1.5,
          marginBottom: 4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          <span style={{ color: 'rgba(201,169,97,0.35)', fontStyle: 'normal', marginRight: 5 }}>preview →</span>
          {preview.length > 160 ? preview.slice(0, 160) + '…' : preview}
        </div>
      )}
    </div>
  );
}

// ── Field components ──────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'input', rows = 4, tweaks }) {
  const inputRef = useRef(null);
  return (
    <div style={S.field}>
      <label style={S.label}>{label}</label>
      <PlaceholderBar inputRef={inputRef} tweaks={tweaks} value={value} onChange={onChange} />
      {type === 'input' ? (
        <input
          ref={inputRef}
          style={S.input}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <textarea
          ref={inputRef}
          style={S.textarea}
          value={value}
          rows={rows}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ── Choice Editor ─────────────────────────────────────────────────────────────
function ChoiceEditor({ choice, dayIndex, slotKey, choiceIndex, onUpdate, onRemove, tweaks }) {
  const [open, setOpen] = useState(false);
  const update = (path, val) => onUpdate(dayIndex, slotKey, choiceIndex, path, val);
  const inputs = Array.isArray(choice.card?.inputs) ? choice.card.inputs : [];
  const rp = (text) => window.replacePlaceholders ? window.replacePlaceholders(text, tweaks) : text;

  const updateInput = (inputIndex, field, value) => {
    const nextInputs = inputs.map((input, idx) => idx === inputIndex ? { ...input, [field]: value } : input);
    update('card.inputs', nextInputs);
  };

  const removeInput = (inputIndex) => {
    const nextInputs = inputs.filter((_, idx) => idx !== inputIndex);
    update('card.inputs', nextInputs);
  };

  const addInput = () => {
    const nextInputs = [
      ...inputs,
      {
        id: `field-${Date.now()}`,
        label: 'New field',
        type: 'text',
        required: false,
        placeholder: '',
        helpText: '',
        options: ['Option 1', 'Option 2'],
      },
    ];
    update('card.inputs', nextInputs);
  };

  return (
    <div style={{ ...S.card, borderColor: open ? 'rgba(201,169,97,0.25)' : 'rgba(201,169,97,0.1)' }}>
      <div style={S.cardTitle}>
        <span>Choice {choiceIndex + 1} — {choice.title || 'untitled'}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.expandBtn} onClick={() => setOpen(v => !v)}>
            {open ? 'collapse' : 'edit'}
          </button>
          <button style={S.removeBtn} onClick={() => onRemove(dayIndex, slotKey, choiceIndex)}>
            ✕
          </button>
        </div>
      </div>

      {open && (
        <div style={S.splitPreview}>
          <div>
            <Field label="Choice ID" value={choice.id} onChange={v => update('id', v)} tweaks={tweaks} />
            <Field label="Title" value={choice.title} onChange={v => update('title', v)} tweaks={tweaks} />
            <Field label="Hint" value={choice.hint} onChange={v => update('hint', v)} tweaks={tweaks} />
            <Field label="Card — Heading" value={choice.card?.heading || ''} onChange={v => update('card.heading', v)} tweaks={tweaks} />
            <Field label="Card — Body" value={choice.card?.body || ''} onChange={v => update('card.body', v)} type="textarea" rows={6} tweaks={tweaks} />
            <Field label="Card — Rule / Footer" value={choice.card?.rule || ''} onChange={v => update('card.rule', v)} type="textarea" rows={3} tweaks={tweaks} />

            <div style={{ marginTop: 16, marginBottom: 8, color: 'rgba(201,169,97,0.4)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              Response Fields ({inputs.length})
            </div>

            {inputs.map((input, inputIndex) => (
              <div key={input.id || inputIndex} style={{ ...S.card, background: 'rgba(255,255,255,0.02)', marginBottom: 10 }}>
                <div style={S.cardTitle}>
                  <span>Field {inputIndex + 1} — {input.label || 'untitled'}</span>
                  <button style={S.removeBtn} onClick={() => removeInput(inputIndex)}>✕</button>
                </div>
                <Field label="Field ID" value={input.id || ''} onChange={v => updateInput(inputIndex, 'id', v)} tweaks={tweaks} />
                <Field label="Label" value={input.label || ''} onChange={v => updateInput(inputIndex, 'label', v)} tweaks={tweaks} />
                <div style={S.field}>
                  <label style={S.label}>Field Type</label>
                  <select
                    style={S.input}
                    value={input.type || 'text'}
                    onChange={e => updateInput(inputIndex, 'type', e.target.value)}
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="select">Dropdown</option>
                  </select>
                </div>
                <Field label="Placeholder" value={input.placeholder || ''} onChange={v => updateInput(inputIndex, 'placeholder', v)} tweaks={tweaks} />
                <Field label="Help Text" value={input.helpText || ''} onChange={v => updateInput(inputIndex, 'helpText', v)} tweaks={tweaks} />
                <div style={S.field}>
                  <label style={S.label}>Required</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(237,227,209,0.7)', fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={!!input.required}
                      onChange={e => updateInput(inputIndex, 'required', e.target.checked)}
                    />
                    Must be filled before the user can continue
                  </label>
                </div>
                {input.type === 'select' && (
                  <Field
                    label="Dropdown Options (one per line)"
                    value={Array.isArray(input.options) ? input.options.join('\n') : ''}
                    onChange={v => updateInput(inputIndex, 'options', v.split('\n').map(s => s.trim()).filter(Boolean))}
                    type="textarea"
                    rows={4}
                    tweaks={tweaks}
                  />
                )}
              </div>
            ))}

            <button style={S.addBtn} onClick={addInput}>
              + Add Response Field
            </button>
          </div>

          <div style={S.previewPane}>
            <div style={{ ...S.cardTitle, marginBottom: 10 }}>
              <span>Live Preview</span>
            </div>
            <div style={{ color: 'rgba(237,227,209,0.45)', fontSize: 11, lineHeight: 1.6, marginBottom: 14 }}>
              This shows how the choice appears on the path-selection screen and how the opened letter reads after it is chosen.
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>
                Path Button
              </div>
              <div style={{ ...S.card, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
                  path
                </div>
                <div style={{ color: 'rgba(237,227,209,0.85)', fontSize: 20, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', marginBottom: 6 }}>
                  {rp(choice.title || 'Untitled choice')}
                </div>
                <div style={{ color: 'rgba(237,227,209,0.55)', fontSize: 12, lineHeight: 1.5 }}>
                  {rp(choice.hint || 'Hint text appears here.')}
                </div>
              </div>
            </div>

            <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>
              Opened Letter
            </div>
            <div style={S.previewCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div style={{ color: '#4a0d15', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase' }}>Envelope Preview</div>
                <div style={{ color: '#8a7440', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Path {choiceIndex + 1}</div>
              </div>
              <div style={{ color: '#2a0608', fontSize: 34, lineHeight: 1.1, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', marginBottom: 18 }}>
                {rp(choice.card?.heading || 'Heading preview')}
              </div>
              <div style={{ color: '#1a0f08', fontSize: 16, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
                {rp(choice.card?.body || 'Body preview')}
              </div>
              {choice.card?.rule && (
                <div style={{ padding: '12px 14px', background: 'rgba(74,13,21,0.06)', borderLeft: '2px solid #4a0d15', color: '#2a0608', fontSize: 15, lineHeight: 1.6, fontStyle: 'italic', marginBottom: 16 }}>
                  <div style={{ color: '#4a0d15', fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 4, fontStyle: 'normal' }}>The Rule</div>
                  {rp(choice.card.rule)}
                </div>
              )}
              {!!inputs.length && (
                <div style={{ padding: '12px 14px', background: 'rgba(74,13,21,0.04)', border: '1px solid rgba(120,95,60,0.18)' }}>
                  <div style={{ color: '#4a0d15', fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 8 }}>Response Fields</div>
                  {inputs.map((input, inputIndex) => (
                    <div key={input.id || inputIndex} style={{ marginBottom: inputIndex === inputs.length - 1 ? 0 : 10 }}>
                      <div style={{ color: '#8a7440', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                        {rp(input.label || `Field ${inputIndex + 1}`)}{input.required ? ' *' : ''}
                      </div>
                      {input.helpText ? (
                        <div style={{ color: 'rgba(26,15,8,0.7)', fontSize: 13, lineHeight: 1.5, marginBottom: 5 }}>
                          {rp(input.helpText)}
                        </div>
                      ) : null}
                      <div style={{ color: 'rgba(26,15,8,0.45)', fontSize: 12 }}>
                        {input.type === 'select'
                          ? `Dropdown: ${(input.options || []).join(', ') || 'No options yet'}`
                          : input.type === 'textarea'
                          ? 'Long text response'
                          : 'Short text response'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Envelope Editor ───────────────────────────────────────────────────────────
function EnvelopeEditor({ envelope, dayIndex, slotKey, onUpdate, onUpdateChoice, onRemoveChoice, onAddChoice, tweaks }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(201,169,97,0.1)',
        borderRadius: 3,
        cursor: 'pointer',
      }} onClick={() => setOpen(v => !v)}>
        <span style={{ color: 'rgba(237,227,209,0.7)', fontSize: 12, letterSpacing: '0.1em' }}>
          {slotKey === 'morning' ? '🌅' : '🌙'} {envelope.label}
        </span>
        <span style={{ color: 'rgba(201,169,97,0.4)', fontSize: 18, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </div>

      {open && (
        <div style={{ padding: '14px 14px 4px', border: '1px solid rgba(201,169,97,0.08)', borderTop: 'none', borderRadius: '0 0 3px 3px' }}>
          <Field label="Label" value={envelope.label} onChange={v => onUpdate(dayIndex, slotKey, 'label', v)} tweaks={tweaks} />
          <Field label="Envelope ID" value={envelope.id || ''} onChange={v => onUpdate(dayIndex, slotKey, 'id', v)} tweaks={tweaks} />
          <Field label="Seal Motif" value={envelope.sealMotif} onChange={v => onUpdate(dayIndex, slotKey, 'sealMotif', v)} tweaks={tweaks} />
          <Field label="Intro Text" value={envelope.intro} onChange={v => onUpdate(dayIndex, slotKey, 'intro', v)} type="textarea" rows={3} tweaks={tweaks} />
          <div style={S.field}>
            <label style={S.label}>Branch-only envelope</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(237,227,209,0.7)', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={!!envelope.branchOnly}
                onChange={e => onUpdate(dayIndex, slotKey, 'branchOnly', e.target.checked)}
              />
              Hide this envelope from the normal sequence unless a branch jumps to its day
            </label>
          </div>
          <Field
            label="Choice Screen Heading"
            value={envelope.choicesHeading || ''}
            onChange={v => onUpdate(dayIndex, slotKey, 'choicesHeading', v)}
            tweaks={tweaks}
          />
          <Field
            label="Choice Screen Intro"
            value={envelope.choicesIntro || ''}
            onChange={v => onUpdate(dayIndex, slotKey, 'choicesIntro', v)}
            type="textarea"
            rows={3}
            tweaks={tweaks}
          />

          <div style={{ marginTop: 16, marginBottom: 8, color: 'rgba(201,169,97,0.4)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            Choices ({envelope.choices.length})
          </div>

          {envelope.choices.map((choice, ci) => (
            <ChoiceEditor
              key={choice.id || ci}
              choice={choice}
              dayIndex={dayIndex}
              slotKey={slotKey}
              choiceIndex={ci}
              onUpdate={onUpdateChoice}
              onRemove={onRemoveChoice}
              tweaks={tweaks}
            />
          ))}

          <button style={S.addBtn} onClick={() => onAddChoice(dayIndex, slotKey)}>
            + Add Choice
          </button>
        </div>
      )}
    </div>
  );
}

// ── Day Editor ────────────────────────────────────────────────────────────────
function DayEditor({ day, dayIndex, onUpdate, onUpdateEnvelope, onUpdateChoice, onRemoveChoice, onAddChoice, onRemoveDay, tweaks }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: open ? 'rgba(201,169,97,0.06)' : 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(201,169,97,0.18)',
        borderRadius: 3,
        cursor: 'pointer',
      }} onClick={() => setOpen(v => !v)}>
        <div>
          <span style={{ color: 'rgba(201,169,97,0.8)', fontSize: 13, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', marginRight: 10 }}>
            Day {toRoman(dayIndex + 1)}
          </span>
          <span style={{ color: 'rgba(237,227,209,0.5)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {day.theme}
          </span>
        </div>
        <span style={{ color: 'rgba(201,169,97,0.5)', fontSize: 20, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </div>

      {open && (
        <div style={{ padding: '16px 14px', border: '1px solid rgba(201,169,97,0.12)', borderTop: 'none', borderRadius: '0 0 3px 3px' }}>
          <Field label="Day ID" value={day.id || ''} onChange={v => onUpdate(dayIndex, 'id', v)} tweaks={tweaks} />
          <Field label="Theme" value={day.theme} onChange={v => onUpdate(dayIndex, 'theme', v)} tweaks={tweaks} />
          <div style={S.field}>
            <label style={S.label}>Branch-only day</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(237,227,209,0.7)', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={!!day.branchOnly}
                onChange={e => onUpdate(dayIndex, 'branchOnly', e.target.checked)}
              />
              Hide this day from the normal sequence unless a branch jumps to it
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <EnvelopeEditor
              envelope={day.morning}
              dayIndex={dayIndex}
              slotKey="morning"
              onUpdate={onUpdateEnvelope}
              onUpdateChoice={onUpdateChoice}
              onRemoveChoice={onRemoveChoice}
              onAddChoice={onAddChoice}
              tweaks={tweaks}
            />
            <EnvelopeEditor
              envelope={day.evening}
              dayIndex={dayIndex}
              slotKey="evening"
              onUpdate={onUpdateEnvelope}
              onUpdateChoice={onUpdateChoice}
              onRemoveChoice={onRemoveChoice}
              onAddChoice={onAddChoice}
              tweaks={tweaks}
            />
          </div>
          <div style={S.btnRow}>
            <button style={S.btnDanger} onClick={() => onRemoveDay(dayIndex)}>Remove Day</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Flow Map ──────────────────────────────────────────────────────────────────
function FlowMap({ content, flowMap, setFlowMap }) {
  const rules = Array.isArray(flowMap?.rules) ? flowMap.rules : [];

  const envelopeOptions = useMemo(() => {
    const result = [];
    content.days.forEach((day, di) => {
      getDayEnvelopes(day).forEach((env, envelopeIndex) => {
        if (!env) return;
        result.push({
          id: env.id,
          label: `Day ${di + 1} · ${env.timeLabel || getDefaultTimeLabel(envelopeIndex)}`,
          subtitle: env.label || `${day.theme} envelope ${envelopeIndex + 1}`,
          dayTheme: day.theme,
          slotKey: env.slot || `slot-${envelopeIndex + 1}`,
        });
      });
    });
    return result;
  }, [content]);

  const choiceOptions = useMemo(() => {
    const result = [];
    content.days.forEach((day, di) => {
      getDayEnvelopes(day).forEach((env, envelopeIndex) => {
        if (!env) return;
        (env.choices || []).forEach((choice) => {
          const fields = Array.isArray(choice.card?.inputs) ? choice.card.inputs : [];
          result.push({
            id: choice.id,
            title: choice.title || choice.id,
            hint: choice.hint || '',
            dayLabel: `Day ${di + 1}`,
            envelopeLabel: env.label || `${env.timeLabel || getDefaultTimeLabel(envelopeIndex)} envelope`,
            label: `Day ${di + 1} · ${env.timeLabel || getDefaultTimeLabel(envelopeIndex)} · ${choice.title || choice.id}`,
            fields,
          });
        });
      });
    });
    return result;
  }, [content]);

  const updateRules = (nextRules) => {
    const next = { rules: nextRules };
    saveFlowMap(next);
    setFlowMap(next);
  };

  const makeNewRule = (sourceChoiceId) => ({
    id: makeRuleId(),
    sourceChoiceId: sourceChoiceId || choiceOptions[0]?.id || '',
    sourceFieldId: '',
    operator: 'always',
    value: '',
    targetEnvelopeId: envelopeOptions[0]?.id || '',
  });

  const [newSourceChoiceId, setNewSourceChoiceId] = useState(() => choiceOptions[0]?.id || '');

  useEffect(() => {
    if (!choiceOptions.length) {
      setNewSourceChoiceId('');
      return;
    }
    if (!choiceOptions.some((choice) => choice.id === newSourceChoiceId)) {
      setNewSourceChoiceId(choiceOptions[0].id);
    }
  }, [choiceOptions, newSourceChoiceId]);

  const addRule = (sourceChoiceId = newSourceChoiceId) => {
    updateRules([...rules, makeNewRule(sourceChoiceId)]);
  };

  const updateRule = (ruleId, field, value) => {
    updateRules(rules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      const nextRule = { ...rule, [field]: value };
      if (field === 'sourceChoiceId') {
        nextRule.sourceFieldId = '';
      }
      if (field === 'operator' && (value === 'always' || value === 'is_filled')) {
        nextRule.value = '';
      }
      return nextRule;
    }));
  };

  const removeRule = (ruleId) => {
    updateRules(rules.filter(rule => rule.id !== ruleId));
  };

  const rulesByChoice = useMemo(() => {
    const grouped = new Map();
    rules.forEach((rule) => {
      if (!grouped.has(rule.sourceChoiceId)) grouped.set(rule.sourceChoiceId, []);
      grouped.get(rule.sourceChoiceId).push(rule);
    });
    return grouped;
  }, [rules]);

  // Build auto-route map (what each choice goes to by default, without explicit rules)
  const autoRouteMap = useMemo(() => {
    const generated = buildCompleteFlowMap(content, { rules: [] });
    const map = new Map();
    (generated.rules || []).forEach(rule => {
      if (!map.has(rule.sourceChoiceId)) map.set(rule.sourceChoiceId, rule.targetEnvelopeId);
    });
    return map;
  }, [content]);

  const mappedChoices = choiceOptions
    .map((choice) => ({ choice, rules: rulesByChoice.get(choice.id) || [] }))
    .filter((item) => item.rules.length);

  const unmappedChoices = choiceOptions.filter(c => !(rulesByChoice.get(c.id) || []).length);

  const describeRule = (rule, field) => {
    if (rule.operator === 'always') return 'Always branch after this choice';
    if (!field) return 'This route checks a response field';
    if (rule.operator === 'is_filled') return `${field.label || field.id} has any answer`;
    if (rule.operator === 'equals') return `${field.label || field.id} matches "${rule.value || '...'}"`;
    if (rule.operator === 'contains') return `${field.label || field.id} contains "${rule.value || '...'}"`;
    return 'Custom route';
  };

  return (
    <div className="flowmap-workspace">
      <div className="flowmap-toolbar">
        <div className="flowmap-toolbar-copy">
          <div className="flowmap-toolbar-title">Path map</div>
          <p>Build branches as routes from one choice to the next envelope. If no route matches, the story simply continues in sequence.</p>
        </div>
        <div className="flowmap-add-route">
          <select style={S.input} value={newSourceChoiceId} onChange={(e) => setNewSourceChoiceId(e.target.value)}>
            {choiceOptions.map((choice) => (
              <option key={choice.id} value={choice.id}>{choice.label}</option>
            ))}
          </select>
          <button style={S.btn} onClick={() => addRule()}>Add Path</button>
        </div>
      </div>

      <div className="flowmap-legend">
        <span>Choice</span>
        <span>Condition</span>
        <span>Destination</span>
      </div>

      {/* ── Unmapped choices ── */}
      {unmappedChoices.length > 0 && (
        <div className="flowmap-unmapped-section">
          <div className="flowmap-unmapped-header">
            <strong>{unmappedChoices.length} choice{unmappedChoices.length !== 1 ? 's' : ''} on automatic routing</strong>
            <span>These follow the default story sequence. Add an explicit path to override where they go.</span>
          </div>
          {unmappedChoices.map(choice => {
            const autoId = autoRouteMap.get(choice.id);
            const autoEnv = autoId ? envelopeOptions.find(e => e.id === autoId) : null;
            return (
              <div key={choice.id} className="flowmap-unmapped-row">
                <div className="flowmap-unmapped-choice">
                  <div className="flowmap-source-title" style={{ fontSize: 13 }}>{choice.title}</div>
                  <div className="flowmap-source-meta">{choice.label}</div>
                </div>
                <div className="flowmap-unmapped-arrow">→</div>
                <div className="flowmap-unmapped-target">
                  {autoEnv
                    ? <span className="flowmap-auto-label">{autoEnv.label} <em>(auto)</em></span>
                    : <span className="flowmap-no-route">No next envelope — story ends</span>
                  }
                </div>
                <button style={S.btn} onClick={() => addRule(choice.id)}>+ Add path</button>
              </div>
            );
          })}
        </div>
      )}

      {mappedChoices.length === 0 && unmappedChoices.length === 0 && (
        <div className="flowmap-empty">
          <strong>No choices exist yet.</strong> Add choices in the Story tab first.
        </div>
      )}

      {/* ── Explicit routes section header ── */}
      {mappedChoices.length > 0 && (
        <div className="flowmap-section-label">Explicit paths ({mappedChoices.length} choice{mappedChoices.length !== 1 ? 's' : ''})</div>
      )}

      {mappedChoices.map(({ choice, rules: choiceRules }) => (
        <div key={choice.id} className="flowmap-group">
          <div className="flowmap-source-card">
            <div className="flowmap-source-overline">{choice.dayLabel}</div>
            <div className="flowmap-source-title">{choice.title}</div>
            <div className="flowmap-source-meta">{choice.envelopeLabel}</div>
            {choice.hint ? <p>{choice.hint}</p> : null}
            <button style={S.expandBtn} onClick={() => addRule(choice.id)}>Add another path</button>
          </div>

          <div className="flowmap-routes">
            {choiceRules.map((rule, index) => {
              const selectedChoice = choiceOptions.find(item => item.id === rule.sourceChoiceId);
              const fieldOptions = selectedChoice?.fields || [];
              const selectedField = fieldOptions.find(field => field.id === rule.sourceFieldId);
              const fieldType = normalizeInputType(selectedField?.type);
              const needsField = rule.operator !== 'always';
              const supportsContains = fieldType !== 'single_select';
              const needsValue = rule.operator === 'equals' || rule.operator === 'contains';
              const targetEnvelope = envelopeOptions.find(env => env.id === rule.targetEnvelopeId);

              return (
                <div key={rule.id} className="flowmap-route-card">
                  <div className="flowmap-route-header">
                    <div>
                      <div className="flowmap-route-kicker">Path {index + 1}</div>
                      <div className="flowmap-route-summary">{describeRule(rule, selectedField)}</div>
                    </div>
                    <button style={S.removeBtn} onClick={() => removeRule(rule.id)}>Remove</button>
                  </div>

                  <div className="flowmap-route-grid">
                    <div className="flowmap-column">
                      <label style={S.label}>From choice</label>
                      <select
                        style={S.input}
                        value={rule.sourceChoiceId || ''}
                        onChange={e => updateRule(rule.id, 'sourceChoiceId', e.target.value)}
                      >
                        {choiceOptions.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flowmap-column">
                      <label style={S.label}>When</label>
                      <select
                        style={S.input}
                        value={rule.operator || 'always'}
                        onChange={e => updateRule(rule.id, 'operator', e.target.value)}
                      >
                        <option value="always">Always after this choice</option>
                        <option value="is_filled">A response has any answer</option>
                        <option value="equals">A response equals</option>
                        {supportsContains && <option value="contains">A response contains</option>}
                      </select>

                      {needsField && (
                        <div style={{ marginTop: 10 }}>
                          <select
                            style={S.input}
                            value={rule.sourceFieldId || ''}
                            onChange={e => updateRule(rule.id, 'sourceFieldId', e.target.value)}
                          >
                            <option value="">Select response field</option>
                            {fieldOptions.map((field) => (
                              <option key={field.id} value={field.id}>
                                {field.label || field.id}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {needsValue && isSelectInputType(fieldType) ? (
                        <div style={{ marginTop: 10 }}>
                          <select
                            style={S.input}
                            value={rule.value || ''}
                            onChange={e => updateRule(rule.id, 'value', e.target.value)}
                          >
                            <option value="">Select answer</option>
                            {(selectedField.options || []).map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      {needsValue && !isSelectInputType(fieldType) && (
                        <div style={{ marginTop: 10 }}>
                          <input
                            style={S.input}
                            value={rule.value || ''}
                            onChange={e => updateRule(rule.id, 'value', e.target.value)}
                            placeholder={rule.operator === 'equals' ? 'Exact answer' : 'Text that should appear'}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flowmap-column">
                      <label style={S.label}>Go to</label>
                      <select
                        style={S.input}
                        value={rule.targetEnvelopeId || ''}
                        onChange={e => updateRule(rule.id, 'targetEnvelopeId', e.target.value)}
                      >
                        {envelopeOptions.map((env) => (
                          <option key={env.id} value={env.id}>{env.label} — {env.subtitle}</option>
                        ))}
                      </select>

                      {targetEnvelope && (
                        <div className="flowmap-destination-preview">
                          <strong>{targetEnvelope.label}</strong>
                          <span>{targetEnvelope.subtitle}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Prologue Editor ───────────────────────────────────────────────────────────
function PrologueEditor({ content, setContent, onSave, tweaks }) {
  const [lines, setLines] = useState(() => (content.prologue?.lines || []).join('\n'));
  const [signoff, setSignoff] = useState(() => content.prologue?.signoff || '');

  const handleSave = () => {
    const arr = lines.split('\n').map(l => l.trim()).filter(Boolean);
    const next = { ...content, prologue: { ...content.prologue, lines: arr, signoff } };
    setContent(next);
    onSave(next);
  };

  return (
    <div>
      <div style={{ ...S.sectionHead, marginTop: 0 }}>Prologue</div>
      <Field label="Lines (one per line)" value={lines} onChange={setLines} type="textarea" rows={8} tweaks={tweaks} />
      <Field label="Sign-off" value={signoff} onChange={setSignoff} tweaks={tweaks} />
      <div style={S.btnRow}>
        <button style={S.btn} onClick={handleSave}>Save Prologue</button>
      </div>
    </div>
  );
}

// ── Versions Tab ─────────────────────────────────────────────────────────────
function VersionsTab({ content, flowMap, setContent, setFlowMap, onContentSaved, showToast, onClearStoryEdits }) {
  const [snapshots, setSnapshots] = useState(() => loadSnapshots());
  const [newName, setNewName] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(null);

  const persistSnapshot = (snaps) => { setSnapshots(snaps); saveSnapshots(snaps); };

  const handleSave = () => {
    const name = newName.trim() || `Snapshot ${new Date().toLocaleString()}`;
    const snap = {
      id: `snap-${Date.now()}`,
      name,
      timestamp: new Date().toISOString(),
      content: deepClone(content),
      flowMap: deepClone(flowMap),
    };
    persistSnapshot([snap, ...snapshots].slice(0, MAX_SNAPSHOTS));
    setNewName('');
    showToast('Snapshot saved.');
  };

  const handleRestore = (snap) => {
    const nextContent = normalizeContentModel(snap.content);
    onClearStoryEdits?.();
    setContent(nextContent); saveContentEdits(nextContent);
    setFlowMap(snap.flowMap); saveFlowMap(snap.flowMap);
    if (onContentSaved) onContentSaved();
    setConfirmRestore(null);
    showToast('Restored.');
  };

  const handleDelete = (id) => {
    persistSnapshot(snapshots.filter(s => s.id !== id));
    showToast('Deleted.');
  };

  const exportSnap = (snap) => {
    const safeName = snap.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const date = new Date(snap.timestamp).toISOString().slice(0, 10);
    triggerDownload({ content: snap.content, flowMap: snap.flowMap }, `config_${safeName}_${date}.json`);
  };

  const exportCurrent = () => {
    const safeName = (newName.trim() || 'current').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload({ content, flowMap }, `config_${safeName}_${date}.json`);
    showToast('Exported.');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const c = normalizeContentModel(data.content || data);
        const fm = data.flowMap || { rules: [] };
        onClearStoryEdits?.();
        setContent(c); saveContentEdits(c);
        setFlowMap(fm); saveFlowMap(fm);
        if (onContentSaved) onContentSaved();
        showToast('Imported.');
      } catch { showToast('Import failed — invalid file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      <div style={{ ...S.sectionHead, marginTop: 0 }}>Save & Restore</div>

      <div style={S.card}>
        <div style={S.cardTitle}>Save Current State</div>
        <div style={S.field}>
          <label style={S.label}>Snapshot name (optional)</label>
          <input
            style={S.input}
            value={newName}
            placeholder="e.g. day4-makeout-draft"
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>
        <div style={S.btnRow}>
          <button style={S.btn} onClick={handleSave}>Save Snapshot</button>
          <button style={S.btn} onClick={exportCurrent}>Export to File</button>
          <label style={{ ...S.btn, cursor: 'pointer' }}>
            Import from File
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
      </div>

      <div style={S.sectionHead}>Saved Snapshots ({snapshots.length} / {MAX_SNAPSHOTS})</div>

      {snapshots.length === 0 && (
        <div style={{ ...S.card, color: 'rgba(237,227,209,0.4)', fontSize: 12, lineHeight: 1.6 }}>
          No snapshots yet. Save one above before making big edits.
        </div>
      )}

      {snapshots.map(snap => (
        <div key={snap.id} style={S.card}>
          {confirmRestore === snap.id ? (
            <>
              <div style={{ color: 'rgba(237,227,209,0.7)', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                Restore "{snap.name}"? This replaces your current story and flow map.
              </div>
              <div style={S.btnRow}>
                <button style={S.btn} onClick={() => handleRestore(snap)}>Yes, restore</button>
                <button style={S.btn} onClick={() => setConfirmRestore(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ color: 'rgba(237,227,209,0.85)', fontSize: 13, marginBottom: 3 }}>{snap.name}</div>
                  <div style={{ color: 'rgba(201,169,97,0.4)', fontSize: 10, letterSpacing: '0.12em' }}>
                    {new Date(snap.timestamp).toLocaleString()} · {snap.content?.days?.length || 0} days
                  </div>
                </div>
              </div>
              <div style={S.btnRow}>
                <button style={S.btn} onClick={() => setConfirmRestore(snap.id)}>Restore</button>
                <button style={S.btn} onClick={() => exportSnap(snap)}>Export</button>
                <button style={S.btnDanger} onClick={() => handleDelete(snap.id)}>Delete</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const AI_TONE_PRESETS = {
  romantic: {
    headingWords: ['Come closer', 'For you', 'Tonight', 'Only you'],
    bodyLead: 'Keep it intimate, warm, and inviting.',
    ruleLead: 'Stay soft, attentive, and fully present.',
  },
  elegant: {
    headingWords: ['At your leisure', 'A private invitation', 'In confidence', 'A quiet request'],
    bodyLead: 'Keep it polished, restrained, and luxurious.',
    ruleLead: 'Move slowly, neatly, and with intention.',
  },
  playful: {
    headingWords: ['A little dare', 'Try me', 'For my amusement', 'A sweet challenge'],
    bodyLead: 'Keep it teasing, light, and a little mischievous.',
    ruleLead: 'Make it fun, responsive, and easy to follow.',
  },
  possessive: {
    headingWords: ['For me', 'Mine tonight', 'As I asked', 'Exactly this'],
    bodyLead: 'Keep it focused, direct, and possessive without sounding cruel.',
    ruleLead: 'Follow it exactly, with no drifting.',
  },
  explicit: {
    headingWords: ['No pretending', 'You know what I want', 'Say it plainly', 'Give me the real thing'],
    bodyLead: 'Keep it physically charged and unmistakably erotic.',
    ruleLead: 'Make the instruction concrete and specific.',
  },
};

function normalizeLine(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function firstSentence(text = '') {
  const cleaned = String(text || '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  return parts[0] || cleaned;
}

function splitSentences(text = '') {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function ensurePeriod(text = '') {
  const cleaned = normalizeLine(text);
  if (!cleaned) return '';
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function shortenLine(text = '', max = 80) {
  const cleaned = normalizeLine(text);
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

function titleCase(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function softenText(text = '') {
  return String(text || '')
    .replace(/\bmust\b/gi, 'should')
    .replace(/\bobey\b/gi, 'follow')
    .replace(/\bimmediately\b/gi, 'carefully')
    .replace(/\bexactly\b/gi, 'closely');
}

function intensifyText(text = '') {
  return String(text || '')
    .replace(/\bsoft\b/gi, 'achingly soft')
    .replace(/\bslow\b/gi, 'slow and deliberate')
    .replace(/\bgentle\b/gi, 'hungrily gentle')
    .replace(/\bkiss\b/gi, 'kiss until it lingers');
}

function rewriteHint(text = '', intent, tone) {
  const base = firstSentence(text) || 'A path that shifts the mood.';
  if (intent === 'clearer') return ensurePeriod(base);
  if (intent === 'intense') return ensurePeriod(`${base.replace(/\.$/, '')}, but harder to ignore`);
  if (intent === 'softer') return ensurePeriod(`${base.replace(/\.$/, '')}, with more tenderness`);
  if (tone === 'elegant') return ensurePeriod(base.replace(/^A path/i, 'A quieter path'));
  if (tone === 'playful') return ensurePeriod(base.replace(/^A path/i, 'A teasing path'));
  return ensurePeriod(base);
}

function rewriteTitle(text = '', heading = '', intent, tone) {
  const base = normalizeLine(text) || normalizeLine(heading) || 'New Choice';
  if (intent === 'clearer') return shortenLine(base, 42);
  if (intent === 'intense') return shortenLine(base.replace(/\btonight\b/gi, '').trim() + ' Tonight', 42);
  if (intent === 'softer') return shortenLine(base.replace(/\bcommand\b/gi, 'invitation'), 42);
  if (tone === 'elegant') return shortenLine(titleCase(base), 42);
  return shortenLine(base, 42);
}

function rewriteHeading(text = '', tone, intensity, theme = '') {
  const base = normalizeLine(text);
  if (base) {
    if (tone === 'playful') return base.replace(/\.$/, '');
    if (tone === 'possessive' && !/\bfor me\b/i.test(base)) return `${base.replace(/\.$/, '')} for me`;
    if (tone === 'explicit' && intensity >= 7) return base.replace(/\.$/, '');
    return base;
  }
  const preset = AI_TONE_PRESETS[tone] || AI_TONE_PRESETS.romantic;
  const seed = preset.headingWords[Math.min(Math.max(intensity - 1, 0), preset.headingWords.length - 1)] || 'For you';
  return theme ? `${seed} · ${theme}` : seed;
}

function rewriteBodyText(text = '', { intent, tone, intensity, notesText, boundariesText, theme, introSeed }) {
  const sentences = splitSentences(text || introSeed);
  const fallback = (AI_TONE_PRESETS[tone] || AI_TONE_PRESETS.romantic).bodyLead;
  let next = sentences.length ? [...sentences] : [ensurePeriod(fallback)];

  if (intent === 'clearer') {
    next = next.slice(0, 2).map((sentence) => ensurePeriod(sentence));
    next.push('Keep the action specific and easy to follow.');
  } else if (intent === 'intense') {
    next = next.map((sentence) => ensurePeriod(intensifyText(sentence)));
    if (intensity >= 6) next.push('Let the tension build before anything resolves.');
    if (tone === 'explicit') next.push('Say exactly what is wanted instead of hinting around it.');
  } else if (intent === 'softer') {
    next = next.map((sentence) => ensurePeriod(softenText(sentence)));
    next.push('Make it feel invited, not forced.');
  } else {
    next = next.map((sentence) => ensurePeriod(sentence));
    next.unshift(ensurePeriod(fallback));
  }

  if (theme) next.push(`Keep the mood anchored in ${theme.toLowerCase()}.`);
  if (notesText) next.push(`Focus on ${notesText}.`);
  if (boundariesText) next.push(`Stay within these limits: ${boundariesText}.`);

  return next.filter(Boolean).join('\n\n');
}

function rewriteRuleText(text = '', { intent, tone, boundariesText, notesText }) {
  const base = normalizeLine(text) || (AI_TONE_PRESETS[tone] || AI_TONE_PRESETS.romantic).ruleLead;
  if (intent === 'clearer') {
    return ensurePeriod(boundariesText ? `Keep it clear and within ${boundariesText}` : firstSentence(base) || base);
  }
  if (intent === 'intense') {
    const line = tone === 'possessive' ? base : intensifyText(base);
    return ensurePeriod(boundariesText ? `${line} Do not cross ${boundariesText}` : line);
  }
  if (intent === 'softer') {
    const line = softenText(base);
    return ensurePeriod(boundariesText ? `${line} Stay within ${boundariesText}` : line);
  }
  return ensurePeriod([
    base,
    boundariesText ? `Keep it within ${boundariesText}` : '',
    notesText ? `Shape it around ${notesText}` : '',
  ].filter(Boolean).join('. '));
}

function buildConfiguratorDraft({
  day,
  env,
  title,
  hint,
  heading,
  body,
  rule,
  intent,
  tone,
  intensity,
  boundaries,
  notes,
}) {
  const preset = AI_TONE_PRESETS[tone] || AI_TONE_PRESETS.romantic;
  const theme = normalizeLine(day?.theme) || `Day ${day?.day || ''}`.trim();
  const introSeed = firstSentence(env?.intro || env?.choicesIntro || '');
  const boundariesText = normalizeLine(boundaries);
  const notesText = normalizeLine(notes);
  const nextHeading = rewriteHeading(heading, tone, intensity, intent === 'rewrite' ? '' : '');
  const nextTitle = rewriteTitle(title, nextHeading, intent, tone);
  const nextHint = rewriteHint(hint || introSeed, intent, tone);
  const nextBody = rewriteBodyText(body, { intent, tone, intensity, notesText, boundariesText, theme, introSeed: introSeed || preset.bodyLead });
  const nextRule = rewriteRuleText(rule, { intent, tone, boundariesText, notesText });

  return {
    title: nextTitle.trim(),
    hint: nextHint.trim(),
    heading: nextHeading.trim(),
    body: nextBody.trim(),
    rule: nextRule.trim(),
  };
}

function AIModal({ open, title, subtitle, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modalCard} onClick={(event) => event.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 6 }}>
              AI Draft Assistant
            </div>
            <div style={{ color: 'rgba(237,227,209,0.92)', fontSize: 18, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {title}
            </div>
            {subtitle ? (
              <div style={{ color: 'rgba(237,227,209,0.45)', fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
                {subtitle}
              </div>
            ) : null}
          </div>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AIChoiceConfigurator({
  day,
  env,
  choice,
  title,
  hint,
  heading,
  body,
  rule,
  onApplyField,
  onApplyAll,
}) {
  const [intent, setIntent] = useState('rewrite');
  const [tone, setTone] = useState('romantic');
  const [intensity, setIntensity] = useState(5);
  const [boundaries, setBoundaries] = useState('');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastModel, setLastModel] = useState('');
  const [open, setOpen] = useState(false);

  const changedFields = draft ? Object.entries({
    title,
    hint,
    heading,
    body,
    rule,
  }).filter(([field, value]) => normalizeLine(value) !== normalizeLine(draft[field])) : [];

  const finishApply = () => {
    setDraft(null);
    setOpen(false);
  };

  const applyField = (field, value) => {
    onApplyField(field, value);
    finishApply();
  };

  const applyAll = () => {
    onApplyAll(draft);
    finishApply();
  };

  const generate = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/card-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayTheme: day?.theme || '',
          envelopeLabel: env?.label || env?.timeLabel || '',
          envelopeIntro: env?.intro || env?.choicesIntro || '',
          choice: {
            title,
            hint,
            heading,
            body,
            rule,
          },
          draftGoal: intent,
          tone,
          intensity,
          boundaries,
          notes,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Draft generation failed.');
      }

      setDraft(data?.draft || null);
      setLastModel(data?.model || '');
    } catch (err) {
      setDraft(null);
      setLastModel('');
      setError(err.message || 'Draft generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={S.btnRow}>
        <button style={S.btn} onClick={() => setOpen(true)}>Open AI Writer</button>
      </div>

      <AIModal
        open={open}
        onClose={() => setOpen(false)}
        title="Card Writer"
        subtitle="Answer a few focused prompts, generate a draft from the current card, then apply the whole draft or only selected fields."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
          <div style={S.field}>
            <label style={S.label}>Draft goal</label>
            <select style={S.input} value={intent} onChange={e => setIntent(e.target.value)}>
              <option value="rewrite">Rewrite this card</option>
              <option value="clearer">Make it clearer</option>
              <option value="intense">Make it more intense</option>
              <option value="softer">Make it softer</option>
            </select>
          </div>
          <div style={S.field}>
            <label style={S.label}>Tone</label>
            <select style={S.input} value={tone} onChange={e => setTone(e.target.value)}>
              <option value="romantic">Romantic</option>
              <option value="elegant">Elegant</option>
              <option value="playful">Playful</option>
              <option value="possessive">Possessive</option>
              <option value="explicit">Explicit</option>
            </select>
          </div>
          <div style={S.field}>
            <label style={S.label}>Intensity · {intensity}/10</label>
            <input
              type="range"
              min="1"
              max="10"
              value={intensity}
              onChange={e => setIntensity(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'rgba(201,169,97,0.7)' }}
            />
          </div>
        </div>

        <Field label="Boundaries / keep out" value={boundaries} onChange={setBoundaries} tweaks={null} />
        <Field label="Direction for the draft" value={notes} onChange={setNotes} type="textarea" rows={3} tweaks={null} />

        <div style={S.btnRow}>
          <button style={S.btn} onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate with Claude'}
          </button>
        </div>

        {error ? (
          <div style={{ marginTop: 12, color: 'rgba(255,140,140,0.95)', fontSize: 12, lineHeight: 1.6 }}>
            {error}
          </div>
        ) : null}

        {draft && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(201,169,97,0.08)' }}>
            <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 10 }}>
              Draft Output
            </div>

            {lastModel ? (
              <div style={{ color: 'rgba(237,227,209,0.42)', fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>
                Generated by {lastModel}{draft.rationale ? ` · ${draft.rationale}` : ''}
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ ...S.previewCard, marginBottom: 0 }}>
                <div style={{ color: '#8a7440', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Choice label
                </div>
                <div style={{ color: '#2a0608', fontSize: 20, marginBottom: 6 }}>{draft.title || choice.title || 'Untitled'}</div>
                <div style={{ color: 'rgba(26,15,8,0.72)', fontSize: 13, lineHeight: 1.5 }}>{draft.hint || 'Hint'}</div>
              </div>

              <div style={S.previewCard}>
                <div style={{ color: '#2a0608', fontSize: 24, lineHeight: 1.15, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', marginBottom: 12 }}>
                  {draft.heading || 'Heading'}
                </div>
                <div style={{ color: '#1a0f08', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                  {draft.body || 'Body'}
                </div>
                {draft.rule ? (
                  <div style={{ padding: '10px 12px', background: 'rgba(74,13,21,0.06)', borderLeft: '2px solid #4a0d15', color: '#2a0608', fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}>
                    <div style={{ color: '#4a0d15', fontSize: 8, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 3, fontStyle: 'normal' }}>The Rule</div>
                    {draft.rule}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ color: 'rgba(201,169,97,0.48)', fontSize: 11, marginTop: 12 }}>
            {changedFields.length
              ? `Changed fields: ${changedFields.map(([field]) => field).join(', ')}`
              : 'No meaningful change from the current card yet.'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 12 }}>
            {['title', 'hint', 'heading', 'body', 'rule'].map((field) => (
              <div key={field} style={{ ...S.card, background: 'rgba(255,255,255,0.02)', marginBottom: 0 }}>
                <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {field}
                </div>
                <div style={{ color: 'rgba(237,227,209,0.38)', fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                  Current: {normalizeLine(({ title, hint, heading, body, rule })[field]) || '—'}
                </div>
                <div style={{ color: 'rgba(237,227,209,0.82)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  Draft: {normalizeLine(draft[field]) || '—'}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...S.btnRow, marginTop: 12 }}>
            <button style={S.btn} onClick={applyAll}>Apply All</button>
            <button style={S.btn} onClick={() => applyField('title', draft.title)}>Title</button>
            <button style={S.btn} onClick={() => applyField('hint', draft.hint)}>Hint</button>
            <button style={S.btn} onClick={() => applyField('heading', draft.heading)}>Heading</button>
            <button style={S.btn} onClick={() => applyField('body', draft.body)}>Body</button>
            <button style={S.btn} onClick={() => applyField('rule', draft.rule)}>Rule</button>
          </div>
          </div>
        )}
      </AIModal>
    </>
  );
}

// ── AI Envelope Panel ─────────────────────────────────────────────────────────
function AIEnvelopePanel({ day, env, onApply, onApplyAll }) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState('romantic');
  const [intensity, setIntensity] = useState(5);
  const [goal, setGoal] = useState('rewrite');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    setDraft(null);
    try {
      const res = await fetch('/api/envelope-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayTheme: day?.theme || '',
          envelopeLabel: env?.label || env?.timeLabel || '',
          intro: env?.intro || '',
          choicesHeading: env?.choicesHeading || '',
          choicesIntro: env?.choicesIntro || '',
          tone, intensity, notes, draftGoal: goal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Draft failed.');
      setDraft(data.draft || null);
    } catch (err) {
      setError(err.message || 'Draft failed.');
    } finally {
      setLoading(false);
    }
  };

  const FIELDS = [
    { key: 'intro', label: 'Intro', current: env?.intro },
    { key: 'choicesHeading', label: 'Choices Heading', current: env?.choicesHeading },
    { key: 'choicesIntro', label: 'Choices Intro', current: env?.choicesIntro },
  ];

  const finishApply = () => {
    setDraft(null);
    setOpen(false);
  };

  const applyField = (field, value) => {
    onApply(field, value);
    finishApply();
  };

  const applyAll = () => {
    const fields = {};
    FIELDS.forEach(({ key }) => {
      if (draft?.[key]) fields[key] = draft[key];
    });
    onApplyAll(fields);
    finishApply();
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        style={{ ...S.expandBtn, display: 'inline-flex', alignItems: 'center', gap: 5 }}
        onClick={() => setOpen(true)}
      >
        ✦ AI envelope writer
      </button>

      <AIModal
        open={open}
        onClose={() => setOpen(false)}
        title="Envelope Writer"
        subtitle="Open a focused prompt form for this envelope, generate a draft, and apply the intro or choice-screen text you want."
      >
        <div style={{ ...S.card, marginTop: 8, background: 'rgba(201,169,97,0.03)', borderColor: 'rgba(201,169,97,0.15)' }}>
          <div style={{ ...S.cardTitle, marginBottom: 12 }}>
            <span>AI Envelope Writer</span>
            <span style={{ color: 'rgba(237,227,209,0.3)', fontSize: 10 }}>calls /api/envelope-draft</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div style={S.field}>
              <label style={S.label}>Goal</label>
              <select style={S.input} value={goal} onChange={e => setGoal(e.target.value)}>
                <option value="rewrite">Rewrite</option>
                <option value="clearer">Make clearer</option>
                <option value="intense">More intense</option>
                <option value="softer">Softer</option>
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Tone</label>
              <select style={S.input} value={tone} onChange={e => setTone(e.target.value)}>
                <option value="romantic">Romantic</option>
                <option value="elegant">Elegant</option>
                <option value="playful">Playful</option>
                <option value="possessive">Possessive</option>
                <option value="explicit">Explicit</option>
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Intensity · {intensity}/10</label>
              <input
                type="range" min="1" max="10" value={intensity}
                onChange={e => setIntensity(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'rgba(201,169,97,0.7)' }}
              />
            </div>
          </div>

          <Field label="Notes / direction" value={notes} onChange={setNotes} type="textarea" rows={2} tweaks={null} />

          <div style={S.btnRow}>
            <button style={S.btn} onClick={generate} disabled={loading}>
              {loading ? 'Generating…' : 'Generate with Claude'}
            </button>
          </div>

          {error && (
            <div style={{ color: 'rgba(255,140,140,0.9)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{error}</div>
          )}

          {draft && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(201,169,97,0.08)' }}>
              <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 10 }}>Draft</div>
              {FIELDS.map(({ key, label, current }) => !draft[key] ? null : (
	                  <div key={key} style={{ ...S.card, marginBottom: 8, background: 'rgba(255,255,255,0.02)' }}>
	                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
	                    <span style={S.label}>{label}</span>
	                    <button style={S.btn} onClick={() => applyField(key, draft[key])}>Apply</button>
	                  </div>
                  {current && (
                    <div style={{ color: 'rgba(237,227,209,0.3)', fontSize: 11, lineHeight: 1.5, marginBottom: 5, fontStyle: 'italic' }}>
                      Current: {current.slice(0, 100)}{current.length > 100 ? '…' : ''}
                    </div>
                  )}
                  <div style={{ color: 'rgba(237,227,209,0.85)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {draft[key]}
                  </div>
                </div>
	              ))}
	              <div style={S.btnRow}>
	                <button style={S.btn} onClick={applyAll}>Apply All</button>
	                <button style={S.btnDanger} onClick={() => setDraft(null)}>Discard</button>
	              </div>
            </div>
          )}
        </div>
      </AIModal>
    </div>
  );
}

// ── Unified Story Editor ──────────────────────────────────────────────────────
function UnifiedStoryEditor({ content, setContent, onSave, tweaks, localEdits, setLocalEdits }) {
  const [expandedChoices, setExpandedChoices] = useState(new Set());
  const [expandedDayAdv, setExpandedDayAdv] = useState(new Set());
  const [expandedEnvAdv, setExpandedEnvAdv] = useState(new Set());
  const [dragOverEnv, setDragOverEnv] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [dragSrc, setDragSrc] = useState(null);

  const cKey = (di, envIndex, ci) => `${di}-${envIndex}-${ci}`;
  const get = (key, field, fallback) =>
    localEdits[key]?.[field] !== undefined ? localEdits[key][field] : (fallback ?? '');
  const setEdit = (key, field, value) =>
    setLocalEdits(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const clearDragState = () => {
    setDragOverEnv(null);
    setDragOverDay(null);
    setDragSrc(null);
  };

  const readDragSource = (event) => {
    const raw = event.dataTransfer.getData('text/plain');
    if (!/^\d+-\d+$/.test(raw || '')) return null;
    const [fromDi, fromEnvIndex] = raw.split('-').map(Number);
    if (Number.isNaN(fromDi) || Number.isNaN(fromEnvIndex)) return null;
    return { di: fromDi, envIndex: fromEnvIndex };
  };

  const saveOne = (key) => {
    const edits = localEdits[key];
    if (!edits) return;
    const next = applyStoryChoiceEdits(content, { [key]: edits });
    setContent(next); onSave(next);
    setLocalEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const pendingCount = Object.keys(localEdits).length;

  const flushPendingEdits = useCallback(() => {
    if (!pendingCount) return content;
    const next = applyStoryChoiceEdits(content, localEdits);
    setContent(next);
    setLocalEdits({});
    return next;
  }, [content, localEdits, pendingCount, setContent, setLocalEdits]);

  const saveAll = () => {
    if (!pendingCount) return;
    const next = flushPendingEdits();
    onSave(next);
  };

  const applyStructuralChange = (mutate) => {
    const next = deepClone(content);
    const beforeDayLookup = buildEditorDayLookup(content);
    const beforeEnvelopeLookup = buildEditorEnvelopeLookup(content);
    const beforeChoiceLookup = buildEditorChoiceLookup(content);

    mutate(next);

    const afterDayLookup = buildEditorDayLookup(next);
    const afterEnvelopeLookup = buildEditorEnvelopeLookup(next);
    const afterChoiceLookup = buildEditorChoiceLookup(next);

    setContent(next);
    onSave(next);
    setExpandedDayAdv((prev) => remapEditorSetKeys(prev, beforeDayLookup, afterDayLookup, Number));
    setExpandedEnvAdv((prev) => remapEditorSetKeys(prev, beforeEnvelopeLookup, afterEnvelopeLookup));
    setExpandedChoices((prev) => remapEditorSetKeys(prev, beforeChoiceLookup, afterChoiceLookup));
    setLocalEdits((prev) => remapEditorObjectKeys(prev, beforeChoiceLookup, afterChoiceLookup));
  };

  const updateDay = (di, field, value) => {
    const next = deepClone(content);
    next.days[di][field] = value;
    setContent(next); onSave(next);
  };

  const updateEnv = (di, envIndex, field, value) => {
    const next = deepClone(content);
    next.days[di].envelopes[envIndex][field] = value;
    setContent(next); onSave(next);
  };

  const updateEnvFields = (di, envIndex, fields) => {
    const next = deepClone(content);
    const envelope = next.days?.[di]?.envelopes?.[envIndex];
    if (!envelope) return;
    Object.entries(fields || {}).forEach(([field, value]) => {
      envelope[field] = value;
    });
    setContent(next);
    onSave(next);
  };

  const updateChoiceDirect = (di, envIndex, ci, path, value) => {
    const next = deepClone(content);
    const choice = next.days?.[di]?.envelopes?.[envIndex]?.choices?.[ci];
    if (!choice) return;
    setValueAtPath(choice, path, value);
    setContent(next);
    onSave(next);
  };

  const addResponseField = (di, envIndex, ci) => {
    const choice = content.days?.[di]?.envelopes?.[envIndex]?.choices?.[ci];
    const existing = Array.isArray(choice?.card?.inputs) ? choice.card.inputs : [];
    updateChoiceDirect(di, envIndex, ci, 'card.inputs', [
      ...existing,
      {
        id: `field-${Date.now()}`,
        label: 'New field',
        type: 'short_text',
        required: false,
        placeholder: '',
        helpText: '',
        options: ['Option 1', 'Option 2'],
      },
    ]);
  };

  const updateResponseField = (di, envIndex, ci, inputIndex, field, value) => {
    const choice = content.days?.[di]?.envelopes?.[envIndex]?.choices?.[ci];
    const existing = Array.isArray(choice?.card?.inputs) ? choice.card.inputs : [];
    const nextInputs = existing.map((input, idx) => {
      if (idx !== inputIndex) return input;
      return { ...input, [field]: value };
    });
    updateChoiceDirect(di, envIndex, ci, 'card.inputs', nextInputs);
  };

  const removeResponseField = (di, envIndex, ci, inputIndex) => {
    const choice = content.days?.[di]?.envelopes?.[envIndex]?.choices?.[ci];
    const existing = Array.isArray(choice?.card?.inputs) ? choice.card.inputs : [];
    updateChoiceDirect(di, envIndex, ci, 'card.inputs', existing.filter((_, idx) => idx !== inputIndex));
  };

  const removeChoice = (di, envIndex, ci) => {
    if (!confirm('Remove this choice?')) return;
    applyStructuralChange((next) => {
      next.days[di].envelopes[envIndex].choices.splice(ci, 1);
    });
  };

  const addChoice = (di, envIndex) => {
    const next = deepClone(content);
    next.days[di].envelopes[envIndex].choices.push({
      id: `d${di+1}e${envIndex + 1}-new${Date.now()}`,
      title: 'New Choice', hint: 'A new path.',
      card: { heading: 'Heading.', body: 'Body text.', rule: 'Rule.' },
    });
    setContent(next); onSave(next);
  };

  const addEnvelope = (di) => {
    const next = deepClone(content);
    const envs = next.days[di].envelopes || [];
    envs.push(createEmptyEnvelope(di + 1, envs.length));
    next.days[di].envelopes = envs;
    setContent(next); onSave(next);
  };

  const removeEnvelope = (di, envIndex) => {
    if (!confirm('Remove this envelope?')) return;
    applyStructuralChange((next) => {
      next.days[di].envelopes.splice(envIndex, 1);
    });
  };

  const removeDay = (di) => {
    if (!confirm('Remove this day?')) return;
    applyStructuralChange((next) => {
      next.days.splice(di, 1);
      next.days.forEach((day, index) => {
        day.day = index + 1;
      });
    });
  };

  const moveEnvelope = (fromDi, fromEnvIndex, toDi, toEnvIndex) => {
    const sourceEnv = content.days?.[fromDi]?.envelopes?.[fromEnvIndex];
    if (!sourceEnv) return;

    const targetDay = content.days?.[toDi];
    const targetCount = targetDay?.envelopes?.length || 0;
    const normalizedTargetIndex = Math.max(0, Math.min(
      typeof toEnvIndex === 'number' ? toEnvIndex : targetCount,
      targetCount
    ));

    if (fromDi === toDi) {
      const droppingBackOnSelf = fromEnvIndex === normalizedTargetIndex;
      const droppingLastEnvelopeAtEnd = normalizedTargetIndex === targetCount && fromEnvIndex === targetCount - 1;
      if (droppingBackOnSelf || droppingLastEnvelopeAtEnd) {
        clearDragState();
        return;
      }
    }

    applyStructuralChange((next) => {
      const sourceEnvelopes = next.days[fromDi].envelopes || [];
      const [moved] = sourceEnvelopes.splice(fromEnvIndex, 1);
      if (!moved) return;

      const targetEnvelopes = next.days[toDi].envelopes || [];
      let insertAt = normalizedTargetIndex;
      insertAt = Math.max(0, Math.min(insertAt, targetEnvelopes.length));

      targetEnvelopes.splice(insertAt, 0, moved);
      next.days[fromDi].envelopes = sourceEnvelopes;
      next.days[toDi].envelopes = targetEnvelopes;
    });

    clearDragState();
  };

  const rp = (t) => window.replacePlaceholders ? window.replacePlaceholders(t || '', tweaks) : (t || '');
  const toggleSet = (setter, val) => setter(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n; });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ ...S.sectionHead, marginTop: 0, marginBottom: 0 }}>Story</div>
        {pendingCount > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.btn} onClick={saveAll}>Save {pendingCount} change{pendingCount !== 1 ? 's' : ''}</button>
            <button style={S.btnDanger} onClick={() => setLocalEdits({})}>Discard</button>
          </div>
        )}
      </div>

      {content.days.map((day, di) => {
        const isDragOverDay = dragOverDay === di;

        return (
          <div key={day.id || di} style={{ marginBottom: 36 }}>

          {/* ── Day header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ color: 'rgba(201,169,97,0.85)', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 20, flexShrink: 0 }}>
              Day {toRoman(di + 1)}
            </span>
            <input
              style={{ ...S.input, flex: 1 }}
              value={day.theme}
              onChange={e => updateDay(di, 'theme', e.target.value)}
              placeholder="Theme"
            />
            <button style={S.expandBtn} onClick={() => toggleSet(setExpandedDayAdv, di)}>
              {expandedDayAdv.has(di) ? 'less' : 'settings'}
            </button>
            <button style={S.btnDanger} onClick={() => removeDay(di)} title="Remove day">✕</button>
          </div>

          {expandedDayAdv.has(di) && (
            <div style={{ ...S.card, marginBottom: 14 }}>
              <Field label="Day ID" value={day.id || ''} onChange={v => updateDay(di, 'id', v)} tweaks={tweaks} />
              <div style={S.field}>
                <label style={S.label}>Branch-only day</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(237,227,209,0.7)', fontSize: 12 }}>
                  <input type="checkbox" checked={!!day.branchOnly} onChange={e => updateDay(di, 'branchOnly', e.target.checked)} />
                  Hide from normal sequence unless branched to
                </label>
              </div>
            </div>
          )}

          {/* ── Envelopes ── */}
          {(day.envelopes || []).map((env, envIndex) => {
            const envKey = `${di}-${envIndex}`;

            const isDragOver = dragOverEnv?.di === di && dragOverEnv?.envIndex === envIndex;

            return (
              <div
                key={env.id || envIndex}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', `${di}-${envIndex}`);
                  e.dataTransfer.effectAllowed = 'move';
                  setDragSrc({ di, envIndex });
                  setDragOverDay(null);
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverEnv({ di, envIndex });
                  setDragOverDay(null);
                }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverEnv(null); }}
                onDragEnd={clearDragState}
                onDrop={e => {
                  e.preventDefault();
                  const source = readDragSource(e);
                  if (source) moveEnvelope(source.di, source.envIndex, di, envIndex);
                  else clearDragState();
                }}
                style={{
                  marginBottom: 18,
                  borderLeft: isDragOver ? '3px solid rgba(201,169,97,0.7)' : '3px solid transparent',
                  paddingLeft: isDragOver ? 10 : 0,
                  opacity: (dragSrc && dragSrc.di === di && dragSrc.envIndex === envIndex) ? 0.35 : 1,
                  transition: 'border-color 0.12s, padding-left 0.12s, opacity 0.12s',
                  background: isDragOver ? 'rgba(201,169,97,0.03)' : 'transparent',
                  borderRadius: 4,
                }}
              >
                {/* Slot label + intro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: 'rgba(201,169,97,0.4)', fontSize: 16, cursor: 'grab', flexShrink: 0, userSelect: 'none', lineHeight: 1 }} title="Drag to move envelopes between days">⠿</span>
                  <span style={{ color: 'rgba(201,169,97,0.45)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', flexShrink: 0 }}>
                    Envelope {envIndex + 1} · {env.timeLabel || getDefaultTimeLabel(envIndex)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(201,169,97,0.08)' }} />
                  <button style={S.expandBtn} onClick={() => toggleSet(setExpandedEnvAdv, envKey)}>
                    {expandedEnvAdv.has(envKey) ? 'less' : 'envelope settings'}
                  </button>
                  <button style={S.removeBtn} onClick={() => removeEnvelope(di, envIndex)}>✕</button>
                </div>

                {expandedEnvAdv.has(envKey) ? (
                  <div style={{ ...S.card, marginBottom: 10 }}>
                    <Field label="Label" value={env.label} onChange={v => updateEnv(di, envIndex, 'label', v)} tweaks={tweaks} />
                    <Field label="Time Label" value={env.timeLabel || ''} onChange={v => updateEnv(di, envIndex, 'timeLabel', v)} tweaks={tweaks} />
                    <Field label="Envelope ID" value={env.id || ''} onChange={v => updateEnv(di, envIndex, 'id', v)} tweaks={tweaks} />
                    <Field label="Seal Motif" value={env.sealMotif} onChange={v => updateEnv(di, envIndex, 'sealMotif', v)} tweaks={tweaks} />
                    <Field label="Intro Text" value={env.intro} onChange={v => updateEnv(di, envIndex, 'intro', v)} type="textarea" rows={3} tweaks={tweaks} />
                    <div style={S.field}>
                      <label style={S.label}>Branch-only envelope</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(237,227,209,0.7)', fontSize: 12 }}>
                        <input type="checkbox" checked={!!env.branchOnly} onChange={e => updateEnv(di, envIndex, 'branchOnly', e.target.checked)} />
                        Hide from normal sequence
                      </label>
                    </div>
                    <Field label="Choice Screen Heading" value={env.choicesHeading || ''} onChange={v => updateEnv(di, envIndex, 'choicesHeading', v)} tweaks={tweaks} />
                    <Field label="Choice Screen Intro" value={env.choicesIntro || ''} onChange={v => updateEnv(di, envIndex, 'choicesIntro', v)} type="textarea" rows={2} tweaks={tweaks} />
                  </div>
                ) : env.intro ? (
                  <div style={{ color: 'rgba(237,227,209,0.3)', fontSize: 12, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 10, paddingLeft: 12, borderLeft: '2px solid rgba(201,169,97,0.1)' }}>
                    {rp(env.intro).slice(0, 140)}{env.intro.length > 140 ? '…' : ''}
                  </div>
                ) : null}

                <AIEnvelopePanel
                  day={day}
                  env={env}
                  onApply={(field, value) => updateEnv(di, envIndex, field, value)}
                  onApplyAll={(fields) => updateEnvFields(di, envIndex, fields)}
                />

                {/* ── Choices ── */}
                {(env.choices || []).map((choice, ci) => {
                  const key = cKey(di, envIndex, ci);
                  const isOpen = expandedChoices.has(key);
                  const hasEdits = !!localEdits[key];
                  const choiceInputs = Array.isArray(choice.card?.inputs) ? choice.card.inputs : [];
                  const resolvedTitle = get(key, 'title', choice.title);
                  const resolvedHint = get(key, 'hint', choice.hint);
                  const resolvedHeading = get(key, 'heading', choice.card?.heading);
                  const resolvedBody = get(key, 'body', choice.card?.body);
                  const resolvedRule = get(key, 'rule', choice.card?.rule);

                  return (
                    <div key={choice.id || ci} style={{ ...S.card, marginBottom: 6, borderColor: hasEdits ? 'rgba(201,169,97,0.4)' : 'rgba(201,169,97,0.1)' }}>
                      {/* Summary row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }} onClick={() => toggleSet(setExpandedChoices, key)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'rgba(237,227,209,0.85)', fontSize: 13, marginBottom: 3 }}>
                            {resolvedTitle || 'Untitled'}
                            {hasEdits && <span style={{ color: 'rgba(201,169,97,0.6)', fontSize: 10, marginLeft: 8 }}>●</span>}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 5 }}>
                            <span style={{ padding: '2px 6px', border: '1px solid rgba(201,169,97,0.16)', borderRadius: 999, color: 'rgba(201,169,97,0.65)', fontSize: 10 }}>
                              {choice.id || 'no id'}
                            </span>
                            <span style={{ padding: '2px 6px', border: '1px solid rgba(201,169,97,0.16)', borderRadius: 999, color: 'rgba(237,227,209,0.55)', fontSize: 10 }}>
                              {choiceInputs.length} field{choiceInputs.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 11, fontStyle: 'italic', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {resolvedRule || <span style={{ color: 'rgba(237,227,209,0.2)' }}>no rule</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <button style={S.removeBtn} onClick={e => { e.stopPropagation(); removeChoice(di, envIndex, ci); }}>✕</button>
                          <span style={{ color: 'rgba(201,169,97,0.4)', fontSize: 18, lineHeight: 1 }}>{isOpen ? '−' : '+'}</span>
                        </div>
                      </div>

                      {/* Expanded editor + preview */}
                      {isOpen && (
                        <div style={{ marginTop: 14, borderTop: '1px solid rgba(201,169,97,0.08)', paddingTop: 14 }}>
                          <div style={S.splitPreview}>
                            <div>
                              <Field label="Title" value={resolvedTitle} onChange={v => setEdit(key, 'title', v)} tweaks={tweaks} />
                              <Field label="Hint" value={resolvedHint} onChange={v => setEdit(key, 'hint', v)} tweaks={tweaks} />
                              <Field label="Heading" value={resolvedHeading} onChange={v => setEdit(key, 'heading', v)} tweaks={tweaks} />
                              <Field label="Rule / Footer" value={resolvedRule} onChange={v => setEdit(key, 'rule', v)} type="textarea" rows={3} tweaks={tweaks} />
                              <Field label="Body" value={resolvedBody} onChange={v => setEdit(key, 'body', v)} type="textarea" rows={7} tweaks={tweaks} />
                              {hasEdits && (
                                <div style={S.btnRow}>
                                  <button style={S.btn} onClick={() => saveOne(key)}>Save</button>
                                  <button style={S.btnDanger} onClick={() => setLocalEdits(prev => { const n = { ...prev }; delete n[key]; return n; })}>Discard</button>
                                </div>
                              )}

                              <div style={{ ...S.card, marginTop: 14, background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ ...S.cardTitle, marginBottom: 10 }}>
                                  <span>Card setup</span>
                                </div>
                                <div style={{ color: 'rgba(237,227,209,0.45)', fontSize: 11, lineHeight: 1.6 }}>
                                  These controls are part of the card itself: choice ID and response fields.
                                </div>
                              </div>

                              <div style={{ marginTop: 12 }}>
                                <div style={{ ...S.card, marginBottom: 10, background: 'rgba(255,255,255,0.02)' }}>
                                  <div style={{ ...S.cardTitle, marginBottom: 10 }}>
                                    <span>Choice identity</span>
                                  </div>
                                  <Field
                                    label="Choice ID"
                                    value={choice.id || ''}
                                    onChange={v => updateChoiceDirect(di, envIndex, ci, 'id', v)}
                                    tweaks={tweaks}
                                  />
                                </div>

                                <div style={{ ...S.card, marginBottom: 10, background: 'rgba(255,255,255,0.02)' }}>
                                  <div style={{ ...S.cardTitle, marginBottom: 10 }}>
                                    <span>Response fields ({choiceInputs.length})</span>
                                    <button style={S.addBtn} onClick={() => addResponseField(di, envIndex, ci)}>+ Add Field</button>
                                  </div>

                                  {!choiceInputs.length && (
                                    <div style={{ color: 'rgba(237,227,209,0.35)', fontSize: 12 }}>
                                      No response fields yet. Add one for short text, long text, single select, or multiple select.
                                    </div>
                                  )}

                                  {choiceInputs.map((input, inputIndex) => {
                                    const normalizedType = normalizeInputType(input.type);
                                    return (
                                      <div key={input.id || inputIndex} style={{ ...S.card, marginBottom: 10, background: 'rgba(255,255,255,0.03)' }}>
                                        <div style={S.cardTitle}>
                                          <span>Field {inputIndex + 1} — {input.label || 'untitled'}</span>
                                          <button style={S.removeBtn} onClick={() => removeResponseField(di, envIndex, ci, inputIndex)}>✕</button>
                                        </div>
                                        <Field
                                          label="Field ID"
                                          value={input.id || ''}
                                          onChange={v => updateResponseField(di, envIndex, ci, inputIndex, 'id', v)}
                                          tweaks={tweaks}
                                        />
                                        <Field
                                          label="Label"
                                          value={input.label || ''}
                                          onChange={v => updateResponseField(di, envIndex, ci, inputIndex, 'label', v)}
                                          tweaks={tweaks}
                                        />
                                        <div style={S.field}>
                                          <label style={S.label}>Field Type</label>
                                          <select
                                            style={S.input}
                                            value={normalizedType}
                                            onChange={e => updateResponseField(di, envIndex, ci, inputIndex, 'type', e.target.value)}
                                          >
                                            {INPUT_TYPE_OPTIONS.map((option) => (
                                              <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <Field
                                          label="Placeholder"
                                          value={input.placeholder || ''}
                                          onChange={v => updateResponseField(di, envIndex, ci, inputIndex, 'placeholder', v)}
                                          tweaks={tweaks}
                                        />
                                        <Field
                                          label="Help Text"
                                          value={input.helpText || ''}
                                          onChange={v => updateResponseField(di, envIndex, ci, inputIndex, 'helpText', v)}
                                          tweaks={tweaks}
                                        />
                                        <div style={S.field}>
                                          <label style={S.label}>Required</label>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(237,227,209,0.7)', fontSize: 12 }}>
                                            <input
                                              type="checkbox"
                                              checked={!!input.required}
                                              onChange={e => updateResponseField(di, envIndex, ci, inputIndex, 'required', e.target.checked)}
                                            />
                                            Must be filled before continuing
                                          </label>
                                        </div>
                                        {isSelectInputType(normalizedType) && (
                                          <Field
                                            label={`${normalizedType === 'multi_select' ? 'Multiple select' : 'Single select'} options (one per line)`}
                                            value={Array.isArray(input.options) ? input.options.join('\n') : ''}
                                            onChange={v => updateResponseField(di, envIndex, ci, inputIndex, 'options', v.split('\n').map((s) => s.trim()).filter(Boolean))}
                                            type="textarea"
                                            rows={4}
                                            tweaks={tweaks}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <AIChoiceConfigurator
                                day={day}
                                env={env}
                                choice={choice}
                                title={resolvedTitle}
                                hint={resolvedHint}
                                heading={resolvedHeading}
                                body={resolvedBody}
                                rule={resolvedRule}
                                onApplyField={(field, value) => {
                                  const merged = { ...(localEdits[key] || {}), [field]: value };
                                  const next = applyStoryChoiceEdits(content, { [key]: merged });
                                  setContent(next); onSave(next);
                                  setLocalEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
                                }}
                                onApplyAll={(draft) => {
                                  const draftEdits = {};
                                  ['title', 'hint', 'heading', 'body', 'rule'].forEach((field) => {
                                    if (draft[field] !== undefined) draftEdits[field] = draft[field];
                                  });
                                  const merged = { ...(localEdits[key] || {}), ...draftEdits };
                                  const next = applyStoryChoiceEdits(content, { [key]: merged });
                                  setContent(next); onSave(next);
                                  setLocalEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
                                }}
                              />
                            </div>
                            <div style={S.previewPane}>
                              <div style={{ color: 'rgba(201,169,97,0.45)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 10 }}>Preview</div>
                              <div style={S.previewCard}>
                                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(74,13,21,0.08)' }}>
                                  <div style={{ color: '#8a7440', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Path choice</div>
                                  <div style={{ color: '#2a0608', fontSize: 18, lineHeight: 1.2, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', marginBottom: 4 }}>
                                    {rp(resolvedTitle) || 'Untitled choice'}
                                  </div>
                                  <div style={{ color: 'rgba(26,15,8,0.62)', fontSize: 13, lineHeight: 1.55 }}>
                                    {rp(resolvedHint) || 'Hint text appears here.'}
                                  </div>
                                </div>
                                <div style={{ color: '#2a0608', fontSize: 24, lineHeight: 1.15, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', marginBottom: 12 }}>
                                  {rp(resolvedHeading) || 'Heading'}
                                </div>
                                <div style={{ color: '#1a0f08', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                                  {rp(resolvedBody) || 'Body text'}
                                </div>
                                {resolvedRule && (
                                  <div style={{ padding: '10px 12px', background: 'rgba(74,13,21,0.06)', borderLeft: '2px solid #4a0d15', color: '#2a0608', fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}>
                                    <div style={{ color: '#4a0d15', fontSize: 8, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 3, fontStyle: 'normal' }}>The Rule</div>
                                    {rp(resolvedRule)}
                                  </div>
                                )}
                                {!!choiceInputs.length && (
                                  <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(74,13,21,0.04)', border: '1px solid rgba(120,95,60,0.18)' }}>
                                    <div style={{ color: '#4a0d15', fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 8 }}>Response Fields</div>
                                    {choiceInputs.map((input, inputIndex) => (
                                      <div key={input.id || inputIndex} style={{ marginBottom: inputIndex === choiceInputs.length - 1 ? 0 : 10 }}>
                                        <div style={{ color: '#8a7440', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                                          {rp(input.label || `Field ${inputIndex + 1}`)}{input.required ? ' *' : ''}
                                        </div>
                                        {input.helpText ? (
                                          <div style={{ color: 'rgba(26,15,8,0.7)', fontSize: 13, lineHeight: 1.5, marginBottom: 5 }}>
                                            {rp(input.helpText)}
                                          </div>
                                        ) : null}
                                        <div style={{ color: 'rgba(26,15,8,0.45)', fontSize: 12 }}>
                                          {getInputTypeLabel(input.type)}
                                          {isSelectInputType(input.type) && Array.isArray(input.options) && input.options.length
                                            ? `: ${input.options.join(', ')}`
                                            : ''}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button style={S.addBtn} onClick={() => addChoice(di, envIndex)}>+ Add Choice</button>
              </div>
            );
          })}

          <div
            onDragOver={(e) => {
              if (!dragSrc) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverEnv(null);
              setDragOverDay(di);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDay(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const source = readDragSource(e);
              if (source) moveEnvelope(source.di, source.envIndex, di, day.envelopes?.length || 0);
              else clearDragState();
            }}
            style={{
              marginTop: 10,
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 3,
              border: `1px dashed ${isDragOverDay ? 'rgba(201,169,97,0.5)' : 'rgba(201,169,97,0.18)'}`,
              background: isDragOverDay ? 'rgba(201,169,97,0.06)' : 'rgba(255,255,255,0.015)',
              color: isDragOverDay ? 'rgba(237,227,209,0.8)' : 'rgba(201,169,97,0.38)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              transition: 'all 0.12s',
            }}
          >
            {isDragOverDay
              ? `Drop here to move this envelope into Day ${toRoman(di + 1)}`
              : `Drag an envelope here to move it into Day ${toRoman(di + 1)}`}
          </div>

          <button style={S.addBtn} onClick={() => addEnvelope(di)}>+ Add Envelope</button>

          <div style={{ height: 1, background: 'rgba(201,169,97,0.06)', marginTop: 8 }} />
          </div>
        );
      })}

      <div style={S.btnRow}>
        <button style={S.btn} onClick={() => {
          const next = deepClone(content);
          next.days.push(createEmptyDay(next.days.length + 1));
          setContent(next); onSave(next);
        }}>+ Add Day</button>
        {pendingCount > 0 && <button style={S.btn} onClick={saveAll}>Save All Changes</button>}
      </div>
    </div>
  );
}

// ── Download helper ───────────────────────────────────────────────────────────
function triggerDownload(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function getStoryStats(content, flowMap) {
  const days = Array.isArray(content?.days) ? content.days : [];
  let envelopes = 0;
  let choices = 0;
  let responseFields = 0;
  let branchOnlyDays = 0;
  let branchOnlyEnvelopes = 0;

  days.forEach((day) => {
    if (day?.branchOnly) branchOnlyDays += 1;
    getDayEnvelopes(day).forEach((envelope) => {
      if (!envelope) return;
      envelopes += 1;
      if (envelope.branchOnly) branchOnlyEnvelopes += 1;
      (envelope.choices || []).forEach((choice) => {
        choices += 1;
        responseFields += Array.isArray(choice.card?.inputs) ? choice.card.inputs.length : 0;
      });
    });
  });

  return {
    days: days.length,
    envelopes,
    choices,
    responseFields,
    branchRules: Array.isArray(flowMap?.rules) ? flowMap.rules.length : 0,
    branchOnlyDays,
    branchOnlyEnvelopes,
  };
}

function SectionIntro({ eyebrow = 'Section', title, body }) {
  return (
    <div className="admin-section-intro">
      <div className="admin-section-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

function OverviewTab({ stats, setTab, dirty }) {
  const cards = [
    { label: 'Story Days', value: stats.days, note: `${stats.envelopes} envelopes across the full sequence` },
    { label: 'Choices', value: stats.choices, note: `${stats.responseFields} response fields currently defined` },
    { label: 'Branch Rules', value: stats.branchRules, note: `${stats.branchOnlyDays + stats.branchOnlyEnvelopes} hidden branch-only destinations` },
    { label: 'Save State', value: dirty ? 'Dirty' : 'Clean', note: dirty ? 'You have unsaved local edits' : 'Everything is currently saved' },
  ];

  const quickLinks = [
    { id: 'story', title: 'Edit story content', desc: 'Rewrite day themes, envelope copy, and path choices.' },
    { id: 'flowmap', title: 'Adjust branching', desc: 'Control where the story jumps after a choice or response.' },
    { id: 'controls', title: 'Reset and recover', desc: 'Use the safer controls for resets, imports, and cleanup.' },
  ];

  return (
    <div>
      <SectionIntro
        eyebrow="Overview"
        title="A clearer control room for the whole experience"
        body="Start here to see the current story shape, what still needs attention, and the quickest path to the part you want to change."
      />

      <div className="admin-overview-grid">
        {cards.map((card) => (
          <div key={card.label} className="admin-overview-card">
            <div className="admin-overview-label">{card.label}</div>
            <div className="admin-overview-value">{card.value}</div>
            <div className="admin-overview-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="admin-workspace-split">
        <div className="admin-workspace-panel">
          <div className="admin-workspace-panel-title">What You Can Do Fastest</div>
          <div className="admin-quick-links">
            {quickLinks.map((item) => (
              <button key={item.id} className="admin-quick-link" onClick={() => setTab(item.id)}>
                <span>{item.title}</span>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-workspace-panel">
          <div className="admin-workspace-panel-title">Story Health</div>
          <ul className="admin-checklist">
            <li>{stats.days ? `${stats.days} days are configured.` : 'No story days exist yet.'}</li>
            <li>{stats.choices ? `${stats.choices} path choices are available to players.` : 'No choices exist yet.'}</li>
            <li>{stats.branchRules ? `${stats.branchRules} branching rules can reroute progression.` : 'The story currently follows the default linear path.'}</li>
            <li>{dirty ? 'Local edits are waiting to be saved.' : 'The saved draft matches the open workspace.'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────
function AdminPanel({ tweaks, setTweak, onReset, onClose, onContentSaved }) {
  const [tab, setTab] = useState('overview');
  const [content, setContent] = useState(() => loadContentEdits());
  const [flowMap, setFlowMap] = useState(() => loadFlowMap());
  const [toast, setToast] = useState(null);
  const [navQuery, setNavQuery] = useState('');
  const [storyLocalEdits, setStoryLocalEdits] = useState({});

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const saveContent = (c) => {
    saveContentEdits(c);
    if (onContentSaved) onContentSaved();
    showToast('Saved.');
  };

  // ── Story mutations ─────────────────────────────────────────────────────────

  const updateDay = (dayIndex, field, value) => {
    const next = deepClone(content);
    next.days[dayIndex][field] = value;
    setContent(next);
  };

  const updateEnvelope = (dayIndex, slotKey, field, value) => {
    const next = deepClone(content);
    next.days[dayIndex][slotKey][field] = value;
    setContent(next);
  };

  const updateChoice = (dayIndex, slotKey, choiceIndex, path, value) => {
    const next = deepClone(content);
    const choice = next.days[dayIndex][slotKey].choices[choiceIndex];
    // Support dot-path like 'card.heading'
    const parts = path.split('.');
    let obj = choice;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    setContent(next);
  };

  const removeChoice = (dayIndex, slotKey, choiceIndex) => {
    if (!confirm('Remove this choice?')) return;
    const next = deepClone(content);
    next.days[dayIndex][slotKey].choices.splice(choiceIndex, 1);
    setContent(next);
  };

  const addChoice = (dayIndex, slotKey) => {
    const next = deepClone(content);
    const env = next.days[dayIndex][slotKey];
    const newId = `d${dayIndex+1}${slotKey[0]}-new${Date.now()}`;
    env.choices.push({
      id: newId,
      title: 'New Choice',
      hint: 'A new path.',
      card: {
        heading: 'Heading.',
        body: 'Body text.',
        rule: 'Rule.',
      },
    });
    setContent(next);
  };

  const addDay = () => {
    const next = deepClone(content);
    next.days.push(createEmptyDay(next.days.length + 1));
    setContent(next);
  };

  const removeDay = (dayIndex) => {
    if (!confirm('Remove this day and both envelopes?')) return;
    const next = deepClone(content);
    next.days.splice(dayIndex, 1);
    next.days.forEach((day, index) => {
      day.day = index + 1;
    });
    setContent(next);
  };

  const storyPendingCount = Object.keys(storyLocalEdits).length;

  const handleSaveAll = () => {
    const nextContent = storyPendingCount ? applyStoryChoiceEdits(content, storyLocalEdits) : content;
    if (nextContent !== content) setContent(nextContent);
    if (storyPendingCount) setStoryLocalEdits({});
    saveContentEdits(nextContent);
    saveFlowMap(flowMap);
    if (onContentSaved) onContentSaved();
    showToast('Everything saved.');
  };

  const handleResetContent = () => {
    if (!confirm('Reset all story content to defaults? Your edits will be lost.')) return;
    const base = deepClone(window.GAME_CONTENT);
    setContent(base);
    setStoryLocalEdits({});
    saveContentEdits(base);
    if (onContentSaved) onContentSaved();
    showToast('Content reset to defaults.');
  };

  const handleFullReset = () => {
    const savedFlow = JSON.stringify(flowMap);
    const savedContent = JSON.stringify(content);

    onReset();

    try {
      setStoryLocalEdits({});
      localStorage.setItem(FLOW_KEY, savedFlow);
      localStorage.setItem(CONTENT_KEY, savedContent);
      setFlowMap(loadFlowMap());
    } catch {}

    onClose();
  };

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  // ── Render tabs ─────────────────────────────────────────────────────────────

  const tabLabel = {
    overview: 'Overview',
    settings: 'Settings',
    prologue: 'Prologue',
    story: 'Story',
    flowmap: 'Flow Map',
    versions: 'Versions',
    controls: 'Controls',
  };

  const tabMeta = {
    overview: { group: 'Start here', description: 'See the health of the experience and jump straight to the right workspace.' },
    settings: { group: 'Configuration', description: 'Adjust names and experience intensity.' },
    prologue: { group: 'Content', description: 'Edit the opening sequence and sign-off without touching the main story path.' },
    story: { group: 'Content', description: 'Rewrite day themes, envelopes, and choices with live structure preserved.' },
    flowmap: { group: 'Logic', description: 'Map paths visually from one choice to the next envelope based on answers, selects, or defaults.' },
    versions: { group: 'Tools', description: 'Save snapshots, export builds, and recover a previous version safely.' },
    controls: { group: 'Tools', description: 'Use reset and recovery controls carefully when you need a clean state.' },
  };

  const navGroups = [
    { title: 'Start here', tabs: ['overview'] },
    { title: 'Configuration', tabs: ['settings'] },
    { title: 'Content', tabs: ['prologue', 'story'] },
    { title: 'Logic', tabs: ['flowmap'] },
    { title: 'Tools', tabs: ['versions', 'controls'] },
  ];

  const stats = useMemo(() => getStoryStats(content, flowMap), [content, flowMap]);
  const navFilter = navQuery.trim().toLowerCase();
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      tabs: group.tabs.filter((tabId) => {
        if (!navFilter) return true;
        const haystack = `${tabLabel[tabId]} ${tabMeta[tabId]?.description || ''} ${group.title}`.toLowerCase();
        return haystack.includes(navFilter);
      }),
    }))
    .filter((group) => group.tabs.length);

  const dirty = useMemo(() => {
    try {
      return storyPendingCount > 0
        || JSON.stringify(content) !== JSON.stringify(loadContentEdits())
        || JSON.stringify(flowMap) !== JSON.stringify(loadFlowMap());
    } catch {
      return storyPendingCount > 0;
    }
  }, [content, flowMap, storyPendingCount]);

  const currentMeta = tabMeta[tab] || { group: 'Workspace', description: '' };

  return (
    <div style={S.overlay} className="admin-workspace-overlay">
      <div className="admin-workspace-shell">
        <div style={S.sidebar} className="admin-workspace-sidebar">
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-kicker">Admin Panel</div>
            <h1>Story Workspace</h1>
            <p>Clearer editing, faster navigation, and safer controls for the whole experience.</p>
          </div>

          <div className="admin-sidebar-search">
            <input
              style={S.input}
              value={navQuery}
              placeholder="Search sections"
              onChange={(e) => setNavQuery(e.target.value)}
            />
          </div>

          <div className="admin-sidebar-stats">
            <div className="admin-sidebar-stat">
              <span>{stats.days}</span>
              <small>Days</small>
            </div>
            <div className="admin-sidebar-stat">
              <span>{stats.choices}</span>
              <small>Choices</small>
            </div>
            <div className="admin-sidebar-stat">
              <span>{stats.branchRules}</span>
              <small>Rules</small>
            </div>
          </div>

          {filteredGroups.map((group) => (
            <div key={group.title}>
              <div style={S.navSection}>{group.title}</div>
              {group.tabs.map((t) => (
                <button key={t} style={S.navBtn(tab === t)} onClick={() => setTab(t)}>
                  <span>{tabLabel[t]}</span>
                </button>
              ))}
            </div>
          ))}

          {!filteredGroups.length && (
            <div className="admin-empty-search">No sections match that search.</div>
          )}

          <div style={{ flex: 1 }} />

          <div className="admin-sidebar-footer">
            <div className={`admin-save-status ${dirty ? 'dirty' : 'clean'}`}>
              {dirty ? 'Unsaved local edits' : 'Everything saved'}
            </div>
            <button style={{ ...S.btn, width: '100%', textAlign: 'center' }} onClick={handleSaveAll}>
              {storyPendingCount > 0 ? `Save All Changes (${storyPendingCount} pending)` : 'Save All Changes'}
            </button>
          </div>
        </div>

        <div style={S.main} className="admin-workspace-main">
          <div style={S.header} className="admin-workspace-header">
            <div className="admin-header-copy">
              <div className="admin-header-kicker">{currentMeta.group}</div>
              <div style={S.headerTitle}>{tabLabel[tab] || tab}</div>
              <p>{currentMeta.description}</p>
            </div>
            <div className="admin-header-actions">
              <div className={`admin-header-badge ${dirty ? 'dirty' : 'clean'}`}>
                {dirty ? 'Unsaved changes' : 'Saved'}
              </div>
              <button style={S.closeBtn} onClick={onClose}>×</button>
            </div>
          </div>

          <div style={S.scroll} className="admin-workspace-scroll">
          {tab === 'overview' && (
            <OverviewTab stats={stats} setTab={setTab} dirty={dirty} />
          )}

          {tab === 'settings' && (
            <div>
              <SectionIntro
                eyebrow="Configuration"
                title="Personalization settings"
                body="These settings shape how the experience addresses each person and how intense it feels."
              />
              <div style={{ ...S.sectionHead, marginTop: 0 }}>Names</div>
              <Field label="Her name (how she's addressed)" value={tweaks.herName}
                onChange={v => setTweak('herName', v)} />
              <Field label="His name / how she addresses him" value={tweaks.hisName}
                onChange={v => setTweak('hisName', v)} />

              <div style={S.sectionHead}>Experience</div>
              <div style={S.field}>
                <label style={S.label}>Intensity · {tweaks.intensity}/10</label>
                <input type="range" min="1" max="10" value={tweaks.intensity}
                  onChange={e => setTweak('intensity', parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'rgba(201,169,97,0.7)' }}
                />
              </div>

            </div>
          )}

          {/* ── Prologue ── */}
          {tab === 'prologue' && (
            <div>
              <SectionIntro
                eyebrow="Content"
                title="Opening sequence"
                body="Use this section for the first impression: the lines that set the tone before the main branching story begins."
              />
              <PrologueEditor content={content} setContent={setContent} onSave={saveContent} tweaks={tweaks} />
            </div>
          )}

          {/* ── Story ── */}
          {tab === 'story' && (
            <div>
              <SectionIntro
                eyebrow="Content"
                title="Story structure and path writing"
                body="This is the main editor for day themes, envelope setup, and every path choice. Expand only the parts you need so the story stays easier to scan."
              />
              <UnifiedStoryEditor
                content={content}
                setContent={setContent}
                onSave={saveContent}
                tweaks={tweaks}
                localEdits={storyLocalEdits}
                setLocalEdits={setStoryLocalEdits}
              />
              <div style={{ ...S.btnRow, marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(201,169,97,0.08)' }}>
                <button style={S.btnDanger} onClick={handleResetContent}>Reset to Defaults</button>
              </div>
            </div>
          )}

          {/* ── Flow Map ── */}
          {tab === 'flowmap' && (
            <div>
              <SectionIntro
                eyebrow="Logic"
                title="Branching map"
                body="Create visual routes from each choice to the next destination. Use defaults for simple jumps or make answer-based branches using text fields and selects."
              />
              <div style={{ ...S.sectionHead, marginTop: 0 }}>Choice Flow Map</div>
              <FlowMap content={content} flowMap={flowMap} setFlowMap={setFlowMap} />
            </div>
          )}

          {/* ── Versions ── */}
          {tab === 'versions' && (
            <div>
              <SectionIntro
                eyebrow="Tools"
                title="Snapshots, export, and restore"
                body="Save a checkpoint before large edits, export a build for backup, or restore a previous configuration if you need to roll back."
              />
              <VersionsTab
                content={content}
                flowMap={flowMap}
                setContent={setContent}
                setFlowMap={setFlowMap}
                onContentSaved={onContentSaved}
                showToast={showToast}
                onClearStoryEdits={() => setStoryLocalEdits({})}
              />
            </div>
          )}

          {/* ── Controls ── */}
          {tab === 'controls' && (
            <div>
              <SectionIntro
                eyebrow="Tools"
                title="Recovery and reset controls"
                body="Use these actions carefully. They are grouped here so the destructive options stay separate from the normal writing workflow."
              />
              <div style={{ ...S.sectionHead, marginTop: 0 }}>Game Controls</div>
              <p style={{ color: 'rgba(237,227,209,0.4)', fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
                Manage game state, progress, and resets.
              </p>

              <div style={S.card}>
                <div style={S.cardTitle}>Progress</div>
                <div style={S.btnRow}>
                  <button style={S.btn} onClick={handleFullReset}>
                    Full Reset
                  </button>
                </div>
              </div>

              <div style={S.card}>
                <div style={S.cardTitle}>Content Overrides</div>
                <div style={S.btnRow}>
                  <button style={S.btnDanger} onClick={handleResetContent}>
                    Reset Story to Defaults
                  </button>
                  <button style={S.btnDanger} onClick={() => {
                    if (!confirm('Clear all branch rules?')) return;
                    const empty = { rules: [] };
                    saveFlowMap(empty);
                    setFlowMap(empty);
                    showToast('Branch rules cleared.');
                  }}>
                    Clear Branch Rules
                  </button>
                </div>
              </div>

              <div style={S.card}>
                <div style={S.cardTitle}>Export / Import</div>
                <div style={{ color: 'rgba(237,227,209,0.4)', fontSize: 12, lineHeight: 1.6 }}>
                  Use the <strong style={{ color: 'rgba(201,169,97,0.6)' }}>Versions</strong> tab to save snapshots, export to file, and import from file.
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
