import { storyContent } from './storyData.js';

const fallbackContent = {
  prologue: {
    lines: [
      'Five days. Ten envelopes. A story written for you alone.',
      'The bundled story content is still loading.',
    ],
    signoff: '- Story content fallback',
  },
  days: [],
  defaultFlowMap: {
    rules: [],
  },
};

export const defaultContent = storyContent || globalThis.WIFEY_STORY_CONTENT || fallbackContent;
export const defaultFlowMap =
  defaultContent.epilogue ? { rules: [] } : (
    globalThis.WIFEY_DEFAULT_FLOW_MAP ||
    defaultContent.defaultFlowMap ||
    fallbackContent.defaultFlowMap
  );
