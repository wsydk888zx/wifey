import { TWEAK_DEFAULTS } from './constants.js';

export function replacePlaceholders(text, tweaks = {}) {
  if (typeof text !== 'string') return text;

  const merged = { ...TWEAK_DEFAULTS, ...tweaks };
  const her = String(merged.herName || TWEAK_DEFAULTS.herName).toLowerCase();
  const his = String(merged.hisName || TWEAK_DEFAULTS.hisName).toLowerCase();
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
