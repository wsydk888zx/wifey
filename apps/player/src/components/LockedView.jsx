import React, { useState, useEffect } from 'react';
import { replacePlaceholders } from '@wifey/story-core';

function formatLockTime(scheduledAt) {
  const scheduled = new Date(scheduledAt);
  const options = { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return scheduled.toLocaleString('en-US', options);
}

function formatCountdown(scheduledAt) {
  const scheduled = new Date(scheduledAt);
  const now = new Date();
  const diff = scheduled - now;

  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `opens in ${hours}h ${minutes}m`;
  }
  return `opens in ${minutes}m`;
}

export default function LockedView({ envelope, storySettings, onUnlock }) {
  const [countdown, setCountdown] = useState(() => formatCountdown(envelope.scheduledAt));
  const [isUnlocked, setIsUnlocked] = useState(false);

  const rp = (text) => replacePlaceholders(text, storySettings);

  const defaultHeading = 'Not yet.';
  const defaultBody = `Come back at {time}.`;

  const heading = envelope.lockedHeading || defaultHeading;
  const body = (envelope.lockedBody || defaultBody)
    .replace('{time}', formatLockTime(envelope.scheduledAt))
    .replace('{date}', new Date(envelope.scheduledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    .replace('{relative}', formatCountdown(envelope.scheduledAt) || 'now');

  useEffect(() => {
    const checkUnlock = () => {
      const scheduled = new Date(envelope.scheduledAt);
      if (Date.now() >= scheduled.getTime()) {
        setIsUnlocked(true);
        setCountdown(null);
        onUnlock?.();
      } else {
        setCountdown(formatCountdown(envelope.scheduledAt));
      }
    };

    const timer = setInterval(checkUnlock, 30000);
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') checkUnlock();
    };
    const focusHandler = () => checkUnlock();

    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('focus', focusHandler);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('focus', focusHandler);
    };
  }, [envelope.scheduledAt, onUnlock]);

  return (
    <div className="locked-view">
      <div className="locked-eye">O</div>
      <h2 className="locked-heading">{rp(heading)}</h2>
      <p className="locked-body">{rp(body)}</p>
      {countdown && (
        <div className="locked-countdown">
          {countdown}
        </div>
      )}
    </div>
  );
}
