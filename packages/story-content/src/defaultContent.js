// Bundled fallback — used when Supabase is unreachable or migration not yet applied.
// Supabase is the authoritative source; this is read-only offline insurance.
import { storyContent } from './storyData.js';

export const defaultContent = storyContent || {
  prologue: { lines: ['Loading your story…'], signoff: '' },
  days: [],
};

export const defaultFlowMap = defaultContent.defaultFlowMap || { rules: [] };
