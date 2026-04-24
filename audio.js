// ── AMBIENT AUDIO ─────────────────────────────────────────────────────────────
// Web Audio API: brown noise + vinyl crackle + heartbeat pulse

let audioCtx = null;
let masterGain = null;
let noiseSource = null;
let noiseFilter = null;
let soundOn = false;
let crackleTimer = null;

export function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(audioCtx.destination);

  // Brown noise buffer (2 seconds, looped)
  const bufLen = audioCtx.sampleRate * 2;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufLen; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5;
  }

  noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buf;
  noiseSource.loop = true;

  noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 500;

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(masterGain);
  noiseSource.start();
  audioCtx.resume().catch(() => {});
}

function scheduleCrackle() {
  if (crackleTimer) clearTimeout(crackleTimer);
  if (!soundOn || !audioCtx) return;
  const delay = 3000 + Math.random() * 7000;
  crackleTimer = setTimeout(() => {
    if (!soundOn || !audioCtx) return;
    const dur = 0.05 + Math.random() * 0.05;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.1 + Math.random() * 0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);

    const bufLen = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(g);
    g.connect(masterGain);
    src.start();
    scheduleCrackle();
  }, delay);
}

export function toggleSound() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  soundOn = !soundOn;
  const btn = document.getElementById('sound-btn');
  if (soundOn) {
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setTargetAtTime(0.07, audioCtx.currentTime, 0.5);
    if (btn) { btn.textContent = '♫'; btn.classList.add('active'); }
    scheduleCrackle();
  } else {
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
    if (btn) { btn.textContent = '♪'; btn.classList.remove('active'); }
    if (crackleTimer) { clearTimeout(crackleTimer); crackleTimer = null; }
  }
}

// Short heartbeat pulse — used for scheduled message arrival
export function playHeartbeat() {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 80;
  env.gain.setValueAtTime(0, audioCtx.currentTime);
  env.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.04);
  env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
  osc.connect(env);
  env.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.4);
}
