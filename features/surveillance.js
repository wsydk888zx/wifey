// ── SURVEILLANCE LOG ──────────────────────────────────────────────────────────
// Logs every NFC/QR scan with timestamp. Renders in memory wall.
import { S, save } from '../state.js';

export function logScan(trigger) {
  if (!S.triggerLog) S.triggerLog = [];
  S.triggerLog.unshift({
    trigger,
    label: trigger.toUpperCase().replace(/-/g, ' '),
    timestamp: Date.now()
  });
  S.triggerLog = S.triggerLog.slice(0, 50);
  save();
}

export function renderSurveillanceLog(containerEl) {
  const log = S.triggerLog || [];
  if (!log.length) {
    containerEl.innerHTML = '<div class="log-empty">No location scans recorded.</div>';
    return;
  }
  containerEl.innerHTML = log.map(entry => `
    <div class="log-entry">
      <span class="log-location">${entry.label}</span>
      <span class="log-time">${formatLogTime(entry.timestamp)}</span>
    </div>
  `).join('');
}

function formatLogTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMs / 3600000);
  const diffD   = Math.floor(diffMs / 86400000);

  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH   < 24) return `${diffH}h ago`;
  if (diffD   < 7)  return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
