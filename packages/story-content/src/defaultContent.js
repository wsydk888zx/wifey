// Default fallback content for when Supabase is unavailable
// The authoritative story content lives in Supabase, not here

export const defaultContent = {
  prologue: {
    lines: [
      'Loading your story...',
      'If you see this, the server is unreachable.',
    ],
    signoff: '— waiting for connection',
  },
  days: [],
};

export const defaultFlowMap = {
  rules: [],
};
