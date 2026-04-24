// ── APP BOOTSTRAP ─────────────────────────────────────────────────────────────
import { S } from './state.js';
import { initAudio, toggleSound } from './audio.js';
import { initParticles } from './particles.js';
import { initCursor, haptic } from './cursor.js';
import { initEffects } from './effects.js';
import { beginStory, renderStory, skipTypewriter, checkUnlocks, checkUnlockNotify } from './engine.js';
import { showEnvelope } from './features/envelope.js';
import { openMemory, closeMemory } from './features/memory.js';
import { openAdmin, closeAdmin, adminSendDay5, adminUnlockNext, adminUnlockAll, adminReset } from './features/admin.js';
import { initPresence } from './features/presence.js';
import { handleTrigger } from './features/triggers.js';
import { initScheduler } from './features/scheduler.js';
import { initDial, openDialPanel, closeDialPanel } from './features/dial.js';
import { initHoldReveal } from './features/hold-reveal.js';
import { openMassage } from './features/massage.js';

window.addEventListener('DOMContentLoaded', () => {
  // Particles
  initParticles();

  // Custom cursor
  initCursor();

  // Visual effects (scroll reveal)
  initEffects();

  // Presence indicator
  initPresence();

  // Scheduler
  initScheduler();

  // Desire dial
  initDial();

  // Hold-to-reveal
  initHoldReveal();

  // NFC/QR trigger (must be after initPresence + surveillance imports)
  handleTrigger();

  // Lazy audio init on first interaction
  document.addEventListener('click', function onceClick() {
    initAudio();
    document.removeEventListener('click', onceClick);
  }, { once: true });

  // Periodic unlock check + notification check
  setInterval(() => {
    checkUnlocks();
    checkUnlockNotify();
  }, 60_000);

  // Init unlock count for notification tracking
  // (checkUnlockNotify uses _lastUnlockedCount — seed it silently)
  checkUnlockNotify();

  // Route to correct screen
  if (S.started) {
    document.getElementById('screen-setup').classList.remove('active');
    document.getElementById('screen-story').classList.add('active');
    renderStory();
  }

  // ── Wire global UI ──────────────────────────────────────────────────────────
  // Sound button
  const soundBtn = document.getElementById('sound-btn');
  if (soundBtn) soundBtn.onclick = () => toggleSound();

  // Memory wall
  const memBtn = document.getElementById('memory-btn');
  if (memBtn) memBtn.onclick = () => openMemory();
  const memBackdrop = document.getElementById('memory-backdrop');
  if (memBackdrop) memBackdrop.onclick = () => closeMemory();
  const memClose = document.querySelector('.memory-close');
  if (memClose) memClose.onclick = () => closeMemory();

  // Massage button
  const massageBtn = document.getElementById('massage-btn');
  if (massageBtn) massageBtn.onclick = () => openMassage();

  // Desire dial float button
  const dialBtn = document.getElementById('dial-btn');
  if (dialBtn) dialBtn.onclick = () => openDialPanel();
  const dialClose = document.getElementById('dial-close-btn');
  if (dialClose) dialClose.onclick = () => closeDialPanel();

  // Skip typewriter
  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) skipBtn.onclick = () => skipTypewriter();

  // Admin
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) adminBtn.onclick = () => openAdmin();

  // Begin story
  const beginBtn = document.getElementById('begin-story-btn');
  if (beginBtn) beginBtn.onclick = () => beginStory();

  // Keepsake close
  const keepClose = document.getElementById('keepsake-close-btn');
  if (keepClose) keepClose.onclick = () => document.getElementById('keepsake-modal').classList.remove('open');

  // Admin actions — bind to data attributes for cleanliness
  document.getElementById('admin-close-btn')?.addEventListener('click', closeAdmin);
  document.getElementById('admin-unlock-next')?.addEventListener('click', adminUnlockNext);
  document.getElementById('admin-unlock-all')?.addEventListener('click', adminUnlockAll);
  document.getElementById('admin-reset')?.addEventListener('click', adminReset);
  document.getElementById('admin-send-day5')?.addEventListener('click', adminSendDay5);
});
