import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from '@supabase/supabase-js';
import { defaultContent } from '@wifey/story-content';
import { subscribeToPush, getExistingSubscription } from './usePushSubscription.js';
import {
  TWEAK_DEFAULTS,
  buildCompleteFlowMap,
  getDayEnvelopes,
  normalizeContentModel,
  replacePlaceholders,
  toRoman,
} from '@wifey/story-core';

import Envelope from './components/Envelope.jsx';
import Prologue from './components/Prologue.jsx';
import TaskCard from './components/TaskCard.jsx';

const supabase =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
    : null;

function normalizePlayerTweaks(tweaks = {}) {
  const source = tweaks && typeof tweaks === 'object' ? tweaks : {};
  const intensity = Number(source.intensity);

  return {
    herName: Object.hasOwn(source, 'herName')
      ? String(source.herName ?? '')
      : TWEAK_DEFAULTS.herName,
    hisName: Object.hasOwn(source, 'hisName')
      ? String(source.hisName ?? '')
      : TWEAK_DEFAULTS.hisName,
    intensity: Number.isFinite(intensity)
      ? Math.min(10, Math.max(1, Math.round(intensity)))
      : TWEAK_DEFAULTS.intensity,
  };
}

// ── Supabase story and state persistence ──────────────────────────────────────

async function fetchPublishedStory() {
  if (!supabase) return defaultContent;

  try {
    const { data: stories, error } = await supabase
      .from('stories')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1);

    if (error || !stories || stories.length === 0) {
      console.warn('Failed to load published story, using default:', error);
      return defaultContent;
    }

    const story = stories[0];
    return {
      prologue: story.prologue || { lines: [], signoff: '' },
      days: Array.isArray(story.days) ? story.days : [],
      flowMap: story.flow_map || { rules: [] },
      tweaks: normalizePlayerTweaks(
        story.tweaks ||
        (story.flow_map && typeof story.flow_map === 'object' ? story.flow_map.tweaks : undefined),
      ),
    };
  } catch (err) {
    console.error('Error fetching published story:', err);
    return defaultContent;
  }
}

async function fetchRemoteState() {
  if (!supabase) return null;
  const { data } = await supabase
    .from('player_state')
    .select('state')
    .eq('id', 'main')
    .single();
  return data?.state ?? null;
}

function saveRemoteState(state) {
  if (!supabase) return;
  supabase
    .from('player_state')
    .upsert({ id: 'main', state, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .then(() => {});
}

// ── Story helpers ─────────────────────────────────────────────────────────────

function getDayId(day, index) {
  return day?.id || `day-${index + 1}`;
}

function isBranchOnlyEnvelope(day, envelope) {
  return !!(day?.branchOnly || envelope?.branchOnly);
}

function flattenDays(days) {
  const items = [];
  days.forEach((day, dayIndex) => {
    getDayEnvelopes(day).forEach((envelope, envelopeIndex) => {
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

function isEnvelopeActive(item, activatedDayIds) {
  return (
    activatedDayIds.has(item.dayId) ||
    activatedDayIds.has(item.envelopeId) ||
    (item.branchGroup && activatedDayIds.has(item.branchGroup))
  );
}

function matchesBranchRule(rule, responses) {
  const rawValue = responses?.[rule.sourceFieldId];
  const normalized = Array.isArray(rawValue)
    ? rawValue.map((item) => String(item).trim()).filter(Boolean)
    : typeof rawValue === 'string'
      ? rawValue.trim()
      : '';
  const expected = String(rule.value || '').trim();

  if (rule.operator === 'always') return true;
  if (rule.operator === 'is_filled') {
    return Array.isArray(normalized) ? normalized.length > 0 : !!normalized;
  }
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
  if (phone && text) return `sms:${phone}&body=${text}`;
  if (phone) return `sms:${phone}`;
  if (text) return `sms:?body=${text}`;
  return 'sms:';
}

function sendTextPromptNotification(prompt) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('Text her now', { body: prompt.message, icon: '/icons/icon-192.png' });
  } catch {}
}

// ── UI components ─────────────────────────────────────────────────────────────

function TextPromptTray({ prompts, setPrompts }) {
  if (!prompts?.length) return null;
  const pending = prompts.filter((p) => p.status !== 'done');
  if (!pending.length) return null;
  const latest = pending[0];
  const markDone = (id) =>
    setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'done' } : p)));
  const clearDone = () => setPrompts((prev) => prev.filter((p) => p.status !== 'done'));

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
        <a className="primary" href={buildSmsHref(latest.recipient, latest.message)}>
          Open in Messages
        </a>
        <button className="secondary" onClick={() => markDone(latest.id)}>Mark sent</button>
        <button className="secondary" onClick={clearDone}>Clear sent</button>
      </div>
    </div>
  );
}

