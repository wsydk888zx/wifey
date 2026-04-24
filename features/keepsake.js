// ── KEEPSAKE CANVAS ───────────────────────────────────────────────────────────
import { S, her } from '../state.js';
import { CHAPTERS } from '../story.js';
import { allChoicesArray } from '../state.js';

export function openKeepsake() {
  const modal = document.getElementById('keepsake-modal');
  modal.classList.add('open');
  document.fonts.ready.then(() => drawKeepsake());
}

function drawKeepsake() {
  const canvas = document.getElementById('keepsake-canvas');
  const ctx = canvas.getContext('2d');
  const W = 600, H = 900;
  canvas.width = W;
  canvas.height = H;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#07060d');
  grad.addColorStop(1, '#130c1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Double gold border
  ctx.strokeStyle = 'rgba(201,168,108,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.strokeStyle = 'rgba(201,168,108,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  // Title
  ctx.fillStyle = '#c9a86c';
  ctx.font = 'italic 52px "Bodoni Moda", "Playfair Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Between Us', W / 2, 90);

  // Subtitle
  ctx.fillStyle = 'rgba(201,168,108,0.6)';
  ctx.font = 'italic 18px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(`A story written for ${her()}`, W / 2, 125);

  // Ornament
  ctx.fillStyle = 'rgba(201,168,108,0.5)';
  ctx.font = '16px Georgia, serif';
  ctx.fillText('── ✦ ──', W / 2, 158);

  const ac = allChoicesArray();
  let y = 195;

  for (let i = 0; i < 5; i++) {
    const ch = S.chapters[i];
    if (!ch || !ch.completedAt) continue;
    const chDef = CHAPTERS[i];
    const choices = ch.choices || {};

    ctx.fillStyle = 'rgba(201,168,108,0.45)';
    ctx.font = '500 11px "Crimson Pro", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`DAY ${i + 1}`, 48, y);
    y += 4;

    ctx.fillStyle = 'rgba(237,229,216,0.85)';
    ctx.font = 'italic 20px "Bodoni Moda", "Playfair Display", Georgia, serif';
    ctx.fillText(chDef.title, 48, y + 20);
    y += 36;

    Object.entries(choices).forEach(([key, val]) => {
      const def = chDef.choices && chDef.choices[key];
      if (!def) return;
      const opt = def.options.find(o => o.key === val);
      if (!opt) return;
      ctx.fillStyle = 'rgba(154,142,128,0.75)';
      ctx.font = '15px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(`› ${opt.desc}`, 58, y);
      y += 22;
    });
    y += 14;

    if (i < 4) {
      ctx.strokeStyle = 'rgba(201,168,108,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(48, y);
      ctx.lineTo(W - 48, y);
      ctx.stroke();
      y += 18;
    }

    if (y > 820) break;
  }

  // Date
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillStyle = 'rgba(201,168,108,0.35)';
  ctx.font = '11px "Crimson Pro", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(dateStr.toUpperCase(), W / 2, H - 40);

  const dl = document.getElementById('keepsake-dl');
  dl.href = canvas.toDataURL('image/png');
  dl.style.display = 'inline-block';
}
