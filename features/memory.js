// ── MEMORY WALL ───────────────────────────────────────────────────────────────
import { S } from '../state.js';
import { CHAPTERS } from '../story.js';
import { allChoicesArray } from '../state.js';
import { renderSurveillanceLog } from './surveillance.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export function openMemory() {
  renderMemoryWall();
  document.getElementById('memory-backdrop').classList.add('open');
  document.getElementById('memory-panel').classList.add('open');
}

export function closeMemory() {
  document.getElementById('memory-backdrop').classList.remove('open');
  document.getElementById('memory-panel').classList.remove('open');
}

function renderMemoryWall() {
  const scroll = document.getElementById('memory-scroll');
  const ac = allChoicesArray();
  let html = '';
  let anyChoice = false;

  for (let i = 0; i < 5; i++) {
    const ch = S.chapters[i];
    if (!ch) continue;
    const choices = ch.choices || {};
    const chDef = CHAPTERS[i];

    Object.entries(choices).forEach(([key, val]) => {
      const def = chDef.choices && chDef.choices[key];
      if (!def) return;
      const opt = def.options.find(o => o.key === val);
      if (!opt) return;
      anyChoice = true;
      const rot = (-2 + Math.random() * 4).toFixed(1);
      html += `<div class="polaroid" style="transform:rotate(${rot}deg)">
        <div class="polaroid-band">${ROMAN[i]} — ${chDef.title}</div>
        <div class="polaroid-body">
          <div class="choice-label" style="color:#7a6238;margin-bottom:.25rem;">${def.label}</div>
          <div class="polaroid-choice">${opt.desc}</div>
          <div class="polaroid-caption">Day ${i + 1} — ${chDef.title}</div>
        </div>
      </div>`;
    });
  }

  if (!anyChoice) html = '<div class="memory-empty">No choices made yet.<br>They will appear here as you read.</div>';

  // Surveillance log section
  html += `<div class="surveillance-section">
    <div class="surveillance-title">Movement Record</div>
    <div id="surveillance-log-render"></div>
  </div>`;

  scroll.innerHTML = html;

  // Render surveillance log into the placeholder
  const logEl = document.getElementById('surveillance-log-render');
  if (logEl) renderSurveillanceLog(logEl);
}
