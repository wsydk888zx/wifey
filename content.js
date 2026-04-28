// Legacy root adapter for the package-owned bundled story content.
// Keep this file for the CDN/Babel root preview until the workspace apps fully replace it.

if (!globalThis.WIFEY_STORY_CONTENT) {
  throw new Error("Story content data failed to load before content.js.");
}

window.GAME_CONTENT = globalThis.WIFEY_STORY_CONTENT;
window.DEFAULT_FLOW_MAP = globalThis.WIFEY_DEFAULT_FLOW_MAP || window.GAME_CONTENT.defaultFlowMap;
