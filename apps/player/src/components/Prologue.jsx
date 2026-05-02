import React from 'react';

import { replacePlaceholders } from '@wifey/story-core';

const FALLBACK_PROLOGUE = {
  lines: ['Five days. Ten envelopes. A story written for you alone.'],
  signoff: '- Yours, watching',
};

function Prologue({ prologue, addressee, storySettings, onBegin, dayCount, envelopeCount }) {
  const content =
    prologue && Array.isArray(prologue.lines) ? prologue : FALLBACK_PROLOGUE;
  const rp = (text) => replacePlaceholders(text, storySettings);

  return (
    <div className="prologue">
      <div className="prologue-vignette" aria-hidden="true" />
      <div className="prologue-room-glow" aria-hidden="true" />
      <div className="prologue-candle" aria-hidden="true">
        <div className="prologue-candle-flame" />
        <div className="prologue-candle-halo" />
      </div>
      <div className="prologue-curtain left" aria-hidden="true" />
      <div className="prologue-curtain right" aria-hidden="true" />
      <div className="prologue-dust dust-a" aria-hidden="true" />
      <div className="prologue-dust dust-b" aria-hidden="true" />
      <div className="prologue-dust dust-c" aria-hidden="true" />
      <div className="prologue-petals" aria-hidden="true">
        <span className="petal p1" />
        <span className="petal p2" />
        <span className="petal p3" />
        <span className="petal p4" />
        <span className="petal p5" />
      </div>

      <div className="prologue-scene">
        <div className="prologue-letter-stack">
          <div className="prologue-envelope-back" aria-hidden="true">
            <div className="prologue-envelope-flap" />
          </div>

          <div className="inner">
            <div className="prologue-paper-grain" aria-hidden="true" />
            <div className="prologue-paper-glow" aria-hidden="true" />
            <div className="prologue-paper-fold" aria-hidden="true" />
            <div className="prologue-kicker">Private Correspondence</div>
            <h1>Yours,</h1>
            <div className="to-name">{addressee || 'beloved'}</div>
            <div className="prologue-divider" aria-hidden="true" />
            {content.lines.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className="line"
                style={{ animationDelay: `${0.2 + index * 0.18}s` }}
              >
                {rp(line)}
              </div>
            ))}
            <div
              className="signoff"
              style={{ animationDelay: `${0.24 + content.lines.length * 0.18}s` }}
            >
              {rp(content.signoff)}
            </div>
            <div className="prologue-ledger" aria-hidden="true">
              <span>{dayCount || 5} days</span>
              <span className="dot" />
              <span>{envelopeCount || 10} seals</span>
              <span className="dot" />
              <span>one witness</span>
            </div>
            <div
              className="prologue-actions"
              style={{ animationDelay: `${0.36 + content.lines.length * 0.18}s` }}
            >
              <div className="prologue-whisper">Low light helps. Honesty matters more.</div>
              <button className="begin" onClick={onBegin}>
                <span className="begin-label">Break the first seal</span>
                <span className="begin-sheen" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="prologue-wax" aria-hidden="true">
            <span className="prologue-wax-drip" />
            <span className="prologue-wax-initial">Y</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Prologue;
