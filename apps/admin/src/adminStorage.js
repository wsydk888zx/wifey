import {
  STORAGE_KEYS,
  TWEAK_DEFAULTS,
  normalizeContentModel,
  validateStoryExport,
} from '@wifey/story-core';

export const MAX_ADMIN_SNAPSHOTS = 10;

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readJsonValue(key) {
  if (!hasStorage()) return { found: false, value: null };

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { found: false, value: null };
    return { found: true, value: JSON.parse(raw) };
  } catch {
    return { found: false, value: null };
  }
}

function writeJsonValue(key, value) {
  if (!hasStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeValue(key) {
  if (!hasStorage()) return;
  window.localStorage.removeItem(key);
}

function normalizeFlowMap(flowMap) {
  if (flowMap && typeof flowMap === 'object') return deepClone(flowMap);
  return { rules: [] };
}

function normalizeIntensity(value) {
  const intensity = Number(value);
  if (!Number.isFinite(intensity)) return TWEAK_DEFAULTS.intensity;
  return Math.min(10, Math.max(1, Math.round(intensity)));
}

export function normalizeAdminTweaks(tweaks = {}) {
  const source = tweaks && typeof tweaks === 'object' ? tweaks : {};

  return {
    herName: Object.hasOwn(source, 'herName')
      ? String(source.herName ?? '')
      : TWEAK_DEFAULTS.herName,
    hisName: Object.hasOwn(source, 'hisName')
      ? String(source.hisName ?? '')
      : TWEAK_DEFAULTS.hisName,
    intensity: normalizeIntensity(source.intensity),
  };
}

export function createDefaultAdminTweaks() {
  return normalizeAdminTweaks(TWEAK_DEFAULTS);
}

function normalizeSnapshots(snapshots) {
  if (!Array.isArray(snapshots)) return [];

  return snapshots
    .filter((snapshot) => snapshot && typeof snapshot === 'object' && snapshot.content)
    .map((snapshot, index) => ({
      id: snapshot.id || `snapshot-${index + 1}`,
      name: snapshot.name || `Snapshot ${index + 1}`,
      timestamp: snapshot.timestamp || new Date().toISOString(),
      content: normalizeContentModel(snapshot.content),
      flowMap: normalizeFlowMap(snapshot.flowMap),
    }))
    .slice(0, MAX_ADMIN_SNAPSHOTS);
}

export function createDefaultAdminDraft(defaultContent, defaultFlowMap) {
  return {
    content: normalizeContentModel(defaultContent),
    flowMap: normalizeFlowMap(defaultFlowMap),
    snapshots: [],
    tweaks: createDefaultAdminTweaks(),
    sourceLabel: 'Package defaults',
  };
}

export function loadAdminDraft(defaultContent, defaultFlowMap) {
  const fallback = createDefaultAdminDraft(defaultContent, defaultFlowMap);
  const storedContent = readJsonValue(STORAGE_KEYS.content);
  const storedFlowMap = readJsonValue(STORAGE_KEYS.flow);
  const storedSnapshots = readJsonValue(STORAGE_KEYS.snapshots);
  const storedTweaks = readJsonValue(STORAGE_KEYS.tweaks);

  return {
    content: storedContent.found ? normalizeContentModel(storedContent.value) : fallback.content,
    flowMap: storedFlowMap.found ? normalizeFlowMap(storedFlowMap.value) : fallback.flowMap,
    snapshots: storedSnapshots.found ? normalizeSnapshots(storedSnapshots.value) : [],
    tweaks: storedTweaks.found ? normalizeAdminTweaks(storedTweaks.value) : fallback.tweaks,
    sourceLabel:
      storedContent.found || storedFlowMap.found || storedSnapshots.found || storedTweaks.found
        ? 'Browser draft'
        : fallback.sourceLabel,
  };
}

export function saveAdminDraft(draft) {
  writeJsonValue(STORAGE_KEYS.content, normalizeContentModel(draft.content));
  writeJsonValue(STORAGE_KEYS.flow, normalizeFlowMap(draft.flowMap));
  writeJsonValue(STORAGE_KEYS.snapshots, normalizeSnapshots(draft.snapshots));
  writeJsonValue(STORAGE_KEYS.tweaks, normalizeAdminTweaks(draft.tweaks));
}

export function clearAdminDraftStorage() {
  removeValue(STORAGE_KEYS.content);
  removeValue(STORAGE_KEYS.flow);
  removeValue(STORAGE_KEYS.snapshots);
  removeValue(STORAGE_KEYS.tweaks);
}

export function createDraftFingerprint(draft) {
  return JSON.stringify({
    content: normalizeContentModel(draft.content),
    flowMap: normalizeFlowMap(draft.flowMap),
    snapshots: normalizeSnapshots(draft.snapshots),
    tweaks: normalizeAdminTweaks(draft.tweaks),
  });
}

export function createAdminExport(draft) {
  return {
    content: normalizeContentModel(draft.content),
    flowMap: normalizeFlowMap(draft.flowMap),
    tweaks: normalizeAdminTweaks(draft.tweaks),
  };
}

export function createAdminPreviewPayload(draft) {
  return {
    ...createAdminExport(draft),
    tweaks: normalizeAdminTweaks(draft.tweaks),
    sourceLabel: draft.sourceLabel || 'Browser draft',
  };
}

export function parseAdminImport(source, fallbackFlowMap) {
  const contentSource =
    source?.content && typeof source.content === 'object' ? source.content : source;
  const flowMap = normalizeFlowMap(
    source?.flowMap || contentSource?.defaultFlowMap || fallbackFlowMap,
  );
  const content = normalizeContentModel(contentSource);
  const validation = validateStoryExport({ content, flowMap });

  return {
    content,
    flowMap,
    tweaks: normalizeAdminTweaks(source?.tweaks || contentSource?.defaultTweaks || contentSource?.tweaks),
    validation,
  };
}

export function createAdminSnapshot({ content, flowMap }, name) {
  const timestamp = new Date().toISOString();

  return {
    id: `snapshot-${Date.now()}`,
    name: name?.trim() || `Snapshot ${new Date(timestamp).toLocaleString()}`,
    timestamp,
    content: normalizeContentModel(content),
    flowMap: normalizeFlowMap(flowMap),
  };
}

export function downloadAdminExport(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function subscribeToPlayerState(callback) {
  if (!hasStorage()) return () => {};

  const pollInterval = setInterval(() => {
    const { value: state } = readJsonValue(STORAGE_KEYS.state);
    if (state) {
      callback(state);
    }
  }, 1000);

  const handleStorageChange = (event) => {
    if (event.key === STORAGE_KEYS.state && event.newValue) {
      try {
        callback(JSON.parse(event.newValue));
      } catch {
        // Ignore parse errors
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);

  return () => {
    clearInterval(pollInterval);
    window.removeEventListener('storage', handleStorageChange);
  };
}
