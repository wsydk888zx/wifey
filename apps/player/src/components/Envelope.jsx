import React from 'react';

import { replacePlaceholders } from '@wifey/story-core';

function Envelope({ envelope, addressee, tweaks, state, onOpen }) {
  const rp = (text) => replacePlaceholders(text, tweaks);

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
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && state === 'resting') {
            event.preventDefault();
            onOpen();
          }
        }}
        aria-label={state === 'resting' ? 'Open envelope' : 'Envelope'}
      >
        <div className="body">
          <div className="monogram">{addressee ? addressee[0] : 'M'}</div>
          <div className="address">{addressee || 'Mine'}</div>
          <div className="sub">{rp(envelope.label)}</div>
        </div>

        <div className="flap-left" />
        <div className="flap-right" />
        <div className="flap-bottom" />

        <div className="letter">
          <div className="preview">
            <div className="preview-date">{rp(envelope.label)}</div>
            <div className="to">For {addressee || 'you'},</div>
            <em>Break the seal when you are alone.</em>
          </div>
        </div>

        <div className="flap-top" />

        <div className="wax-seal">
          <div className="half left" />
          <div className="half right" />
          <div className="motif">
            {envelope.sealMotif || (addressee ? addressee[0].toUpperCase() : 'M')}
          </div>
        </div>
      </div>

      {state === 'resting' ? (
        <div className="envelope-hint">
          Break the seal when you are ready <span className="key">Enter</span>
        </div>
      ) : null}
    </div>
  );
}

export default Envelope;
