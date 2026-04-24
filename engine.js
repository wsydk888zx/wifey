// ── STORY ENGINE ──────────────────────────────────────────────────────────────
// Typewriter, rendering, chapter flow, choices, completion.

import { S, save, buildCtx, allChoicesArray } from './state.js';
import { CHAPTERS } from './story.js';
import { haptic } from './cursor.js';
import { showEnvelope } from './features/envelope.js';
import { flashReadReceipt } from './features/presence.js';

// ── Typewriter ────────────────────────────────────────────────────────────────
let currentTW = null;

function tokenizeHTML(html) {
  const tokens = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      let j = i + 1;
      while (j < html.length && html[j] !== '>') j++;
      tokens.push({ type: 'tag', val: html.slice(i, j + 1) });
      i = j + 1;
    } else {
      tokens.push({ type: 'char', val: html[i] });
      i++;
    }
  }
  return tokens;
}

function typewriterIntoEl(el, html, speed, onDone, tw) {
  const tokens = tokenizeHTML(html);
  let idx = 0, raw = '';
  const cursor = document.createElement('span');
  cursor.className = 'tw-cursor';

  function step() {
    if (tw && tw.cancelled) return;
    if (tw && tw.skip) { el.innerHTML = html; if (onDone) onDone(); return; }
    if (idx >= tokens.length) {
      if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
      if (onDone) onDone();
      return;
    }
    const tok = tokens[idx++];
    if (tok.type === 'tag') {
      raw += tok.val; el.innerHTML = raw; el.appendChild(cursor); step();
    } else {
      raw += tok.val; el.innerHTML = raw; el.appendChild(cursor);
      setTimeout(step, speed);
    }
  }
  step();
}

function typeCharSeq(el, text, speed, onDone, tw) {
  let i = 0;
  const cursor = document.createElement('span');
  cursor.className = 'tw-cursor';
  el.appendChild(cursor);

  function next() {
    if (tw && tw.cancelled) return;
    if (tw && tw.skip) { el.textContent = text; if (onDone) onDone(); return; }
    if (i >= text.length) {
      if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
      if (onDone) onDone();
      return;
    }
    el.textContent = text.slice(0, i + 1);
    el.appendChild(cursor);
    i++;
    setTimeout(next, speed);
  }
  next();
}

export function typewriterParagraphs(containerEl, html, speed, onDone) {
  if (currentTW) currentTW.cancelled = true;
  const tw = { cancelled: false, skip: false };
  currentTW = tw;

  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const nodes = Array.from(tmp.childNodes);
  containerEl.innerHTML = '';
  let ni = 0;

  function nextNode() {
    if (tw.cancelled) return;
    if (ni >= nodes.length) { currentTW = null; if (onDone) onDone(); return; }
    const node = nodes[ni++];
    if (node.nodeType === 3) {
      const span = document.createElement('span');
      containerEl.appendChild(span);
      if (tw.skip) { span.textContent = node.textContent; nextNode(); return; }
      typeCharSeq(span, node.textContent, speed, nextNode, tw);
    } else if (node.nodeType === 1) {
      const clone = node.cloneNode(false);
      containerEl.appendChild(clone);
      if (tw.skip) { clone.innerHTML = node.innerHTML; nextNode(); return; }
      typewriterIntoEl(clone, node.innerHTML, speed, nextNode, tw);
    } else {
      nextNode();
    }
  }
  nextNode();
  return tw;
}

