// ── ENVELOPE ANIMATION ────────────────────────────────────────────────────────
import { S, save, her, His } from '../state.js';
import { haptic } from '../cursor.js';

export function showEnvelope(idx, onOpen, opts) {
  opts = opts || {};
  const area = document.getElementById('chapter-area');
  const isWaiting    = opts.waiting;
  const isHisChoices = opts.hisChoices;

  const addressee = isHisChoices ? His() : her();
  const sealMotif = isHisChoices ? '◈' : '✦';
  const label     = isWaiting    ? 'awaiting his decision…'
                  : isHisChoices ? 'open his choices'
                  : 'press to unseal';

  const stage = document.createElement('div');
  stage.id = 'env-wrap-' + idx;
  area.appendChild(stage);

  if (isWaiting) {
    // Render a static waiting envelope via React
    ReactDOM.createRoot(stage).render(
      React.createElement(Envelope, {
        envelope: { label, sealMotif },
        addressee,
        state: 'waiting',
        onOpen: () => {}
      })
    );
    return;
  }

  // Wrapper component that drives resting → opening → opened state
  function EnvelopeWrapper() {
    const [state, setState] = React.useState('resting');

    function handleOpen() {
      haptic([30, 40, 20]);
      setState('opening');
      setTimeout(() => {
        setState('opened');
        setTimeout(() => {
          stage.remove();
          if (!S.chapters[idx]) S.chapters[idx] = { unlockedAt: Date.now(), completedAt: null, choices: {} };
          S.chapters[idx].envelopeOpened = true;
          save();
          onOpen();
        }, 600);
      }, 700);
    }

    return React.createElement(Envelope, {
      envelope: { label, sealMotif },
      addressee,
      state,
      onOpen: handleOpen
    });
  }

  ReactDOM.createRoot(stage).render(React.createElement(EnvelopeWrapper));
}
