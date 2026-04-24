import '../../../content.js';

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

export const defaultContent = globalThis.GAME_CONTENT || fallbackContent;