export function skipTypewriter() {
  if (currentTW) {
    currentTW.skip = true;
    currentTW.cancelled = false;
  }
  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) skipBtn.style.display = 'none';
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
export function showToast(msg) {
  const el = document.getElementById('toast-banner');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function askNotifPermission() {
  if (S.notifAsked || !('Notification' in window)) return;
  S.notifAsked = true; save();
  Notification.requestPermission();
}

let _lastUnlockedCount = 0;
export function checkUnlockNotify() {
  let count = 0;
  for (let i = 0; i < 5; i++) if (S.chapters[i] && S.chapters[i].unlockedAt) count++;
  if (count > _lastUnlockedCount && _lastUnlockedCount > 0) {
    showToast(`Day ${count} is now available`);
    if (Notification.permission === 'granted') {
      new Notification('Between Us', { body: 'He has left you something.' });
    }
  }
  _lastUnlockedCount = count;
}

// ── Unlock logic ──────────────────────────────────────────────────────────────
export function checkUnlocks() {
  for (let i = 1; i < 5; i++) {
    if (S.chapters[i]) continue;
    const prev = S.chapters[i - 1];
    if (!prev || !prev.completedAt) continue;
    if (Date.now() >= prev.completedAt + S.hours * 3600 * 1000) {
      S.chapters[i] = { unlockedAt: Date.now(), completedAt: null, choices: {} };
      save();
    }
  }
}

function formatMs(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
  return [h, m, sc].map(v => String(v).padStart(2, '0')).join(':');
}

// ── Transitions ───────────────────────────────────────────────────────────────
export function transitionTo(id, cb) {
  const f = document.getElementById('fade');
  if (f) f.classList.add('show');
  setTimeout(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    if (cb) cb();
    if (f) f.classList.remove('show');
  }, 500);
}

// ── Begin story ───────────────────────────────────────────────────────────────
export function beginStory() {
  const herVal = document.getElementById('inp-her').value.trim();
  const hisVal = document.getElementById('inp-his').value.trim();
  if (!herVal || !hisVal) { alert('Please fill in both names before beginning.'); return; }
  S.her = herVal;
  S.his = hisVal;
  S.tone = document.getElementById('inp-tone').value;
  S.hours = parseInt(document.getElementById('inp-hours').value) || 24;
  S.started = true;
  S.currentDay = 0;
  if (!S.chapters[0]) S.chapters[0] = { unlockedAt: Date.now(), completedAt: null, choices: {} };
  save();
  transitionTo('screen-story', renderStory);
}

// ── Story rendering ───────────────────────────────────────────────────────────
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export function renderStory() {
  checkUnlocks();
  const nav = document.getElementById('day-nav');
  nav.innerHTML = '';
  for (let i = 0; i < CHAPTERS.length; i++) {
    const pip = document.createElement('div');
    pip.className = 'day-pip';
    pip.textContent = i + 1;
    const ch = S.chapters[i];
    if (ch && ch.completedAt) {
      pip.classList.add('done');
      pip.onclick = () => showDay(i);
      pip.style.cursor = 'pointer';
    } else if (ch && ch.unlockedAt) {
      pip.classList.add('active');
      pip.onclick = () => showDay(i);
    } else {
      pip.classList.add('locked');
    }
    nav.appendChild(pip);
  }
  let best = 0;
  for (let i = 0; i < 5; i++) { if (S.chapters[i] && S.chapters[i].unlockedAt) best = i; }
  showDay(best);
}

// ── Show Day ──────────────────────────────────────────────────────────────────
export function showDay(idx) {
  S.currentDay = idx;
  const chState = S.chapters[idx];
  const area = document.getElementById('chapter-area');

  // Cinematic transition between days
  area.classList.add('day-transitioning');
  setTimeout(() => area.classList.remove('day-transitioning'), 1200);

  if (!chState || !chState.unlockedAt) {
    area.innerHTML = renderLocked(idx);
    startCountdown(idx);
    return;
  }

  if (!chState.envelopeOpened) {
    area.innerHTML = '';
    showEnvelope(idx, () => renderDayContent(idx, false));
    return;
  }

  renderDayContent(idx, true);
}

