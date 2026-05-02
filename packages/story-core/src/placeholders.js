import { STORY_SETTINGS_DEFAULTS } from './constants.js';

export const PLACEHOLDER_TOKEN_OPTIONS = [
  { token: '{{herName}}', label: 'her name' },
  { token: '{{hisName}}', label: 'his name' },
  { token: '{{HerName}}', label: 'Her name' },
  { token: '{{HisName}}', label: 'His name' },
  { token: '{her}', label: 'legacy her' },
  { token: '{his}', label: 'legacy his' },
  { token: '{Her}', label: 'legacy Her' },
  { token: '{His}', label: 'legacy His' },
];

const PLACEHOLDER_TOKEN_PATTERN =
  /\{\{(?:herName|hisName|HerName|HisName)\}\}|\{(?:her|his|Her|His)\}/;

export function hasPlaceholderTokens(text) {
  return typeof text === 'string' && PLACEHOLDER_TOKEN_PATTERN.test(text);
}

export function normalizeStorySettings(storySettings = {}) {
  const source = storySettings && typeof storySettings === 'object' ? storySettings : {};

  return {
    herName: Object.hasOwn(source, 'herName')
      ? String(source.herName ?? '')
      : STORY_SETTINGS_DEFAULTS.herName,
    hisName: Object.hasOwn(source, 'hisName')
      ? String(source.hisName ?? '')
      : STORY_SETTINGS_DEFAULTS.hisName,
  };
}

export function replacePlaceholders(text, storySettings = {}) {
  if (typeof text !== 'string') return text;

  const merged = normalizeStorySettings(storySettings);
  const her = String(merged.herName || STORY_SETTINGS_DEFAULTS.herName).toLowerCase();
  const his = String(merged.hisName || STORY_SETTINGS_DEFAULTS.hisName).toLowerCase();
  const Her = her.charAt(0).toUpperCase() + her.slice(1);
  const His = his.charAt(0).toUpperCase() + his.slice(1);

  return text
    .replaceAll('{{HerName}}', Her)
    .replaceAll('{{HisName}}', His)
    .replaceAll('{{herName}}', her)
    .replaceAll('{{hisName}}', his)
    .replaceAll('{Her}', Her)
    .replaceAll('{His}', His)
    .replaceAll('{her}', her)
    .replaceAll('{his}', his);
}

export function previewPlaceholders(text, storySettings = {}) {
  if (!hasPlaceholderTokens(text)) return null;
  return replacePlaceholders(text, storySettings);
}
