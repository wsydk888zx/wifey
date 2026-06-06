import React, { useState, useEffect, useCallback } from 'react';
import { replacePlaceholders } from '@wifey/story-core';

const DEFAULT_TEASES = [
  'I said be patient. Come back later.',
  'Stop testing me. You wait.',
  'You already know the answer. Not yet.',
];

function formatLockTime(date) {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCountdown(unlockAt) {
  const diff = unlockAt - new Date();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `opens in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `opens in ${hours}h ${minutes}m`;
  return `opens in ${minutes}m`;
}

export default function LockedView({ envelope, unlockAt, storySettings, onUnlock }) {
  const [countdown, setCountdown] = useState(() => (unlockAt ? formatCountdown(unlockAt) : null));
  const [teaseIndex, setTeaseIndex] = useState(null);
  const [tapped, setTapped] = useState(false);

  const rp = useCallback((text) => replacePlaceholders(text, storySettings), [storySettings]);

  const herName = storySettings?.herName || 'you';

  const teases = Array.isArray(envelope.lockedTeases) && envelope.lockedTeases.length
    ? envelope.lockedTeases
    : DEFAULT_TEASES.map((t) => t.replace('{herName}', herName));

  const defaultHeading = `Patience, ${herName}.`;
  const defaultBody = unlockAt
    ? `Your next card comes later. Sit with this one.\nThink about what's coming.`
    : `Your next card comes when it's ready.\nSit with this one. Think about what's coming.`;

  const heading = envelope.lockedHeading
    ? rp(envelope.lockedHeading)
    : defaultHeading;

  const body = (() => {
    const raw = envelope.lockedBody || defaultBody;
    let resolved = rp(raw);
    if (unlockAt) {
      resolved = resolved
        .replace('{time}', formatLockTime(unlockAt))
        .replace('{date}', unlockAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
        .replace('{relative}', formatCountdown(unlockAt) || 'soon');
    }
    return resolved;
  })();

  useEffect(() => {
    if (!unlockAt) return;

    const checkUnlock = () => {
      if (Date.now() >= unlockAt.getTime()) {
        setCountdown(null);
        onUnlock?.();
      } else {
        setCountdown(formatCountdown(unlockAt));
      }
    };

    const timer = setInterval(checkUnlock, 30000);
    const visibilityHandler = () => { if (document.visibilityState === 'visible') checkUnlock(); };
    const focusHandler = () => checkUnlock();

    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('focus', focusHandler);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('focus', focusHandler);
    };
  }, [unlockAt, onUnlock]);

  const handleSealTap = () => {
    setTeaseIndex((prev) => prev === null ? 0 : (prev + 1) % teases.length);
    setTapped(true);
    setTimeout(() => setTapped(false), 600);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(18);
    }
  };

  const motif = envelope.sealMotif || '✦';

  return (
    <div className="locked-view">
      <div className="locked-view-inner">

        <button
          className={`locked-seal-host${tapped ? ' locked-seal-tapped' : ''}`}
          onClick={handleSealTap}
          aria-label="Sealed"
          type="button"
        >
          <div className="seal-disc" />
          <div className="half left" />
          <div className="half right" />
          <div className="seal-rim" />
          <div className="seal-shine" />
          <div className="motif">{motif}</div>
        </button>

        <div className="locked-text">
          {teaseIndex !== null ? (
            <p key={teaseIndex} className="locked-tease">{rp(teases[teaseIndex])}</p>
          ) : (
            <>
              <h2 className="locked-heading">{heading}</h2>
              <p className="locked-body">{body}</p>
            </>
          )}
        </div>

        {countdown && (
          <div className="locked-countdown">{countdown}</div>
        )}
      </div>
    </div>
  );
}