// ── Render day content ────────────────────────────────────────────────────────
export function renderDayContent(idx, skipTW) {
  const ctx = buildCtx();
  const chapter = CHAPTERS[idx];
  const chState = S.chapters[idx];
  const area = document.getElementById('chapter-area');
  const prevChoices = chState.choices || {};
  const done = !!chState.completedAt;

  area.innerHTML = '';

  // Day header
  const header = document.createElement('div');
  header.className = 'day-header scroll-hidden';
  header.innerHTML = `
    <div class="day-number">${chapter.number}</div>
    <h2 class="day-title">${chapter.title}</h2>
    <div class="day-subtitle">${chapter.subtitle}</div>
  `;
  area.appendChild(header);
  requestAnimationFrame(() => header.classList.add('revealed'));

  const ornament1 = document.createElement('div');
  ornament1.className = 'ornament';
  ornament1.textContent = '✦';

  const introCard = document.createElement('div');
  introCard.className = 'card chapter-content-wrap scroll-hidden';
  const introBody = document.createElement('div');
  introBody.className = 'story-body';
  introCard.appendChild(introBody);
  area.appendChild(introCard);
  area.appendChild(ornament1);
  setTimeout(() => introCard.classList.add('revealed'), 150);

  const introHTML = typeof chapter.intro === 'function' ? chapter.intro(ctx) : chapter.intro;

  const choiceKeys = chapter.choices ? Object.keys(chapter.choices) : [];
  const hisChoicesFilledForD5 = idx === 4 && prevChoices.decider === 'him' &&
    !!(prevChoices.location && prevChoices.dinner && prevChoices.warmup &&
       prevChoices.oral && prevChoices.position && prevChoices.finish);
  const allMade = hisChoicesFilledForD5 ||
    (choiceKeys.length === 0 ||
     (choiceKeys.every(k => prevChoices[k]) && (idx !== 4 || prevChoices.decider === 'her')));

  const skipBtn = document.getElementById('skip-btn');

  function showChoicesSection() {
    if (skipBtn) skipBtn.style.display = 'none';

    // Day 5 "he decides" flow
    if (idx === 4 && prevChoices.decider === 'him') {
      const hisChoicesFilled = !!(prevChoices.location && prevChoices.dinner &&
        prevChoices.warmup && prevChoices.oral && prevChoices.position && prevChoices.finish);
      if (!hisChoicesFilled) { showHisChoicesWaiting(); return; }
      if (!chState.hisLetterOpened) { showHisChoicesEnvelope(); return; }
      showOutroSection();
      return;
    }

    if (chapter.choices) {
      const sections = Object.entries(chapter.choices);
      let sectionsToShow = sections;
      if (idx === 4) {
        if (!prevChoices.decider) {
          sectionsToShow = sections.filter(([k]) => k === 'decider');
        } else if (prevChoices.decider === 'her') {
          sectionsToShow = sections.filter(([k]) => k !== 'decider');
        }
      }
      sectionsToShow.forEach(([key, def], si) => {
        const made = prevChoices[key];
        const block = buildChoiceBlock(idx, key, def, made, done);
        block.classList.add('scroll-hidden');
        area.appendChild(block);
        setTimeout(() => block.classList.add('revealed'), si * 80);
        block.style.animationDelay = `${si * 80}ms`;
        if (si < sectionsToShow.length - 1) {
          const sp = document.createElement('div');
          sp.style.height = '.3rem';
          area.appendChild(sp);
        }
      });
    }

    if (allMade) showOutroSection();
  }

  function showHisChoicesWaiting() {
    const waitCard = document.createElement('div');
    waitCard.className = 'card';
    waitCard.style.textAlign = 'center';
    waitCard.innerHTML = `
      <p class="card-title" style="color:var(--gold);">Waiting for him…</p>
      <div class="story-body" style="font-style:italic;color:var(--text-dim);font-size:1rem;margin-bottom:1.8rem;">
        <p>You have asked him to plan tonight. He's been notified.</p>
        <p>Return here when you receive his envelope.</p>
      </div>
    `;
    area.appendChild(waitCard);
    showEnvelope(idx, () => {}, { waiting: true });
  }

  function showHisChoicesEnvelope() {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.textAlign = 'center';
    card.innerHTML = `<p class="card-title" style="color:var(--gold);">He has sent you something.</p>
      <p class="story-body" style="font-style:italic;color:var(--text-dim);font-size:1rem;">Open his envelope when you are ready.</p>`;
    area.appendChild(card);
    showEnvelope(idx, () => {
      chState.hisLetterOpened = true;
      save();
      showHisChoicesLetter();
    }, { hisChoices: true });
  }

  function showHisChoicesLetter() {
    const c = prevChoices;
    const d5 = CHAPTERS[4];
    const desc = (key, val) => {
      if (!d5.choices[key]) return val;
      const opt = d5.choices[key].options.find(o => o.key === val);
      return opt ? opt.desc : val;
    };
    const letterHTML = `
      <p><em>${ctx.Her},</em></p>
      <p><em>You asked me to decide. I have. Tonight belongs entirely to me — and you belong entirely to tonight.</em></p>
      <p><em>Here is what will happen.</em></p>
      <p><em>We will be in <strong>${desc('location', c.location)}</strong>.</em></p>
      <p><em>The evening begins with: <strong>${desc('dinner', c.dinner)}</strong>.</em></p>
      <p><em>Before anything else: <strong>${desc('warmup', c.warmup)}</strong>.</em></p>
      <p><em>Then: <strong>${desc('oral', c.oral)}</strong>.</em></p>
      <p><em>I will take you <strong>${desc('position', c.position)}</strong>.</em></p>
      <p><em>I will finish: <strong>${desc('finish', c.finish)}</strong>.</em></p>
      <p><em>You need only arrive. The rest is mine.</em></p>
      <p><em>— ${ctx.His}</em></p>
    `;
    const orn = document.createElement('div');
    orn.className = 'ornament';
    orn.textContent = '✦';
    area.appendChild(orn);
    const letterCard = document.createElement('div');
    letterCard.className = 'card chapter-content-wrap flipping-in';
    letterCard.innerHTML = `<div class="story-body"><div class="letter">${letterHTML}</div></div>`;
    area.appendChild(letterCard);
    setTimeout(() => showOutroSection(), 600);
  }

  function showOutroSection() {
    const orn2 = document.createElement('div');
    orn2.className = 'ornament';
    orn2.textContent = '✦';
    area.appendChild(orn2);

    const outroCard = document.createElement('div');
    outroCard.className = 'card chapter-content-wrap scroll-hidden';
    const outroBody = document.createElement('div');
    outroBody.className = 'story-body';
    outroCard.appendChild(outroBody);
    area.appendChild(outroCard);
    setTimeout(() => outroCard.classList.add('revealed'), 100);

    const ac = allChoicesArray();
    const outroHTML = typeof chapter.outro === 'function'
      ? chapter.outro(prevChoices, ac) : (chapter.outro || '');

    if (skipTW || done) {
      outroBody.innerHTML = outroHTML;
      showClosingSection();
    } else {
      if (skipBtn) skipBtn.style.display = 'block';
      outroCard.classList.add('flipping-in');
      typewriterParagraphs(outroBody, outroHTML, 16, () => {
        if (skipBtn) skipBtn.style.display = 'none';
        showClosingSection();
      });
    }
  }

  function showClosingSection() {
    haptic([20, 30, 20, 30, 40]);

    if (chapter.isLast) {
      const endGlow = document.createElement('div');
      endGlow.className = 'ending-glow';
      endGlow.innerHTML = `<div class="big">The End</div><p class="story-body" style="font-style:italic;color:var(--text-dim);">— and the beginning of everything after.</p>`;
      area.appendChild(endGlow);
      if (!done) {
        const btnWrap = document.createElement('div');
        btnWrap.className = 'btn-center';
        btnWrap.innerHTML = `<button class="btn btn-primary" id="complete-btn">Complete the story</button>`;
        area.appendChild(btnWrap);
        document.getElementById('complete-btn').onclick = () => completeDay(idx);
      }
      const keepWrap = document.createElement('div');
      keepWrap.className = 'btn-center';
      keepWrap.style.marginTop = '1rem';
      keepWrap.innerHTML = `<button class="btn" id="keepsake-open-btn">Save Your Story</button>`;
      area.appendChild(keepWrap);
      document.getElementById('keepsake-open-btn').onclick = () => {
        import('./features/keepsake.js').then(m => m.openKeepsake());
      };
    } else if (chapter.closing) {
      const cl = typeof chapter.closing === 'function' ? chapter.closing(ctx) : chapter.closing;
      const clCard = document.createElement('div');
      clCard.className = 'card closing-card';
      clCard.innerHTML = `<div class="story-body" style="color:var(--text-dim);">${cl}</div>`;
      area.appendChild(clCard);
      if (!done) {
        const btnWrap = document.createElement('div');
        btnWrap.className = 'btn-center';
        btnWrap.innerHTML = `<button class="btn btn-primary" id="complete-btn">Close this chapter &nbsp;›</button>`;
        area.appendChild(btnWrap);
        document.getElementById('complete-btn').onclick = () => completeDay(idx);
      }
    }
  }

  if (skipTW || done) {
    introBody.innerHTML = introHTML;
    showChoicesSection();
  } else {
    if (skipBtn) skipBtn.style.display = 'block';
    introCard.classList.add('flipping-in');
    typewriterParagraphs(introBody, introHTML, 16, () => {
      if (skipBtn) skipBtn.style.display = 'none';
      showChoicesSection();
    });
  }

  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Choice blocks ─────────────────────────────────────────────────────────────
function buildChoiceBlock(dayIdx, key, def, made, locked) {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const title = document.createElement('p');
  title.className = 'card-title';
  title.textContent = def.label;
  wrap.appendChild(title);

  const choicesDiv = document.createElement('div');
  choicesDiv.className = 'choices';

  def.options.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    if (made === opt.key) card.classList.add('selected');
    if (locked || made) {
      card.style.pointerEvents = 'none';
      if (made && made !== opt.key) card.classList.add('dimmed');
    }
    card.innerHTML = `<div class="choice-label">${opt.desc}</div>${opt.text}`;
    if (!locked && !made) {
      card.addEventListener('click', () => handleChoiceClick(dayIdx, key, opt.key, choicesDiv, card));
    }
    choicesDiv.appendChild(card);
  });

  wrap.appendChild(choicesDiv);

  const heKnew = document.createElement('div');
  heKnew.className = 'he-knew';
  heKnew.textContent = '\u201cHe already knew.\u201d';
  wrap.appendChild(heKnew);

  return wrap;
}

