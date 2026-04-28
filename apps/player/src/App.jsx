import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

import { defaultContent } from '@wifey/story-content';
import {
  STORAGE_KEYS,
  TWEAK_DEFAULTS,
  buildCompleteFlowMap,
  flattenStoryEnvelopes,
  getStoryDayId,
  matchesFlowRule,
  normalizeContentModel,
  replacePlaceholders,
  toRoman,
} from '@wifey/story-core';

import Envelope from './components/Envelope.jsx';
import Prologue from './components/Prologue.jsx';
import TaskCard from './components/TaskCard.jsx';

const storyContent = normalizeContentModel(defaultContent);

const supabase = import.meta.env.VITE_SUPABASE_URL
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.state);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadTweaks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tweaks);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
  } catch {}
}

function normalizeTweakState(...sources) {
  const merged = Object.assign({}, ...sources.filter(Boolean));
  const intensity = Number(merged.intensity);

  return {
    herName: merged.herName ?? TWEAK_DEFAULTS.herName,
    hisName: merged.hisName ?? TWEAK_DEFAULTS.hisName,
    intensity: Number.isFinite(intensity)
      ? Math.min(10, Math.max(1, Math.round(intensity)))
      : TWEAK_DEFAULTS.intensity,
  };
}

function readFlowMap(content) {
  return buildCompleteFlowMap(content, content.defaultFlowMap || { rules: [] });
}

function isEnvelopeActive(item, activatedDayIds) {
  return (
    activatedDayIds.has(item.dayId) ||
    activatedDayIds.has(item.envelopeId) ||
    (item.branchGroup && activatedDayIds.has(item.branchGroup))
  );
}

