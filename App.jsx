// App.jsx — main application state + layout

const { useState, useEffect, useMemo, useRef, useCallback } = React;

const TWEAK_DEFAULTS = {
  herName: "her",
  hisName: "mine",
  intensity: 9,
  recipientPhone: "",
  shortcutWebhookUrl: "",
};

const STORAGE_KEY = 'yoursWatching:v2';
const FLOW_KEY = 'yoursWatching:flowMap:v2';
const CONTENT_KEY = 'yoursWatching:contentEdits:v2';

function toRoman(num) {
  const numerals = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
    ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
    ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
  ];
  let n = Math.max(1, num);
  let out = '';
  numerals.forEach(([symbol, value]) => {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  });
  return out;
}

function getDayId(day, index) {
  return day?.id || `day-${index + 1}`;
}

function isBranchOnlyEnvelope(day, envelope) {
  return !!(day?.branchOnly || envelope?.branchOnly);
}

function flattenDays(days) {
  const items = [];
  days.forEach((day, dayIndex) => {
    const envelopes = window.getDayEnvelopes ? window.getDayEnvelopes(day) : [];
    envelopes.forEach((envelope, envelopeIndex) => {
      if (!envelope) return;
      items.push({
        index: items.length,
        dayIndex,
        day,
        dayId: getDayId(day, dayIndex),
        envelopeIndex,
        slot: envelope.slot || `slot-${envelopeIndex + 1}`,
        envelope,
        envelopeId: envelope.id,
        branchGroup: envelope.branchGroup || '',
        branchOnly: isBranchOnlyEnvelope(day, envelope),
      });
    });
  });
  return items;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function readContent() {
  return window.getGameContent ? window.getGameContent() : window.GAME_CONTENT;
}

function readFlowMap() {
  try {
    const raw = localStorage.getItem(FLOW_KEY);
    if (!raw) {
      return window.buildCompleteFlowMap
        ? window.buildCompleteFlowMap(readContent(), window.DEFAULT_FLOW_MAP || { rules: [] })
        : (window.DEFAULT_FLOW_MAP || { rules: [] });
    }
    const parsed = JSON.parse(raw);
    return window.buildCompleteFlowMap ? window.buildCompleteFlowMap(readContent(), parsed) : parsed;
  } catch {}
  return window.buildCompleteFlowMap
    ? window.buildCompleteFlowMap(readContent(), window.DEFAULT_FLOW_MAP || { rules: [] })
    : (window.DEFAULT_FLOW_MAP || { rules: [] });
}

function findEnvelopeIndex(days, envelopeId) {
  const flattened = flattenDays(days);
  const match = flattened.find(item => item.envelopeId === envelopeId);
  if (match) return match.index;
  return null;
}

function isEnvelopeActive(item, activatedDayIds) {
  return activatedDayIds.has(item.dayId)
    || activatedDayIds.has(item.envelopeId)
    || (item.branchGroup && activatedDayIds.has(item.branchGroup));
}

function findNextActiveIndex(flattened, currentIdx, activatedDayIds) {
  for (let i = currentIdx + 1; i < flattened.length; i++) {
    if (isEnvelopeActive(flattened[i], activatedDayIds)) return i;
  }
  return null;
}

function matchesBranchRule(rule, responses) {
  const rawValue = responses?.[rule.sourceFieldId];
  const normalized = Array.isArray(rawValue)
    ? rawValue.map((item) => String(item).trim()).filter(Boolean)
    : typeof rawValue === 'string'
    ? rawValue.trim()
    : '';
  const expected = (rule.value || '').trim();
  if (rule.operator === 'always') return true;
  if (rule.operator === 'is_filled') return Array.isArray(normalized) ? normalized.length > 0 : !!normalized;
  if (rule.operator === 'equals') {
    if (Array.isArray(normalized)) return normalized.includes(expected);
    return normalized === expected;
  }
  if (rule.operator === 'contains') {
    if (Array.isArray(normalized)) {
      const expectedLower = expected.toLowerCase();
      return normalized.some((item) => item.toLowerCase().includes(expectedLower));
    }
    return !!normalized && normalized.toLowerCase().includes(expected.toLowerCase());
  }
  return false;
}

function buildSmsHref(recipient, body) {
  const phone = encodeURIComponent(recipient || '');
  const text = encodeURIComponent(body || '');
  return `sms:${phone}${text ? `&body=${text}` : ''}`;
}

function WatchIndicator() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <div className="watch-indicator" title="Observed live">
      <div className="dot" />
      <span>Observed</span>
      <span className="rec-time">{hh}:{mm}</span>
    </div>
  );
}

