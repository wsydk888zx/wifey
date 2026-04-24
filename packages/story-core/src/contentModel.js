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
  if (Array.isArray(day?.envelopes)) return day.envelopes;
  return getLegacyDayEnvelopes(day);
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
  next.branchOnly = !!(next.branchOnly || inheritedBranchOnly);
  if (branchGroup) next.branchGroup = branchGroup;
  next.choices = Array.isArray(next.choices) ? next.choices : [];
  return next;
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
  const items = [];

  normalizedContent.days.forEach((day, dayIndex) => {
    getDayEnvelopes(day).forEach((envelope, envelopeIndex) => {
      items.push({
        dayIndex,
        envelopeIndex,
        day,
        envelope,
        dayId: day.id || `day-${dayIndex + 1}`,
        branchOnly: !!(day?.branchOnly || envelope?.branchOnly),
        branchGroup: envelope?.branchGroup || '',
      });
    });
  });

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
