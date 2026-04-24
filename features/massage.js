// ── GUIDED MASSAGE ────────────────────────────────────────────────────────────
// Full-screen overlay with SVG body map, timed zone instructions, haptic pulses.
import { haptic } from '../cursor.js';

const SEQUENCE = [
  { zone: 'scalp',     duration: 60,  instruction: 'Fingertips at the crown. Slow circles outward toward the temples. Let her breathe into it.' },
  { zone: 'shoulders', duration: 120, instruction: 'Both thumbs at the base of her neck. Firm pressure, outward strokes. She will drop immediately.' },
  { zone: 'back',      duration: 180, instruction: 'Long strokes, sacrum to shoulders. Full palm. Warm oil. No agenda for these three minutes — just this.' },
  { zone: 'arms',      duration: 60,  instruction: 'Down each arm to the wrist. Long. Slow. Her hands in yours at the end.' },
  { zone: 'legs',      duration: 90,  instruction: 'Down from hip to ankle. Firm. Attentive. Take your time at the calf.' },
  { zone: 'thighs',    duration: 90,  instruction: 'Inner thighs last. Approach slowly. Stop when her breath changes. She will tell you without speaking.' },
];

let activeZoneTimer = null;
let hapticInterval  = null;

export function openMassage() {
  const overlay = document.getElementById('massage-overlay');
  if (!overlay) { buildMassageOverlay(); return; }
  overlay.classList.add('open');
  resetMassage();
}

export function closeMassage() {
  const overlay = document.getElementById('massage-overlay');
  if (overlay) overlay.classList.remove('open');
  clearTimers();
}

function clearTimers() {
  if (activeZoneTimer) clearTimeout(activeZoneTimer);
  if (hapticInterval)  clearInterval(hapticInterval);
  activeZoneTimer = hapticInterval = null;
}

function buildMassageOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'massage-overlay';
  overlay.innerHTML = `
    <div class="massage-inner">
      <button class="massage-close" id="massage-close-btn">×</button>
      <div class="massage-title">Guided Touch</div>
      <div class="massage-subtitle">Tap a zone to begin</div>

      <div class="massage-body-wrap">
        <svg class="massage-svg" viewBox="0 0 120 280" xmlns="http://www.w3.org/2000/svg">
          <!-- Head -->
          <ellipse cx="60" cy="22" rx="16" ry="20" data-zone="scalp" class="body-zone" />
          <!-- Neck -->
          <rect x="52" y="40" width="16" height="14" rx="4" data-zone="shoulders" class="body-zone" style="pointer-events:none;"/>
          <!-- Shoulders -->
          <rect x="20" y="50" width="80" height="16" rx="6" data-zone="shoulders" class="body-zone" />
          <!-- Torso -->
          <rect x="32" y="64" width="56" height="70" rx="8" class="body-zone" data-zone="back" />
          <!-- Arms -->
          <rect x="8"  y="64" width="22" height="80" rx="6" data-zone="arms" class="body-zone" />
          <rect x="90" y="64" width="22" height="80" rx="6" data-zone="arms" class="body-zone" />
          <!-- Hips / thighs upper -->
          <rect x="28" y="132" width="64" height="30" rx="6" data-zone="thighs" class="body-zone" />
          <!-- Legs -->
          <rect x="28" y="160" width="26" height="90" rx="8" data-zone="legs" class="body-zone" />
          <rect x="66" y="160" width="26" height="90" rx="8" data-zone="legs" class="body-zone" />
        </svg>
      </div>

      <div class="massage-instruction-wrap" id="massage-instruction" style="display:none;">
        <div class="massage-zone-name" id="massage-zone-name"></div>
        <div class="massage-instruction-text" id="massage-instruction-text"></div>
        <div class="massage-timer-bar"><div class="massage-timer-fill" id="massage-timer-fill"></div></div>
        <div class="massage-timer-label" id="massage-timer-label"></div>
      </div>

      <div class="massage-complete" id="massage-complete" style="display:none;">
        <div class="massage-complete-text">She is ready.</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.classList.add('open');

  document.getElementById('massage-close-btn').onclick = closeMassage;

  overlay.querySelectorAll('.body-zone').forEach(zone => {
    zone.addEventListener('click', () => startZone(zone.dataset.zone));
    zone.addEventListener('touchend', e => { e.preventDefault(); startZone(zone.dataset.zone); });
  });
}

function resetMassage() {
  clearTimers();
  const instrWrap = document.getElementById('massage-instruction');
  const complete  = document.getElementById('massage-complete');
  if (instrWrap) instrWrap.style.display = 'none';
  if (complete)  complete.style.display  = 'none';
  document.querySelectorAll('.body-zone.active-zone').forEach(z => z.classList.remove('active-zone'));
}

function startZone(zoneName) {
  clearTimers();
  const entry = SEQUENCE.find(s => s.zone === zoneName);
  if (!entry) return;

  haptic([15, 20, 15]);

  // Highlight zone
  document.querySelectorAll('.body-zone.active-zone').forEach(z => z.classList.remove('active-zone'));
  document.querySelectorAll(`[data-zone="${zoneName}"]`).forEach(z => z.classList.add('active-zone'));

  // Show instruction
  const instrWrap = document.getElementById('massage-instruction');
  const zoneLbl   = document.getElementById('massage-zone-name');
  const instrText = document.getElementById('massage-instruction-text');
  const timerFill = document.getElementById('massage-timer-fill');
  const timerLbl  = document.getElementById('massage-timer-label');

  instrWrap.style.display = 'block';
  zoneLbl.textContent  = zoneName.charAt(0).toUpperCase() + zoneName.slice(1);
  instrText.textContent = entry.instruction;
  timerFill.style.transition = 'none';
  timerFill.style.width = '100%';

  let remaining = entry.duration;
  timerLbl.textContent = formatSecs(remaining);

  // Animate timer bar
  requestAnimationFrame(() => {
    timerFill.style.transition = `width ${entry.duration}s linear`;
    timerFill.style.width = '0%';
  });

  // Tick label
  const tickInterval = setInterval(() => {
    remaining--;
    if (timerLbl) timerLbl.textContent = formatSecs(remaining);
    if (remaining <= 0) clearInterval(tickInterval);
  }, 1000);

  // Haptic pulse every 2s while active
  hapticInterval = setInterval(() => haptic(12), 2000);

  // On completion
  activeZoneTimer = setTimeout(() => {
    clearInterval(hapticInterval);
    clearInterval(tickInterval);
    haptic([20, 30, 60]);

    // Check if this was the last zone
    const zoneIdx = SEQUENCE.findIndex(s => s.zone === zoneName);
    if (zoneIdx >= SEQUENCE.length - 1) {
      instrWrap.style.display = 'none';
      const complete = document.getElementById('massage-complete');
      if (complete) complete.style.display = 'block';
    }
  }, entry.duration * 1000);
}

function formatSecs(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
