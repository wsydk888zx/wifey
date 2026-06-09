import React, { useEffect } from 'react';

import { replacePlaceholders, toRoman } from '@wifey/story-core';

// Read-only replay of a letter she has already received. Mirrors TaskCard's
// letter markup (so it inherits all the same parchment styling) but strips the
// response form and the "mark obeyed" action — this is purely for re-reading.
function LetterReplay({ card, envelope, addressee, storySettings, receivedAt, globalResponses = {}, onClose }) {
  const rp = (text) => {
    if (typeof text !== 'string') return text;
    let result = replacePlaceholders(text, storySettings);
    if (Object.keys(globalResponses).length > 0) {
      result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) =>
        Object.hasOwn(globalResponses, key) ? String(globalResponses[key] || '') : match,
      );
    }
    return result;
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const initial = (addressee || 'M').trim().charAt(0).toUpperCase() || 'M';
  const signoffName = rp(storySettings.hisName || 'M');
  const revealItems = Array.isArray(card.revealItems) ? card.revealItems : [];
  const bodyParagraphs = String(rp(card.body || ''))
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const receivedLabel = receivedAt
    ? new Date(receivedAt).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const renderParagraph = (paragraph) => {
    const lines = paragraph.split('\n');
    return lines.map((line, index) => (
      <span key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 ? <br /> : null}
      </span>
    ));
  };

  return (
    <div
      className="letter-replay"
      role="dialog"
      aria-modal="true"
      aria-label="Your last letter"
      onClick={(event) => event.stopPropagation()}
    >
      <button className="letter-replay-scrim" onClick={onClose} aria-label="Close letter" type="button" />
      <div className="letter-replay-sheet">
        <button className="letter-replay-close" onClick={onClose} aria-label="Close" type="button">
          ×
        </button>
        <div className="letter-replay-kicker">The last letter he sent you</div>

        <div className="card-stage visible">
          <div className="card-wrap">
            <div className="ribbon" />
            <article className="task-card">
              <div className="card-seal">{envelope.sealMotif || initial}</div>
              <div className="watermark">{initial}</div>

              <div className="card-inner">
                <div className="date-line">
                  {rp(envelope.timeLabel || envelope.label)}
                  {receivedLabel ? ` · ${receivedLabel}` : ''}
                </div>
                <div className="salutation">{addressee ? `${addressee},` : 'My love,'}</div>
                {card.heading ? <div className="letter-heading">{rp(card.heading)}</div> : null}

                <div className="fleuron">· ❦ ·</div>

                <div className="body-text">
                  {bodyParagraphs.map((paragraph, index) => (
                    <p key={`${paragraph.slice(0, 24)}-${index}`}>{renderParagraph(paragraph)}</p>
                  ))}
                </div>

                {card.rule ? (
                  <div className="rule-note">
                    <span className="label">The rule</span>
                    <div>{rp(card.rule)}</div>
                  </div>
                ) : null}

                {revealItems.length ? (
                  <div className="reveal-list">
                    <div className="reveal-list-title">What I&apos;ve chosen for tonight</div>
                    <div className="reveal-list-items">
                      {revealItems.map((item, index) => (
                        <div className="reveal-item" key={item.id || `reveal-item-${index + 1}`}>
                          <div className="reveal-item-index">{toRoman(index + 1)}</div>
                          <div className="reveal-item-body">
                            <div className="reveal-item-title">{rp(item.title || `Reveal ${index + 1}`)}</div>
                            {item.description ? (
                              <div className="reveal-item-description">{rp(item.description)}</div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="signoff-block">
                  <div className="signoff-line">Yours, always</div>
                  <div className="signoff-name">{signoffName}.</div>
                  <div className="signoff-flourish" />
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LetterReplay;
