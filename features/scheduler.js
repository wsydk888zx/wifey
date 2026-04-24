// ── SCHEDULED MESSAGES ───────────────────────────────────────────────────────
// Pre-written messages that fire at clock times via setInterval.
import { S, save } from '../state.js';
import { showToast } from '../engine.js';
import { playHeartbeat } from '../audio.js';
import { haptic } from '../cursor.js';

export function initScheduler() {
  setInterval(checkScheduled, 30_000);
}

function checkScheduled() {
  const msgs = S.scheduledMessages || [];
  if (!msgs.length) return;

  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  let changed = false;
  msgs.forEach(msg => {
    if (!msg.fired && msg.hour === h && Math.abs(msg.minute - m) <= 1) {
      msg.fired = true;
      changed = true;
      deliverMessage(msg.text);
    }
  });

  if (changed) save();
}

function deliverMessage(text) {
  playHeartbeat();
  haptic([10, 20, 10, 20, 10]);
  showToast(text);

  if (Notification.permission === 'granted') {
    new Notification('Between Us', { body: text, silent: true });
  }

  // Inject glowing message card into chapter area
  const area = document.getElementById('chapter-area');
  if (!area) return;

  const card = document.createElement('div');
  card.className = 'card scheduled-message-card';
  card.innerHTML = `
    <div class="scheduled-badge">A MESSAGE FROM HIM</div>
    <div class="story-body">${text}</div>
  `;
  area.prepend(card);
  card.animate([
    { opacity: 0, transform: 'translateY(-12px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 700, easing: 'ease', fill: 'forwards' });
}

// ── Admin panel renderer ──────────────────────────────────────────────────────
export function renderSchedulerAdmin(containerEl) {
  const msgs = S.scheduledMessages || [];
  containerEl.innerHTML = `
    <div class="admin-section-title">Scheduled Messages</div>
    <div class="admin-scheduler-list">
      ${msgs.length ? msgs.map((msg, i) => `
        <div class="admin-msg-row ${msg.fired ? 'fired' : ''}">
          <span class="admin-msg-time">${String(msg.hour).padStart(2,'0')}:${String(msg.minute).padStart(2,'0')}</span>
          <span class="admin-msg-text">${msg.text}</span>
          <button class="admin-msg-delete" data-idx="${i}">×</button>
        </div>
      `).join('') : '<div class="admin-msg-empty">No messages scheduled.</div>'}
    </div>
    <div class="admin-scheduler-form">
      <input type="time" id="sched-time" class="admin-time-input">
      <input type="text" id="sched-text" placeholder="Message text…" maxlength="160">
      <button class="btn" id="sched-add-btn">Add</button>
    </div>
  `;

  containerEl.querySelector('#sched-add-btn').onclick = () => {
    const timeVal = document.getElementById('sched-time').value;
    const textVal = document.getElementById('sched-text').value.trim();
    if (!timeVal || !textVal) return;
    const [h, m] = timeVal.split(':').map(Number);
    if (!S.scheduledMessages) S.scheduledMessages = [];
    S.scheduledMessages.push({ hour: h, minute: m, text: textVal, fired: false });
    save();
    renderSchedulerAdmin(containerEl);
  };

  containerEl.querySelectorAll('.admin-msg-delete').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx);
      S.scheduledMessages.splice(idx, 1);
      save();
      renderSchedulerAdmin(containerEl);
    };
  });
}