function TopBar({ onHistory }) {
  return (
    <div className="top-bar">
      <div className="top-right">
        {onHistory ? (
          <button className="top-btn" onClick={onHistory}>Choices</button>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceHistoryPanel({ entries, tweaks, open, onClose }) {
  const rp = (text) => replacePlaceholders(text, tweaks);
  return (
    <div className={`choice-history-panel ${open ? 'open' : ''}`}>
      <div className="choice-history-header">
        <span className="choice-history-title">Her choices</span>
        <button onClick={onClose} aria-label="Close">&#x2715;</button>
      </div>
      <div className="choice-history-scroll">
        {!entries.length ? (
          <div className="choice-history-empty">
            No choices yet. They will appear here as she moves through the story.
          </div>
        ) : (
          <div className="cht-timeline">
            {entries.map((entry, index) => (
              <div
                key={`${entry.id}-${index}`}
                className="cht-entry"
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <div className="cht-spine">
                  <div className="cht-seal">{entry.sealMotif || index + 1}</div>
                  {index < entries.length - 1 ? <div className="cht-cord" /> : null}
                </div>
                <div className="cht-body">
                  {entry.theme ? <div className="cht-theme">{rp(entry.theme)}</div> : null}
                  <div className="cht-label">{rp(entry.label || '')}</div>
                  <div className="cht-choice">{rp(entry.choiceTitle || '')}</div>
                  {entry.choiceHint ? <div className="cht-hint">{rp(entry.choiceHint)}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DayTimeline({ days, flattened, currentIdx, completedIdx, activatedDayIds, tweaks }) {
  const rp = (text) => replacePlaceholders(text, tweaks);
  const visibleDays = days
    .map((day, index) => ({
      day,
      index,
      dayId: getDayId(day, index),
      hasActiveEnvelopes: flattened.some(
        (item) => item.dayIndex === index && isEnvelopeActive(item, activatedDayIds),
      ),
    }))
    .filter(({ hasActiveEnvelopes }) => hasActiveEnvelopes);

  if (!visibleDays.length) return null;

  const currentEntry = visibleDays.find(({ index }, visibleIndex) => {
    const dayEnvelopeIndexes = flattened
      .filter((item) => item.dayIndex === index)
      .map((item) => item.index);
    return dayEnvelopeIndexes.includes(currentIdx);
  });
  const currentVisibleIndex = currentEntry ? visibleDays.indexOf(currentEntry) : visibleDays.length - 1;
  const activeDay = currentEntry || visibleDays[visibleDays.length - 1];

  return (
    <div className="timeline">
      <div className="cord" />
      <div className="seal-row">
        {visibleDays.map(({ day, index }, visibleIndex) => {
          const dayEnvelopeIndexes = flattened
            .filter((item) => item.dayIndex === index)
            .map((item) => item.index);
          const dayComplete =
            dayEnvelopeIndexes.length > 0 &&
            dayEnvelopeIndexes.every((envIndex) => completedIdx.has(envIndex));
          const isCurrent = dayEnvelopeIndexes.includes(currentIdx);
          const className = dayComplete ? 'done' : isCurrent ? 'current' : 'future';

          return (
            <div key={getDayId(day, index)} className={`seal-node ${className}`}>
              <div className="seal-medallion">{toRoman(visibleIndex + 1)}</div>
            </div>
          );
        })}
      </div>
      {activeDay && (
        <div className="timeline-label">
          <span className="timeline-label-day">Day&nbsp;{toRoman(currentVisibleIndex + 1)}</span>
          <span className="timeline-label-sep">·</span>
          <span className="timeline-label-theme">{rp(activeDay.day.title || activeDay.day.theme)}</span>
        </div>
      )}
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="app">
      <div className="desk">
        <div className="main">
          <div className="locked">
            <div className="eye">O</div>
            <p style={{ fontFamily: 'var(--serif)', color: 'var(--brass)' }}>Loading…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Push notification prompt ──────────────────────────────────────────────────

function NotificationPrompt({ onDone }) {
  const [loading, setLoading] = React.useState(false);

  const handleEnable = async () => {
    setLoading(true);
    await subscribeToPush();
    setLoading(false);
    onDone();
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--parchment)', borderTop: '1px solid var(--brass)',
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10,
      fontFamily: 'var(--sans)',
    }}>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '1rem', color: 'var(--ink, #2a1f14)' }}>
        Enable notifications to know when a new envelope arrives.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            flex: 1, padding: '10px 0', background: 'var(--brass)', color: '#fff',
            border: 'none', borderRadius: 4, fontFamily: 'var(--sans)', fontSize: '0.9rem',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Enabling…' : 'Enable notifications'}
        </button>
        <button
          onClick={onDone}
          style={{
            padding: '10px 16px', background: 'transparent', color: 'var(--brass)',
            border: '1px solid var(--brass)', borderRadius: 4, fontFamily: 'var(--sans)',
            fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}

// ── Player app (receives pre-loaded data as props) ────────────────────────────

function PlayerApp({ content, tweaks, flowMap, initialState }) {
  const days = content?.days || [];
  const flattened = useMemo(() => flattenDays(days), [days]);

  const [showPrologue, setShowPrologue] = useState(() => !initialState?.started);
  const [idx, setIdx] = useState(() => initialState?.idx ?? 0);
  const [envState, setEnvState] = useState(() => initialState?.envState ?? 'resting');
  const [chosen, setChosen] = useState(() => initialState?.chosen ?? null);
  const [completedIdx, setCompletedIdx] = useState(
    () => new Set(initialState?.completedIdx ?? []),
  );
  const [formResponses, setFormResponses] = useState(() => initialState?.formResponses ?? {});
  const [activatedDayIds, setActivatedDayIds] = useState(
    () => new Set(initialState?.activatedDayIds ?? []),
  );
  const [textPrompts, setTextPrompts] = useState(() => initialState?.textPrompts ?? []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState(
    () => initialState?.selectedChoices ?? {},
  );

  // Save all game state to Supabase on every change
  useEffect(() => {
    saveRemoteState({
      started: !showPrologue,
      idx,
      envState,
      chosen,
      completedIdx: Array.from(completedIdx),
      formResponses,
      activatedDayIds: Array.from(activatedDayIds),
      textPrompts,
      selectedChoices,
    });
  }, [showPrologue, idx, envState, chosen, completedIdx, formResponses, activatedDayIds, textPrompts, selectedChoices]);

  // Sync form responses to player_responses table for admin visibility
  const syncedResponses = useRef({});
  useEffect(() => {
    if (!supabase) return;
    const pending = Object.entries(formResponses).filter(
      ([key, val]) => syncedResponses.current[key] !== JSON.stringify(val),
    );
    if (!pending.length) return;
    pending.forEach(([key, val]) => {
      const [envelope_id, choice_id] = key.split('::');
      if (!envelope_id || !choice_id) return;
      supabase
        .from('player_responses')
        .upsert({ envelope_id, choice_id, responses: val }, { onConflict: 'envelope_id,choice_id' })
        .then(() => { syncedResponses.current[key] = JSON.stringify(val); });
    });
  }, [formResponses]);

  const visibleDayIndexes = useMemo(
    () =>
      days
        .map((day, index) => ({ day, index }))
        .filter(({ index }) =>
          flattened.some(
            (item) => item.dayIndex === index && isEnvelopeActive(item, activatedDayIds),
          ),
        )
        .map(({ index }) => index),
    [days, flattened, activatedDayIds],
  );
  const visibleDayCount = visibleDayIndexes.length;

  const envelopeDisplay = useMemo(() => {
    const dayOrderMap = new Map(
      visibleDayIndexes.map((dayIndex, displayIndex) => [dayIndex, displayIndex + 1]),
    );
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
      const activeEnvelopeIndex = Math.max(
        0,
        activeEnvelopes.findIndex((entry) => entry.envelopeId === item.envelopeId),
      );
      const timeLabel =
        item.envelope?.timeLabel ||
        ['Morning', 'Afternoon', 'Evening', 'Night', 'Late Night'][activeEnvelopeIndex] ||
        `Envelope ${activeEnvelopeIndex + 1}`;

      displayMap.set(item.envelopeId, {
        dayNumber: visibleDayNumber,
        timeLabel,
        label: `Day ${toRoman(visibleDayNumber)} · ${timeLabel}`,
      });
    });
    return displayMap;
  }, [flattened, visibleDayIndexes, activatedDayIds]);

  const historyEntries = useMemo(
    () =>
      flattened
        .filter((item) => completedIdx.has(item.index))
        .map((item) => {
          const selectedChoice =
            item.envelope?.choices?.find(
              (choice) => choice.id === selectedChoices[item.envelope.id],
            ) || null;
          return {
            id: item.envelope.id,
            label: envelopeDisplay.get(item.envelope.id)?.label || item.envelope.label,
            theme: item.day?.theme,
            sealMotif: item.envelope.sealMotif,
            choiceTitle: selectedChoice?.title || 'Completed',
            choiceHint: selectedChoice?.hint || '',
          };
        }),
    [flattened, completedIdx, selectedChoices, envelopeDisplay],
  );

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

    const nextVisible = flattened.find((item) => isEnvelopeActive(item, activatedDayIds));
    if (nextVisible) {
      setIdx(nextVisible.index);
      setEnvState('resting');
      setChosen(null);
    }
  }, [showPrologue, flattened, idx, current, activatedDayIds]);

  const env = current?.envelope || null;
  const envDisplay = current ? envelopeDisplay.get(current.envelopeId) : null;
  const chosenChoice = env?.choices?.find((choice) => choice.id === chosen) || null;
  const responseKey = chosenChoice ? `${env.id}::${chosenChoice.id}` : null;
  const currentResponses = responseKey ? formResponses[responseKey] || {} : {};
  const rp = useCallback((text) => replacePlaceholders(text, tweaks), [tweaks]);

  const handleOpenEnvelope = () => {
    if (envState !== 'resting') return;
    setEnvState('opening');
    window.setTimeout(() => setEnvState('opened'), 1200);
  };

  const handleChoose = (choiceId) => setChosen(choiceId);
  const handleReselect = () => setChosen(null);

  const queueTextPrompt = (prompt) => {
    setTextPrompts((prev) => [prompt, ...prev]);
    void sendTextPromptNotification(prompt);
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
    if (!env || !chosenChoice) return;

    const textConfig = chosenChoice.card?.realText;
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
      const rules = Array.isArray(flowMap?.rules) ? flowMap.rules : [];
      const matchingRule = rules.find((rule) => {
        if (rule.sourceChoiceId !== chosenChoice.id) return false;
        return matchesBranchRule(rule, currentResponses);
      });
      const activated = new Set(activatedDayIds);

      if (matchingRule?.targetEnvelopeId) {
        const targetItem = flattened.find(
          (item) => item.envelopeId === matchingRule.targetEnvelopeId,
        );
        if (targetItem) {
          activated.add(targetItem.dayId);
          activated.add(targetItem.envelopeId);
          if (targetItem.branchGroup) activated.add(targetItem.branchGroup);
          return { nextIdx: targetItem.index, activated };
        }
      }
      return { nextIdx: flattened.length, activated };
    })();

    setCompletedIdx((prev) => { const next = new Set(prev); next.add(idx); return next; });
    setSelectedChoices((prev) => ({ ...prev, [env.id]: chosenChoice.id }));
    setActivatedDayIds(nextState.activated);

    window.setTimeout(() => {
      setIdx(nextState.nextIdx);
      setEnvState('resting');
      setChosen(null);
    }, 600);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all progress? All opened envelopes will be sealed again.')) return;
    setIdx(0);
    setEnvState('resting');
    setChosen(null);
    setCompletedIdx(new Set());
    setFormResponses({});
    setActivatedDayIds(new Set());
    setTextPrompts([]);
    setSelectedChoices({});
    setHistoryOpen(false);
    setShowPrologue(true);
    // Wipe remote state too
    saveRemoteState({});
  };

  const handleResponseChange = (key, value) => {
    if (!responseKey) return;
    setFormResponses((prev) => {
      const next = { ...prev };
      next[responseKey] = { ...(next[responseKey] || {}), [key]: value };
      return next;
    });
  };

  if (showPrologue) {
    return (
      <div className="app">
        <Prologue
          prologue={content.prologue}
          tweaks={tweaks}
          dayCount={days.length}
          envelopeCount={flattened.length}
          onBegin={() => setShowPrologue(false)}
        />
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="app">
        <TopBar onHistory={() => setHistoryOpen((open) => !open)} />
        <ChoiceHistoryPanel
          entries={historyEntries}
          tweaks={tweaks}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
        <div className="desk">
          <DayTimeline
            days={days}
            flattened={flattened}
            currentIdx={flattened.length}
            completedIdx={completedIdx}
            activatedDayIds={activatedDayIds}
            tweaks={tweaks}
          />
          <div className="main main-finale">
            <div className="finale">
              <div className="kicker">The correspondence is complete</div>
              <h2>
                {visibleDayCount} days.<br />
                {flattened.length} envelopes.<br />
                All obeyed.
              </h2>
              <p>You were the best kind of good. Come find me.</p>
            </div>
            <div className="actions actions-centered">
              <button className="secondary" onClick={handleReset}>Seal everything again</button>
            </div>
          </div>
        </div>
        <TextPromptTray prompts={textPrompts} setPrompts={setTextPrompts} />
      </div>
    );
  }

  if (!env) {
    return (
      <div className="app">
        <TopBar onHistory={() => setHistoryOpen((open) => !open)} />
        <div className="desk">
          <div className="main">
            <div className="locked">
              <div className="eye">O</div>
              <h3>Story content missing</h3>
              <p>The bundled player content is unavailable in this build.</p>
            </div>
          </div>
        </div>
        <TextPromptTray prompts={textPrompts} setPrompts={setTextPrompts} />
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar onHistory={() => setHistoryOpen((open) => !open)} />
      <ChoiceHistoryPanel
        entries={historyEntries}
        tweaks={tweaks}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      <div className="desk">
        <DayTimeline
          days={days}
          flattened={flattened}
          currentIdx={idx}
          completedIdx={completedIdx}
          activatedDayIds={activatedDayIds}
          tweaks={tweaks}
        />
        <div
          className={`main ${
            envState !== 'opened'
              ? 'main-envelope'
              : chosenChoice
                ? 'main-letter'
                : 'main-choices'
          }`}
        >
          {envState !== 'opened' ? (
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
          ) : null}

          {envState === 'opened' && !chosenChoice ? (
            <div className="choices-card">
              <div className="choices-heading">
                <div className="kicker">{rp(envDisplay?.label || env.label)}</div>
                <h2>{rp(env.choicesHeading || 'Where will you go?')}</h2>
                <p className="choices-intro">
                  {rp(
                    env.choicesIntro ||
                      'Only one of these is for you tonight. Read each carefully. Once you pick, the others disappear.',
                  )}
                </p>
              </div>
              <div className="choices-list">
                {env.choices.map((choice, index) => (
                  <button
                    key={choice.id}
                    className="choice-row"
                    onClick={() => handleChoose(choice.id)}
                  >
                    <div className="choice-numeral">
                      {['i.', 'ii.', 'iii.', 'iv.', 'v.'][index] || `${index + 1}.`}
                    </div>
                    <div className="choice-text">
                      <span className="title-script">{rp(choice.title)}</span>
                      <span className="hint">{rp(choice.hint)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {envState === 'opened' && chosenChoice ? (
            <TaskCard
              card={chosenChoice.card}
              envelope={{
                ...env,
                label: envDisplay?.label || env.label,
                timeLabel: envDisplay?.timeLabel || env.timeLabel,
              }}
              addressee={tweaks.herName}
              tweaks={tweaks}
              completed={completedIdx.has(idx)}
              onComplete={handleComplete}
              onReselect={handleReselect}
              hasChoices={env.choices.length > 1}
              responses={currentResponses}
              onResponseChange={handleResponseChange}
            />
          ) : null}
        </div>
      </div>
      <TextPromptTray prompts={textPrompts} setPrompts={setTextPrompts} />
    </div>
  );
}

// ── App loader — fetches content + state from Supabase, then mounts PlayerApp ─

function App() {
  const [ready, setReady] = useState(false);
  const [content, setContent] = useState(null);
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [flowMap, setFlowMap] = useState({ rules: [] });
  const [initialState, setInitialState] = useState(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!('Notification' in window) || !('PushManager' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    getExistingSubscription().then((sub) => {
      if (!sub) setShowNotifPrompt(true);
    });
  }, [ready]);

  useEffect(() => {
    async function load() {
      // Load published story from Supabase (or use default)
      const storyData = await fetchPublishedStory();
      setContent(normalizeContentModel(storyData));
      setTweaks(normalizePlayerTweaks(storyData.tweaks));

      // Load player state
      const stateResult = await fetchRemoteState();
      setInitialState(stateResult || {});

      // Build flow map from story content
      setFlowMap(buildCompleteFlowMap(storyData, storyData.flowMap || storyData.defaultFlowMap || { rules: [] }));

      setReady(true);
    }

    load();
  }, []);

  if (!ready) return <LoadingScreen />;

  return (
    <>
      <PlayerApp
        content={content}
        tweaks={tweaks}
        flowMap={flowMap}
        initialState={initialState}
      />
      {showNotifPrompt ? (
        <NotificationPrompt onDone={() => setShowNotifPrompt(false)} />
      ) : null}
    </>
  );
}

export default App;