function TopBar({ addressee, onHistory, onReset }) {
  return (
    <div className="top-bar">
      <div className="brand">
        <div className="addressee">for {addressee || 'her'}</div>
      </div>
      <div className="top-right">
        {onHistory ? (
          <button className="top-btn" onClick={onHistory}>
            Choices
          </button>
        ) : null}
        {onReset ? (
          <button className="top-btn top-btn-danger" onClick={onReset} title="Reset progress">
            Reset
          </button>
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
                  {entry.theme ? (
                    <div className="cht-theme">{rp(entry.theme)}</div>
                  ) : null}
                  <div className="cht-label">{rp(entry.label || '')}</div>
                  <div className="cht-choice">{rp(entry.choiceTitle || '')}</div>
                  {entry.choiceHint ? (
                    <div className="cht-hint">{rp(entry.choiceHint)}</div>
                  ) : null}
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
      dayId: getStoryDayId(day, index),
      hasActiveEnvelopes: flattened.some(
        (item) => item.dayIndex === index && isEnvelopeActive(item, activatedDayIds),
      ),
    }))
    .filter(({ hasActiveEnvelopes }) => hasActiveEnvelopes);

  if (!visibleDays.length) return null;

  return (
    <div className="timeline">
      <div className="cord" />
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
          <div key={getStoryDayId(day, index)} className={`seal-node ${className}`}>
            <div className="seal-medallion">{toRoman(visibleIndex + 1)}</div>
            <div className="seal-caption">
              <span className="day-line">Day {toRoman(visibleIndex + 1)}</span>
              <span className="theme-line">{rp(day.theme)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const persistedState = useMemo(() => loadState(), []);
  const persistedTweaks = useMemo(() => loadTweaks(), []);
  const content = storyContent;
  const days = content.days || [];

  const tweaks = useMemo(
    () => normalizeTweakState(TWEAK_DEFAULTS, persistedState?.tweaks, persistedTweaks),
    [persistedState, persistedTweaks],
  );
  const [showPrologue, setShowPrologue] = useState(() => !persistedState?.started);
  const [idx, setIdx] = useState(() => persistedState?.idx ?? 0);
  const [envState, setEnvState] = useState(() => persistedState?.envState ?? 'resting');
  const [chosen, setChosen] = useState(() => persistedState?.chosen ?? null);
  const [completedIdx, setCompletedIdx] = useState(
    () => new Set(persistedState?.completedIdx ?? []),
  );
  const [formResponses, setFormResponses] = useState(
    () => persistedState?.formResponses ?? {},
  );
  const [activatedDayIds, setActivatedDayIds] = useState(
    () => new Set(persistedState?.activatedDayIds ?? []),
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState(
    () => persistedState?.selectedChoices ?? {},
  );

  const flattened = useMemo(() => flattenStoryEnvelopes(days), [days]);
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
            sealMotif: item.envelope.sealMotif || String(item.dayIndex + 1),
            choiceTitle: selectedChoice?.title || 'Completed',
            choiceHint: selectedChoice?.hint || '',
          };
        }),
    [flattened, completedIdx, selectedChoices, envelopeDisplay],
  );

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
      selectedChoices,
    });
  }, [
    tweaks,
    showPrologue,
    idx,
    envState,
    chosen,
    completedIdx,
    formResponses,
    activatedDayIds,
    selectedChoices,
  ]);

  useEffect(() => {
    if (!supabase || !responseKey) return;
    const [envelopeId, choiceId] = responseKey.split('::');
    supabase.from('player_responses').upsert(
      { envelope_id: envelopeId, choice_id: choiceId, responses: currentResponses, updated_at: new Date().toISOString() },
      { onConflict: 'envelope_id,choice_id' }
    ).then(() => {});
  }, [responseKey, currentResponses]);

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
  const rp = (text) => replacePlaceholders(text, tweaks);

  useEffect(() => {
    if (envState !== 'opening') return undefined;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timeoutId = window.setTimeout(() => setEnvState('opened'), reduceMotion ? 350 : 2300);

    return () => window.clearTimeout(timeoutId);
  }, [envState]);

  const handleOpenEnvelope = () => {
    if (envState !== 'resting') return;
    setEnvState('opening');
  };

  const handleChoose = (choiceId) => {
    setChosen(choiceId);
  };

  const handleReselect = () => {
    setChosen(null);
  };

  const handleComplete = () => {
    if (!env || !chosenChoice) return;

    const nextState = (() => {
      const flowMap = readFlowMap(content);
      const rules = Array.isArray(flowMap?.rules) ? flowMap.rules : [];
      const matchingRule = rules.find((rule) => {
        if (rule.sourceChoiceId !== chosenChoice.id) return false;
        return matchesFlowRule(rule, currentResponses);
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

    setCompletedIdx((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
    setSelectedChoices((prev) => ({
      ...prev,
      [env.id]: chosenChoice.id,
    }));
    setActivatedDayIds(nextState.activated);

    window.setTimeout(() => {
      setIdx(nextState.nextIdx);
      setEnvState('resting');
      setChosen(null);
    }, 600);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all progress? All opened envelopes will be sealed again.')) {
      return;
    }

    setIdx(0);
    setEnvState('resting');
    setChosen(null);
    setCompletedIdx(new Set());
    setFormResponses({});
    setActivatedDayIds(new Set());
    setSelectedChoices({});
    setHistoryOpen(false);
    setShowPrologue(true);

    try {
      localStorage.removeItem(STORAGE_KEYS.state);
    } catch {}
  };

  const handleResponseChange = (key, value) => {
    if (!responseKey) return;

    setFormResponses((prev) => {
      const next = { ...prev };
      const existing = next[responseKey] || {};
      next[responseKey] = { ...existing, [key]: value };
      return next;
    });
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
          onBegin={() => setShowPrologue(false)}
        />
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="app">
        <TopBar
          addressee={tweaks.herName}
          onHistory={() => setHistoryOpen((open) => !open)}
        />
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
                {visibleDayCount} days.
                <br />
                {flattened.length} envelopes.
                <br />
                All obeyed.
              </h2>
              <p>You were the best kind of good. Come find me.</p>
            </div>
            <div className="actions actions-centered">
              <button className="secondary" onClick={handleReset}>
                Seal everything again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!env) {
    return (
      <div className="app">
        <TopBar
          addressee={tweaks.herName}
          onHistory={() => setHistoryOpen((open) => !open)}
          onReset={handleReset}
        />
        <ChoiceHistoryPanel
          entries={historyEntries}
          tweaks={tweaks}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
        <div className="desk">
          <div className="main">
            <div className="locked">
              <div className="eye">O</div>
              <h3>Story content missing</h3>
              <p>The bundled player content is unavailable in this build.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar
        addressee={tweaks.herName}
        onHistory={() => setHistoryOpen((open) => !open)}
        onReset={handleReset}
      />
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
                      <span className="title-script">{rp(choice.title || choice.heading)}</span>
                      {choice.hint ? <span className="hint">{rp(choice.hint)}</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {envState === 'opened' && chosenChoice ? (
            <TaskCard
              card={chosenChoice.card || chosenChoice}
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

    </div>
  );
}

export default App;
