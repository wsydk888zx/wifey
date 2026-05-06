import { toRoman } from './formatting.js';

const ENVELOPE_TIME_LABELS = [
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
  'Late Night',
  'After Midnight',
];

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function getDefaultTimeLabel(index = 0) {
  return ENVELOPE_TIME_LABELS[index] || `Envelope ${index + 1}`;
}

function inferLegacyTimeLabel(envelope, fallbackIndex = 0) {
  if (envelope?.timeLabel) return envelope.timeLabel;
  if (envelope?.slot === 'prologue') return 'Morning';
  if (envelope?.slot === 'morning') return 'Morning';
  if (envelope?.slot === 'evening') return 'Evening';
  return getDefaultTimeLabel(fallbackIndex);
}

export function getLegacyDayEnvelopes(day) {
  return ['prologue', 'morning', 'evening']
    .map((slot) => day?.[slot])
    .filter(Boolean);
}

export function getDayEnvelopes(day) {
  const explicitEnvelopes = Array.isArray(day?.envelopes) ? day.envelopes.filter(Boolean) : [];
  const legacyEnvelopes = getLegacyDayEnvelopes(day);
  if (!explicitEnvelopes.length) return legacyEnvelopes;

  const explicitKeys = new Set(
    explicitEnvelopes.map((envelope) => envelope.id || envelope.slot || '').filter(Boolean),
  );

  const missingLegacyEnvelopes = legacyEnvelopes.filter((envelope) => {
    const key = envelope.id || envelope.slot || '';
    return !key || !explicitKeys.has(key);
  });

  return [...missingLegacyEnvelopes, ...explicitEnvelopes];
}

export function getStoryDayId(day, dayIndex) {
  return day?.id || `day-${dayIndex + 1}`;
}

export function isBranchOnlyEnvelope(day, envelope) {
  return !!(day?.branchOnly || envelope?.branchOnly);
}

export function flattenStoryEnvelopes(daysOrContent) {
  const days = Array.isArray(daysOrContent)
    ? daysOrContent
    : Array.isArray(daysOrContent?.days)
    ? daysOrContent.days
    : [];
  const items = [];

  days.forEach((day, dayIndex) => {
    getDayEnvelopes(day).forEach((envelope, envelopeIndex) => {
      if (!envelope) return;

      items.push({
        index: items.length,
        dayIndex,
        envelopeIndex,
        day,
        dayId: getStoryDayId(day, dayIndex),
        slot: envelope.slot || `slot-${envelopeIndex + 1}`,
        envelope,
        envelopeId: envelope.id,
        branchOnly: isBranchOnlyEnvelope(day, envelope),
        branchGroup: envelope.branchGroup || '',
      });
    });
  });

  return items;
}

function normalizeEnvelope(
  envelope,
  dayNumber,
  envelopeIndex,
  inheritedBranchOnly = false,
  branchGroup = '',
) {
  const next = deepClone(envelope || {});
  next.slot = next.slot || `slot-${envelopeIndex + 1}`;
  next.timeLabel = inferLegacyTimeLabel(next, envelopeIndex);
  next.label = next.label || `Day ${dayNumber} · ${next.timeLabel}`;
  next.sealMotif = next.sealMotif || String(dayNumber);
  next.scheduledAt = next.scheduledAt || null;
  next.notify = next.notify === false ? false : !!next.scheduledAt;
  next.reminderAt = next.reminderAt || null;
  next.reminderIntervalMinutes = next.reminderIntervalMinutes || null;
  next.reminderMaxCount = next.reminderMaxCount ?? 0;
  next.reminderTitle = next.reminderTitle || null;
  next.reminderBody = next.reminderBody || null;
  next.branchOnly = !!(next.branchOnly || inheritedBranchOnly);
  if (branchGroup) next.branchGroup = branchGroup;
  next.choices = Array.isArray(next.choices)
    ? next.choices.map((choice, choiceIndex) => normalizeChoice(choice, choiceIndex))
    : [];
  return next;
}

function normalizeRevealItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `reveal-item-${index + 1}`,
          title: item,
          description: '',
        };
      }

      const next = deepClone(item || {});
      return {
        id: next.id || `reveal-item-${index + 1}`,
        title: next.title || '',
        description: next.description || '',
      };
    })
    .filter((item) => item.title || item.description);
}