function handleChoiceClick(dayIdx, key, value, choicesDiv, chosenCard) {
  haptic([15]);
  chosenCard.classList.add('glowing', 'selected');

  Array.from(choicesDiv.children).forEach(c => {
    if (c !== chosenCard) { c.classList.add('dimmed'); c.style.pointerEvents = 'none'; }
  });

  const heKnew = choicesDiv.parentElement.querySelector('.he-knew');
  if (heKnew) setTimeout(() => heKnew.classList.add('visible'), 200);

  // Flash read receipt
  setTimeout(() => flashReadReceipt(), 400);

  setTimeout(() => {
    if (!S.chapters[dayIdx] || S.chapters[dayIdx].completedAt) return;
    S.chapters[dayIdx].choices[key] = value;
    save();
    if (dayIdx === 4 && key === 'decider' && value === 'him') {
      showToast('He\'s been notified to open the admin panel.');
    }
    renderDayContent(dayIdx, true);
  }, 1000);
}

// ── Locked / countdown ────────────────────────────────────────────────────────
function renderLocked(idx) {
  const prev = S.chapters[idx - 1];
  if (!prev || !prev.completedAt) {
    return `<div class="countdown-wrap">
      <div class="countdown-label">This chapter awaits</div>
      <div class="countdown-msg">Finish the previous chapter first.</div>
    </div>`;
  }
  const unlockAt = prev.completedAt + S.hours * 3600 * 1000;
  const rem = unlockAt - Date.now();
  if (rem <= 0) { checkUnlocks(); renderStory(); return ''; }
  return `<div class="countdown-wrap">
    <div class="countdown-label">Return in</div>
    <div class="countdown-time" id="countdown-display">${formatMs(rem)}</div>
    <div class="countdown-msg">This chapter opens when the time is right.</div>
  </div>`;
}

let cInterval = null;
function startCountdown(idx) {
  if (cInterval) clearInterval(cInterval);
  const prev = S.chapters[idx - 1];
  if (!prev) return;
  const unlockAt = prev.completedAt + S.hours * 3600 * 1000;
  cInterval = setInterval(() => {
    const rem = unlockAt - Date.now();
    const el = document.getElementById('countdown-display');
    if (rem <= 0) { clearInterval(cInterval); checkUnlocks(); renderStory(); return; }
    if (el) el.textContent = formatMs(rem);
  }, 1000);
}

// ── Complete day ──────────────────────────────────────────────────────────────
export function completeDay(idx) {
  if (!S.chapters[idx]) return;
  S.chapters[idx].completedAt = Date.now();
  haptic([20, 30, 20, 30, 40]);
  checkUnlocks();
  save();
  if (idx === 0) setTimeout(askNotifPermission, 2000);
  renderStory();
}