function App() {
  const [content, setContent] = useState(() => readContent());
  const days = content.days || [];

  const [tweaks, setTweaks] = useState(() => ({ ...TWEAK_DEFAULTS, ...(loadState()?.tweaks || {}) }));
  const [showPrologue, setShowPrologue] = useState(() => !loadState()?.started);

  // Current index: 0..9 (5 days × 2 slots)
  const [idx, setIdx] = useState(() => loadState()?.idx ?? 0);

  // envelope state: 'resting' | 'opening' | 'opened'
  const [envState, setEnvState] = useState(() => loadState()?.envState ?? 'resting');

  // chosen choice id for current envelope
  const [chosen, setChosen] = useState(() => loadState()?.chosen ?? null);

  // completed envelope indices
  const [completedIdx, setCompletedIdx] = useState(() => new Set(loadState()?.completedIdx ?? []));
  const [formResponses, setFormResponses] = useState(() => loadState()?.formResponses ?? {});
  const [activatedDayIds, setActivatedDayIds] = useState(() => new Set(loadState()?.activatedDayIds ?? []));
  const [textPrompts, setTextPrompts] = useState(() => loadState()?.textPrompts ?? []);

  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const flattened = useMemo(() => flattenDays(days), [days]);
  const visibleDayIndexes = useMemo(() => {
    return days
      .map((day, index) => ({ day, index }))
      .filter(({ day, index }) => flattened.some((item) => item.dayIndex === index && isEnvelopeActive(item, activatedDayIds)))
      .map(({ index }) => index);
  }, [days, flattened, activatedDayIds]);
  const visibleDayCount = visibleDayIndexes.length;
  const envelopeDisplay = useMemo(() => {
    const dayOrderMap = new Map(visibleDayIndexes.map((dayIndex, idx) => [dayIndex, idx + 1]));
    const activeByDay = new Map();

    flattened.forEach((item) => {
      if (!isEnvelopeActive(item, activatedDayIds)) return;
      if (!activeByDay.has(item.dayIndex)) activeByDay.set(item.dayIndex, []);
      activeByDay.get(item.dayIndex).push(item);
    });

    const displayMap = new Map();
    flattened.forEach((item) => {
      const visibleDayNumber = dayOrderMap.get(item.dayIndex) || item.dayIndex + 1;
      const activeEnvelopes = activeByDay.get(item.dayIndex) || [];
      const activeEnvelopeIndex = Math.max(0, activeEnvelopes.findIndex((entry) => entry.envelopeId === item.envelopeId));
      const timeLabel = item.envelope?.timeLabel || ['Morning', 'Afternoon', 'Evening', 'Night', 'Late Night'][activeEnvelopeIndex] || `Envelope ${activeEnvelopeIndex + 1}`;
      displayMap.set(item.envelopeId, {
        dayNumber: visibleDayNumber,
        timeLabel,
        label: `Day ${toRoman(visibleDayNumber)} · ${timeLabel}`,
      });
    });
    return displayMap;
  }, [flattened, visibleDayIndexes, activatedDayIds]);
  const historyEntries = useMemo(() => {
    return flattened
      .filter(item => completedIdx.has(item.index))
      .map((item) => {
        const choiceId = item.index === idx ? chosen : null;
        const storedChoiceId = item.envelope?.choices?.find(choice => {
          const key = `${item.envelope.id}::${choice.id}`;
          return formResponses[key] || completedIdx.has(item.index);
        })?.id;
        const selectedChoice = item.envelope?.choices?.find(choice => choice.id === storedChoiceId) || null;
        return {
          id: item.envelope.id,
          label: envelopeDisplay.get(item.envelope.id)?.label || item.envelope.label,
          theme: item.day?.theme,
          choiceTitle: selectedChoice?.title || 'Completed',
          choiceHint: selectedChoice?.hint || '',
        };
      });
  }, [flattened, completedIdx, formResponses, idx, chosen, envelopeDisplay]);

  const refreshContent = useCallback(() => {
    setContent(readContent());
  }, []);

  // Persist
  useEffect(() => {
    saveState({
      tweaks,
      started: !showPrologue,
      idx,
      envState,
      chosen,
      completedIdx: Array.from(completedIdx),
      formResponses,
      activatedDayIds: Array.from(activatedDayIds),
      textPrompts,
    });
  }, [tweaks, showPrologue, idx, envState, chosen, completedIdx, formResponses, activatedDayIds, textPrompts]);

  const updateTweak = useCallback((key, val) => {
    setTweaks((t) => ({ ...t, [key]: val }));
  }, []);

  // Current envelope
  const current = flattened[idx] || null;

  const isDone = idx >= flattened.length;

  useEffect(() => {
    if (showPrologue) return;
    if (flattened.length === 0) return;
    if (current && !isEnvelopeActive(current, activatedDayIds)) {
      setActivatedDayIds((prev) => {
        const next = new Set(prev);
        next.add(current.dayId);
        next.add(current.envelopeId);
        if (current.branchGroup) next.add(current.branchGroup);
        return next;
      });
      return;
    }
    if (idx >= flattened.length) return;
    if (current && isEnvelopeActive(current, activatedDayIds)) return;
    const nextVisible = flattened.find(item => isEnvelopeActive(item, activatedDayIds));
    if (nextVisible) {
      setIdx(nextVisible.index);
      setEnvState('resting');
      setChosen(null);
    }
  }, [showPrologue, flattened, idx, current, activatedDayIds]);

  const handleOpenEnvelope = () => {
    if (envState !== 'resting') return;
    setEnvState('opening');
    setTimeout(() => setEnvState('opened'), 1200);
  };

  const handleChoose = (choiceId) => {
    setChosen(choiceId);
  };

  const handleReselect = () => setChosen(null);

  const queueTextPrompt = (prompt) => {
    setTextPrompts((prev) => [prompt, ...prev]);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Text her now', {
        body: prompt.message,
        silent: false,
      });
    }

    const webhookUrl = tweaks.shortcutWebhookUrl?.trim();
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompt),
      }).catch(() => {});
    }
  };

  const handleComplete = () => {
    const textConfig = chosenChoice?.card?.realText;
    if (textConfig?.enabled) {
      const message = rp(textConfig.message || '').trim();
      const recipient = (textConfig.recipient || tweaks.recipientPhone || '').trim();
      if (message) {
        queueTextPrompt({
          id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
          choiceId: chosenChoice.id,
          envelopeId: env.id,
          title: rp(chosenChoice.title || env.label || 'Text her now'),
          message,
          recipient,
          status: 'pending',
        });
      }
    }

    const nextState = (() => {
      const flowMap = readFlowMap();
      const rules = Array.isArray(flowMap?.rules) ? flowMap.rules : [];
      const matchingRule = rules.find((rule) => {
        if (!chosenChoice || rule.sourceChoiceId !== chosenChoice.id) return false;
        return matchesBranchRule(rule, currentResponses);
      });
      const activated = new Set(activatedDayIds);
      if (matchingRule?.targetEnvelopeId) {
        const targetItem = flattened.find(item => item.envelopeId === matchingRule.targetEnvelopeId);
        if (targetItem) {
          activated.add(targetItem.dayId);
          activated.add(targetItem.envelopeId);
          if (targetItem.branchGroup) activated.add(targetItem.branchGroup);
          return { nextIdx: targetItem.index, activated };
        }
      }
      return { nextIdx: flattened.length, activated };
    })();

    setCompletedIdx((s) => {
      const n = new Set(s);
      n.add(idx);
      return n;
    });
    setActivatedDayIds(nextState.activated);
    // advance to next envelope or branch target
    setTimeout(() => {
      setIdx(nextState.nextIdx);
      setEnvState('resting');
      setChosen(null);
    }, 600);
  };

  const handleReset = () => {
    if (!confirm('Reset all progress? All opened envelopes will be sealed again.')) return;
    let savedFlow = null;
    let savedContent = null;
    try {
      savedFlow = localStorage.getItem(FLOW_KEY);
      savedContent = localStorage.getItem(CONTENT_KEY);
    } catch {}

    setIdx(0);
    setEnvState('resting');
    setChosen(null);
    setCompletedIdx(new Set());
    setFormResponses({});
    setActivatedDayIds(new Set());
    setTextPrompts([]);
    setShowPrologue(true);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    try {
      if (savedFlow !== null) localStorage.setItem(FLOW_KEY, savedFlow);
      if (savedContent !== null) localStorage.setItem(CONTENT_KEY, savedContent);
    } catch {}
  };

  if (showPrologue) {
    return (
      <div className="app">
        <Prologue
          prologue={content.prologue}
          addressee={tweaks.herName}
          tweaks={tweaks}
          dayCount={days.length}
          envelopeCount={flattened.length}
          onAdmin={() => setTweaksOpen(v => !v)}
          onBegin={() => setShowPrologue(false)}
        />
        {tweaksOpen && <AdminPanel tweaks={tweaks} setTweak={updateTweak} onReset={handleReset} onClose={() => setTweaksOpen(false)} onContentSaved={refreshContent} textPrompts={textPrompts} setTextPrompts={setTextPrompts} />}
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="app">
        <TopBar addressee={tweaks.herName} onTweaks={() => setTweaksOpen(v => !v)} onHistory={() => setHistoryOpen(v => !v)} />
        <ChoiceHistoryPanel entries={historyEntries} tweaks={tweaks} open={historyOpen} onClose={() => setHistoryOpen(false)} />
        <div className="desk">
          <DayTimeline days={days} flattened={flattened} currentIdx={flattened.length} completedIdx={completedIdx} activatedDayIds={activatedDayIds} tweaks={tweaks} />
          <div className="main main-finale">
            <div className="finale">
              <div className="kicker">The correspondence is complete</div>
              <h2>{visibleDayCount} days.<br/>{flattened.length} envelopes.<br/>All obeyed.</h2>
              <p>You were the best kind of good. Come find me.</p>
            </div>
          </div>
        </div>
        <TextPromptTray prompts={textPrompts} setPrompts={setTextPrompts} />
        {tweaksOpen && <AdminPanel tweaks={tweaks} setTweak={updateTweak} onReset={handleReset} onClose={() => setTweaksOpen(false)} onContentSaved={refreshContent} textPrompts={textPrompts} setTextPrompts={setTextPrompts} />}
      </div>
    );
  }

  const rp = (text) => window.replacePlaceholders ? window.replacePlaceholders(text, tweaks) : text;

  const env = current?.envelope || null;
  const envDisplay = current ? envelopeDisplay.get(current.envelopeId) : null;
  const chosenChoice = env?.choices?.find(c => c.id === chosen) || null;
  const responseKey = chosenChoice ? `${env.id}::${chosenChoice.id}` : null;
  const currentResponses = responseKey ? (formResponses[responseKey] || {}) : {};

  const handleResponseChange = (key, value) => {
    if (!responseKey) return;
    setFormResponses((prev) => {
      const next = { ...prev };
      const existing = next[responseKey] || {};
      next[responseKey] = { ...existing, [key]: value };
      return next;
    });
  };

  if (!env) {
    return (
      <div className="app">
        <TopBar addressee={tweaks.herName} onTweaks={() => setTweaksOpen(v => !v)} onHistory={() => setHistoryOpen(v => !v)} />
        <ChoiceHistoryPanel entries={historyEntries} tweaks={tweaks} open={historyOpen} onClose={() => setHistoryOpen(false)} />
        <div className="desk">
          <div className="main">
            <div className="locked">
              <div className="eye">◉</div>
              <h3>Story content missing</h3>
              <p>Open Admin to restore or re-import the configured days and envelopes.</p>
            </div>
          </div>
        </div>
        <TextPromptTray prompts={textPrompts} setPrompts={setTextPrompts} />
        {tweaksOpen && <AdminPanel tweaks={tweaks} setTweak={updateTweak} onReset={handleReset} onClose={() => setTweaksOpen(false)} onContentSaved={refreshContent} textPrompts={textPrompts} setTextPrompts={setTextPrompts} />}
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar addressee={tweaks.herName} onTweaks={() => setTweaksOpen(v => !v)} onHistory={() => setHistoryOpen(v => !v)} />
      <ChoiceHistoryPanel entries={historyEntries} tweaks={tweaks} open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <div className="desk">
        <DayTimeline days={days} flattened={flattened} currentIdx={idx} completedIdx={completedIdx} activatedDayIds={activatedDayIds} tweaks={tweaks} />

        <div className={`main ${envState !== 'opened' ? 'main-envelope' : chosenChoice ? 'main-letter' : 'main-choices'}`}>
          {envState !== 'opened' && (
            <>
              <div className="stage-copy">
                <div className="slot-label">{rp(envDisplay?.label || env.label)}</div>
                <p className="slot-intro">{rp(env.intro)}</p>
              </div>
              <Envelope
                envelope={{ ...env, label: envDisplay?.label || env.label }}
                addressee={tweaks.herName}
                tweaks={tweaks}
                state={envState}
                onOpen={handleOpenEnvelope}
              />
            </>
          )}

          {envState === 'opened' && !chosenChoice && (
            <div className="choices-card">
              <div className="choices-heading">
                <div className="kicker">{rp(envDisplay?.label || env.label)}</div>
                <h2>{rp(env.choicesHeading || 'Where will you go?')}</h2>
                <p className="choices-intro">
                  {rp(env.choicesIntro || 'Only one of these is for you tonight. Read each carefully. Once you pick, the others disappear.')}
                </p>
              </div>

              <div className="choices-list">
                {env.choices.map((c, i) => (
                  <button key={c.id} className="choice-row" onClick={() => handleChoose(c.id)}>
                    <div className="choice-numeral">{['i.', 'ii.', 'iii.', 'iv.', 'v.'][i] || `${i + 1}.`}</div>
                    <div className="choice-text">
                      <span className="title-script">{rp(c.title)}</span>
                      <span className="hint">{rp(c.hint)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {envState === 'opened' && chosenChoice && (
            <TaskCard
              card={chosenChoice.card}
              envelope={{ ...env, label: envDisplay?.label || env.label, timeLabel: envDisplay?.timeLabel || env.timeLabel }}
              addressee={tweaks.herName}
              tweaks={tweaks}
              completed={completedIdx.has(idx)}
              onComplete={handleComplete}
              onReselect={handleReselect}
              hasChoices={env.choices.length > 1}
              responses={currentResponses}
              onResponseChange={handleResponseChange}
            />
          )}
        </div>
      </div>

      <TextPromptTray prompts={textPrompts} setPrompts={setTextPrompts} />
      {tweaksOpen && <AdminPanel tweaks={tweaks} setTweak={updateTweak} onReset={handleReset} onClose={() => setTweaksOpen(false)} onContentSaved={refreshContent} textPrompts={textPrompts} setTextPrompts={setTextPrompts} />}
    </div>
  );
}

function TextPromptTray({ prompts, setPrompts }) {
  if (!prompts?.length) return null;

  const pending = prompts.filter(prompt => prompt.status !== 'done');
  if (!pending.length) return null;

  const latest = pending[0];

  const markDone = (id) => {
    setPrompts((prev) => prev.map(prompt => prompt.id === id ? { ...prompt, status: 'done' } : prompt));
  };

  const clearDone = () => {
    setPrompts((prev) => prev.filter(prompt => prompt.status !== 'done'));
  };

  return (
    <div className="text-prompt-tray">
      <div className="text-prompt-header">
        <span>Text Her Now</span>
        <span>{pending.length} pending</span>
      </div>
      <div className="text-prompt-title">{latest.title}</div>
      {latest.recipient ? <div className="text-prompt-meta">To {latest.recipient}</div> : null}
      <div className="text-prompt-body">{latest.message}</div>
      <div className="text-prompt-actions">
        <a className="primary" href={buildSmsHref(latest.recipient, latest.message)}>Open in Messages</a>
        <button className="secondary" onClick={() => markDone(latest.id)}>Mark sent</button>
        <button className="secondary" onClick={clearDone}>Clear sent</button>
      </div>
    </div>
  );
}

function TopBar({ addressee, onTweaks, onHistory, onNewAdmin }) {
  return (
    <div className="top-bar">
      <div className="brand">
        <div className="title">Yours, watching</div>
        <div className="addressee">for {addressee || 'her'}</div>
      </div>
      <div className="top-right">
        <WatchIndicator />
        {onHistory ? <button className="top-btn" onClick={onHistory}>Choices</button> : null}
        <button className="top-btn" onClick={onTweaks}>Admin</button>
      </div>
    </div>
  );
}

function ChoiceHistoryPanel({ entries, tweaks, open, onClose }) {
  const rp = (text) => window.replacePlaceholders ? window.replacePlaceholders(text, tweaks) : text;

  return (
    <div className={`choice-history-panel ${open ? 'open' : ''}`}>
      <div className="choice-history-header">
        <h4>Previous Choices</h4>
        <button onClick={onClose}>×</button>
      </div>
      <div className="choice-history-scroll">
        {!entries.length && (
          <div className="choice-history-empty">No choices yet. They will appear here as she moves through the story.</div>
        )}
        {entries.map((entry, index) => (
          <div key={`${entry.id}-${index}`} className="choice-history-card">
            <div className="choice-history-theme">{rp(entry.theme || '')}</div>
            <div className="choice-history-label">{rp(entry.label || '')}</div>
            <div className="choice-history-choice">{rp(entry.choiceTitle || '')}</div>
            {entry.choiceHint ? <div className="choice-history-hint">{rp(entry.choiceHint)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayTimeline({ days, flattened, currentIdx, completedIdx, activatedDayIds, tweaks }) {
  const rp = (text) => window.replacePlaceholders ? window.replacePlaceholders(text, tweaks) : text;
  const visibleDays = days
    .map((day, index) => ({
      day,
      index,
      dayId: getDayId(day, index),
      hasActiveEnvelopes: flattened.some((item) => item.dayIndex === index && isEnvelopeActive(item, activatedDayIds)),
    }))
    .filter(({ hasActiveEnvelopes }) => hasActiveEnvelopes);

  if (!visibleDays.length) return null;

  return (
    <div className="timeline">
      <div className="cord" />
      {visibleDays.map(({ day, index }, i) => {
        const dayEnvelopeIndexes = flattened
          .filter(item => item.dayIndex === index)
          .map(item => item.index);
        const bothDone = dayEnvelopeIndexes.length > 0 && dayEnvelopeIndexes.every(envIdx => completedIdx.has(envIdx));
        const isCurrent = dayEnvelopeIndexes.includes(currentIdx);
        const cls = bothDone ? 'done' : isCurrent ? 'current' : 'future';
        return (
          <div key={getDayId(day, index)} className={`seal-node ${cls}`}>
            <div className="seal-medallion">{toRoman(i + 1)}</div>
            <div className="seal-caption">
              <span className="day-line">Day {toRoman(i + 1)}</span>
              <span className="theme-line">{rp(day.theme)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TweaksPanel({ tweaks, setTweak, onReset, onClose }) {
  return (
    <div className="tweaks-panel">
      <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 14px' }}>
        Tweaks
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(237,227,209,0.5)', cursor: 'pointer', fontSize: '18px', padding: 0, lineHeight: 1 }}>×</button>
      </h4>
      <div className="row">
        <label>Her name</label>
        <input type="text" value={tweaks.herName} onChange={(e) => setTweak('herName', e.target.value)} />
      </div>
      <div className="row">
        <label>His name / how she addresses him</label>
        <input type="text" value={tweaks.hisName} onChange={(e) => setTweak('hisName', e.target.value)} />
      </div>
      <button className="reset-btn" onClick={onReset}>Reset all progress</button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
