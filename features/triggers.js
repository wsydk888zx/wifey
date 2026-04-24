// ── NFC / QR LOCATION TRIGGERS ───────────────────────────────────────────────
// Handles ?trigger=room URL params from NFC tags or QR codes.
import { logScan } from './surveillance.js';
import { triggerPresenceBurst } from './presence.js';
import { showToast } from '../engine.js';

const TRIGGER_MESSAGES = {
  bedroom:    'He left something for you here.',
  bathroom:   'He has been thinking about you in this room.',
  kitchen:    'Something is waiting for you here.',
  livingroom: 'He imagined you here.',
  shower:     'He knows exactly where you go.',
  closet:     'He left this for you to find.',
  office:     'Even here, he is watching.',
  bed:        'He knew you would come back to this.',
};

export function handleTrigger() {
  const params  = new URLSearchParams(window.location.search);
  const trigger = params.get('trigger');
  if (!trigger) return;

  const message = TRIGGER_MESSAGES[trigger.toLowerCase()]
    || `You have arrived: ${trigger}`;

  // Log the scan
  logScan(trigger);

  // Show ambient toast
  // showToast(`[ ${trigger.toUpperCase()} ] — ${message}`);

  // Pulse presence dot
  triggerPresenceBurst();

  // Clean URL without reload
  history.replaceState({}, '', window.location.pathname);
}
