// Envelope.jsx — 3D envelope with wax seal that cracks and flap that folds open.

function Envelope({ envelope, addressee, tweaks, state, onOpen }) {
  // state: 'resting' | 'opening' | 'opened'
  const rp = (text) => window.replacePlaceholders ? window.replacePlaceholders(text, tweaks) : text;
  const handleClick = () => {
    if (state === 'resting') onOpen();
  };

  return (
    <div className="envelope-stage">
      <div className="envelope-note">sealed for {addressee || 'you'} alone</div>
      <div
        className={`envelope ${state}`}
        onClick={handleClick}
        role="button"
        tabIndex={state === 'resting' ? 0 : -1}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && state === 'resting') {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={state === 'resting' ? 'Open envelope' : 'Envelope'}
      >
        {/* Back body of envelope */}
        <div className="body">
          <div className="monogram">{addressee ? addressee[0] : 'M'}</div>
          <div className="address">{addressee || 'Mine'}</div>
          <div className="sub">{rp(envelope.label)}</div>
        </div>

        {/* Side shading flaps */}
        <div className="flap-left" />
        <div className="flap-right" />
        <div className="flap-bottom" />

        {/* Letter that rises when flap opens */}
        <div className="letter">
          <div className="preview">
            <div className="preview-date">{rp(envelope.label)}</div>
            <div className="to">For {addressee || 'you'},</div>
            <em>Break the seal when you are alone.</em>
          </div>
        </div>

        {/* Top flap — this is what opens */}
        <div className="flap-top" />

        {/* Wax seal centered on flap tip */}
        <div className="wax-seal">
          <div className="half left" />
          <div className="half right" />
          <div className="motif">{envelope.sealMotif || (addressee ? addressee[0].toUpperCase() : 'M')}</div>
        </div>
      </div>

      {state === 'resting' && (
        <div className="envelope-hint">
          Break the seal when you are ready <span className="key">⏎</span>
        </div>
      )}
    </div>
  );
}

window.Envelope = Envelope;
