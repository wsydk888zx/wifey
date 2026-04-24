// ── EMBER PARTICLE SYSTEM ────────────────────────────────────────────────────
// Replaces simple dots with ember-drift particles: rotated rects, flicker,
// sinusoidal wind, occasional bloom glow particles.

export function initParticles() {
  const cv = document.getElementById('bg-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, pts = [];
  const COUNT = window.innerWidth < 600 ? 40 : 80;

  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Ember {
    constructor(initial) {
      this.reset(initial);
      this.flickerOffset = Math.random() * Math.PI * 2;
      this.spinRate = (Math.random() - 0.5) * 0.04;
      this.isBloom = Math.random() < 0.025;
    }

    reset(initial) {
      this.x = Math.random() * (W || 1200);
      this.y = initial ? Math.random() * (H || 800) : (H || 800) + 10;
      this.r = this.isBloom ? (Math.random() * 3 + 2) : (Math.random() * 1.6 + 0.5);
      this.vy = -(Math.random() * 0.38 + 0.07);
      this.vx = (Math.random() - 0.5) * 0.18;
      this.life = 0;
      this.max = Math.random() * 420 + 280;
      // Warm ember hue 15–35, occasional crimson 340–350
      this.hue = Math.random() > 0.15
        ? (15 + Math.random() * 20)
        : (340 + Math.random() * 10);
      this.sat = 70 + Math.random() * 20;
      this.angle = Math.random() * Math.PI * 2;
    }

    step(t) {
      // Sinusoidal horizontal wind
      this.x += this.vx + Math.sin(this.life * 0.011 + this.flickerOffset) * 0.14;
      this.y += this.vy;
      this.life++;
      if (this.life > this.max) this.reset(false);
    }

    draw(ctx, t) {
      const age = this.life / this.max;
      const fade = age < 0.12 ? age / 0.12 : age > 0.78 ? 1 - (age - 0.78) / 0.22 : 1;
      const flicker = 0.55 + 0.45 * Math.sin(t * 0.003 + this.flickerOffset);
      const alpha = fade * flicker;

      if (this.isBloom) {
        const r = (8 + 10 * fade) * this.r;
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
        g.addColorStop(0, `hsla(${this.hue}, ${this.sat}%, 65%, ${0.28 * alpha})`);
        g.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + t * this.spinRate);
        ctx.fillStyle = `hsla(${this.hue}, ${this.sat}%, 62%, ${alpha * 0.65})`;
        const w = this.r, h = this.r * 2.8;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }
  }

  for (let i = 0; i < COUNT; i++) pts.push(new Ember(true));

  let t = 0;
  (function loop() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => { p.step(t); p.draw(ctx, t); });
    t++;
    requestAnimationFrame(loop);
  })();
}