function normalizeChoiceCard(card) {
  const next = deepClone(card || {});
  return {
    ...next,
    heading: next.heading || '',
    body: next.body || '',
    rule: next.rule || '',
    inputs: Array.isArray(next.inputs) ? next.inputs : [],
    revealItems: normalizeRevealItems(next.revealItems),
  };
}

function normalizeChoice(choice, choiceIndex) {
  const next = deepClone(choice || {});
  return {
    ...next,
    id: next.id || `choice-${choiceIndex + 1}`,
    title: next.title || '',
    hint: next.hint || '',
    card: normalizeChoiceCard(next.card),
  };
}

function normalizeDayPrelude(day, dayNumber) {
  const next = deepClone(day?.dayPrelude || {});
  return {
    enabled: !!next.enabled,
    kicker: next.kicker || `Day ${toRoman(dayNumber)}`,
    heading: next.heading || `Before Day ${dayNumber} Begins`,
    body:
      next.body ||
      'A brief, beautiful lead-in for this day. Use it to set mood, location, or emotional tension before the first envelope opens.',
    buttonLabel: next.buttonLabel || 'Begin the day',
  };
}

export function normalizeContentModel(source) {
  const content = deepClone(source || {}) || {};
  const incomingDays = Array.isArray(content.days) ? content.days : [];
  const baseDays = incomingDays.slice(0, 5).map((day, index) => ({
    ...day,
    day: index + 1,
    dayPrelude: normalizeDayPrelude(day, index + 1),
    envelopes: getDayEnvelopes(day).map((envelope, envelopeIndex) =>
      normalizeEnvelope(envelope, index + 1, envelopeIndex, !!day?.branchOnly),
    ),
  }));

  const dayFive = baseDays[4];
  const overflowDays = incomingDays.slice(5);

  if (dayFive && overflowDays.length) {
    overflowDays.forEach((day) => {
      getDayEnvelopes(day).forEach((envelope) => {
        dayFive.envelopes.push(
          normalizeEnvelope(
            envelope,
            5,
            dayFive.envelopes.length,
            !!day?.branchOnly,
            day?.id || '',
          ),
        );
      });
    });
  }

  content.days = baseDays;
  return content;
}

function normalizeFlowMap(data) {
  if (data && Array.isArray(data.rules)) {
    return { rules: data.rules };
  }

  if (data && typeof data === 'object') {
    const rules = [];

    Object.entries(data).forEach(([sourceChoiceId, targetIds]) => {
      if (!Array.isArray(targetIds)) return;

      targetIds.forEach((targetEnvelopeId, index) => {
        rules.push({
          id: `legacy-${sourceChoiceId}-${targetEnvelopeId}-${index}`,
          sourceChoiceId,
          sourceFieldId: '',
          operator: 'always',
          value: '',
          targetEnvelopeId,
        });
      });
    });

    return { rules };
  }

  return { rules: [] };
}

export function buildCompleteFlowMap(content, rawFlowMap) {
  const normalizedContent = normalizeContentModel(content);
  const explicit = normalizeFlowMap(rawFlowMap);
  const explicitRules = Array.isArray(explicit.rules) ? explicit.rules : [];
  const items = flattenStoryEnvelopes(normalizedContent.days);

  const generatedRules = [];

  items.forEach((item, itemIndex) => {
    const choices = Array.isArray(item.envelope?.choices) ? item.envelope.choices : [];
    if (!choices.length) return;

    let nextTarget = null;

    if (item.branchGroup) {
      nextTarget =
        items.slice(itemIndex + 1).find((candidate) => candidate.branchGroup === item.branchGroup) ||
        null;
    } else {
      nextTarget =
        items.slice(itemIndex + 1).find((candidate) => !candidate.branchOnly) || null;
    }

    if (!nextTarget?.envelope?.id) return;

    choices.forEach((choice) => {
      const hasDefaultRoute = explicitRules.some(
        (rule) => rule.sourceChoiceId === choice.id && rule.operator === 'always',
      );

      if (hasDefaultRoute) return;

      generatedRules.push({
        id: `generated-${choice.id}-${nextTarget.envelope.id}`,
        sourceChoiceId: choice.id,
        sourceFieldId: '',
        operator: 'always',
        value: '',
        targetEnvelopeId: nextTarget.envelope.id,
        generated: true,
      });
    });
  });

  return { rules: [...explicitRules, ...generatedRules] };
}
