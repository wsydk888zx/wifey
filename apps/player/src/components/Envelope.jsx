import React from 'react';

import { replacePlaceholders } from '@wifey/story-core';

function Envelope({ envelope, addressee, storySettings, state, onOpen }) {
  const rp = (text) => replacePlaceholders(text, storySettings);

  const handleClick = () => {
    if (state !== 'resting') return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }
    onOpen();
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
        <div className="envelope-shadow" />

        <div className="body">
          <div className="paper-grain" />
          <div className="paper-sheen" />
          <div className="sub">{rp(envelope.label)}</div>
        </div>

        <div className="flap-left" />
        <div className="flap-right" />
        <div className="flap-bottom" />
        <div className="inner-lining" />

        <div className="address-block">
          <div className="address">{addressee || 'Mine'}</div>
          <div className="address-rule" />
        </div>

        <div className="letter">
          <div className="letter-warmth" />
          <div className="preview">
            <div className="preview-date">{rp(envelope.label)}</div>
            <div className="to">For {addressee || 'you'},</div>
            <div className="preview-rule" />
            <em>Open me slowly. I want the moment to last.</em>
          </div>
        </div>

        <div className="flap-top">
          <div className="flap-underside" />
          <div className="flap-crease" />
        </div>

        <div className="wax-seal">
          <div className="seal-disc" />
          <div className="half left" />
          <div className="half right" />
          <div className="seal-rim" />
          <div className="seal-shine" />
          <div className="motif">
            {envelope.sealMotif || (addressee ? addressee[0].toUpperCase() : 'M')}
          </div>
        </div>
      </div>

    </div>
  );
}

export default Envelope;
