import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLACEHOLDER_TOKEN_OPTIONS,
  STORAGE_KEYS,
  buildCompleteFlowMap,
  flattenStoryEnvelopes,
  getFlowOperatorLabel,
  getDayEnvelopes,
  getStoryDayId,
  hasPlaceholderTokens,
  matchesFlowRule,
  normalizeInputType,
  normalizeContentModel,
  previewPlaceholders,
  replacePlaceholders,
  validateStoryContent,
  validateStoryExport,
  getEnvelopeNotificationSchedule,
} from '../src/index.js';

function makeTestChoice(id, inputs = []) {
  return {
    id,
    title: id,
    card: {
      heading: `${id} heading`,
      body: `${id} body`,
      rule: `${id} rule`,
      inputs,
    },
  };
}

function makeValidContent() {
  return {
    prologue: {
      lines: ['Begin.'],
    },
    days: [
      {
        envelopes: [
          {
            id: 'env-a',
            choices: [
              makeTestChoice('choice-a', [
                { id: 'mood', type: 'short_text', label: 'Mood' },
                { id: 'tags', type: 'multi_select', label: 'Tags' },
              ]),
            ],
          },
          {
            id: 'env-b',
            choices: [makeTestChoice('choice-b')],
          },
        ],
      },
    ],
  };
}

test('replacePlaceholders handles supported name tokens', () => {
  const result = replacePlaceholders(
    '{{HerName}} trusts {{hisName}}. {her} answers {His}.',
    { herName: 'MIRA', hisName: 'JON' },
  );

  assert.equal(result, 'Mira trusts jon. mira answers Jon.');
});

test('placeholder preview helpers expose supported token coverage', () => {
  assert.equal(PLACEHOLDER_TOKEN_OPTIONS.length, 8);
  assert.equal(hasPlaceholderTokens('No tokens here.'), false);
  assert.equal(hasPlaceholderTokens('For {{herName}} and {His}.'), true);
  assert.equal(
    previewPlaceholders('For {{HerName}} and {his}.', { herName: 'mira', hisName: 'JON' }),
    'For Mira and jon.',
  );
  assert.equal(previewPlaceholders('No tokens here.'), null);
});

test('shared storage keys include content and flow storage', () => {
  assert.equal(STORAGE_KEYS.content, 'yoursWatching:contentEdits:v2');
  assert.equal(STORAGE_KEYS.flow, 'yoursWatching:flowMap:v2');
});

test('normalizeContentModel converts legacy slots and folds overflow days into day five', () => {
  const content = {
    days: [
      { theme: 'One', morning: { id: 'd1m', choices: [] } },
      { theme: 'Two', morning: { id: 'd2m', choices: [] } },
      { theme: 'Three', morning: { id: 'd3m', choices: [] } },
      { theme: 'Four', morning: { id: 'd4m', choices: [] } },
      { theme: 'Five', morning: { id: 'd5m', choices: [] } },
      {
        id: 'branch-a',
        branchOnly: true,
        theme: 'Branch',
        morning: { id: 'branch-env', choices: [] },
      },
    ],
  };

  const normalized = normalizeContentModel(content);
  const dayFiveEnvelopes = getDayEnvelopes(normalized.days[4]);

  assert.equal(normalized.days.length, 5);
  assert.deepEqual(
    normalized.days.map((day) => day.day),
    [1, 2, 3, 4, 5],
  );
  assert.equal(dayFiveEnvelopes.at(-1).id, 'branch-env');
  assert.equal(dayFiveEnvelopes.at(-1).branchOnly, true);
  assert.equal(dayFiveEnvelopes.at(-1).branchGroup, 'branch-a');
});

test('normalizeContentModel preserves mixed legacy slots and envelope arrays', () => {
  const normalized = normalizeContentModel({
    days: [
      {
        prologue: { id: 'day-prologue', slot: 'prologue', choices: [makeTestChoice('choice-p')] },
        morning: { id: 'day-morning', slot: 'morning', choices: [makeTestChoice('choice-m')] },
        envelopes: [
          { id: 'day-morning', slot: 'morning', choices: [makeTestChoice('choice-m')] },
          { id: 'day-evening', slot: 'evening', choices: [makeTestChoice('choice-e')] },
        ],
      },
    ],
  });

  assert.deepEqual(
    getDayEnvelopes(normalized.days[0]).map((envelope) => envelope.id),
    ['day-prologue', 'day-morning', 'day-evening'],
  );
});

test('flattenStoryEnvelopes returns stable player routing metadata', () => {
  const normalized = normalizeContentModel({
    days: [
      {
        id: 'day-a',
        branchOnly: true,
        envelopes: [
          { id: 'env-a', branchGroup: 'branch-a', choices: [makeTestChoice('choice-a')] },
        ],
      },
    ],
  });

  const [item] = flattenStoryEnvelopes(normalized);

  assert.equal(getStoryDayId(normalized.days[0], 0), 'day-a');
  assert.equal(item.index, 0);
  assert.equal(item.dayId, 'day-a');
  assert.equal(item.envelopeId, 'env-a');
  assert.equal(item.branchOnly, true);
  assert.equal(item.branchGroup, 'branch-a');
  assert.equal(item.slot, 'slot-1');
});

test('buildCompleteFlowMap creates generated default routes', () => {
  const content = normalizeContentModel({
    days: [
      {
        envelopes: [
          {
            id: 'env-a',
            choices: [{ id: 'choice-a', title: 'A', card: { heading: 'A', body: 'A', rule: 'A' } }],
          },
          {
            id: 'env-b',
            choices: [{ id: 'choice-b', title: 'B', card: { heading: 'B', body: 'B', rule: 'B' } }],
          },
        ],
      },
    ],
  });

  const flow = buildCompleteFlowMap(content, { rules: [] });
  const generated = flow.rules.find((rule) => rule.sourceChoiceId === 'choice-a');

  assert.equal(generated?.generated, true);
  assert.equal(generated?.targetEnvelopeId, 'env-b');
});

test('buildCompleteFlowMap lets explicit always rules override generated defaults', () => {
  const content = normalizeContentModel({
    days: [
      {
        envelopes: [
          {
            id: 'env-a',
            choices: [{ id: 'choice-a', title: 'A', card: { heading: 'A', body: 'A', rule: 'A' } }],
          },
          {
            id: 'env-b',
            choices: [{ id: 'choice-b', title: 'B', card: { heading: 'B', body: 'B', rule: 'B' } }],
          },
          {
            id: 'env-c',
            branchOnly: true,
            choices: [{ id: 'choice-c', title: 'C', card: { heading: 'C', body: 'C', rule: 'C' } }],
          },
        ],
      },
    ],
  });

  const flow = buildCompleteFlowMap(content, {
    rules: [
      {
        id: 'explicit-a-c',
        sourceChoiceId: 'choice-a',
        sourceFieldId: '',
        operator: 'always',
        value: '',
        targetEnvelopeId: 'env-c',
      },
    ],
  });

  const rulesForChoice = flow.rules.filter((rule) => rule.sourceChoiceId === 'choice-a');

  assert.equal(rulesForChoice.length, 1);
  assert.equal(rulesForChoice[0].id, 'explicit-a-c');
  assert.equal(rulesForChoice[0].targetEnvelopeId, 'env-c');
});

test('matchesFlowRule handles conditional operators', () => {
  const responses = {
    mood: '  Ready now  ',
    tags: [' Silk ', '', 'Candlelight'],
    empty: '   ',
  };

  assert.equal(matchesFlowRule({ operator: 'always' }, responses), true);
  assert.equal(
    matchesFlowRule({ operator: 'is_filled', sourceFieldId: 'mood' }, responses),
    true,
  );
  assert.equal(
    matchesFlowRule({ operator: 'is_filled', sourceFieldId: 'empty' }, responses),
    false,
  );
  assert.equal(
    matchesFlowRule({ operator: 'equals', sourceFieldId: 'mood', value: 'Ready now' }, responses),
    true,
  );
  assert.equal(
    matchesFlowRule({ operator: 'equals', sourceFieldId: 'tags', value: 'Silk' }, responses),
    true,
  );
  assert.equal(
    matchesFlowRule({ operator: 'contains', sourceFieldId: 'mood', value: 'ready' }, responses),
    true,
  );
  assert.equal(
    matchesFlowRule({ operator: 'contains', sourceFieldId: 'tags', value: 'light' }, responses),
    true,
  );
});

test('getFlowOperatorLabel exposes editor labels for supported operators', () => {
  assert.equal(getFlowOperatorLabel('always'), 'Always');
  assert.equal(getFlowOperatorLabel('contains'), 'Response contains');
  assert.equal(getFlowOperatorLabel('custom'), 'custom');
});

test('normalizeInputType maps legacy field names', () => {
  assert.equal(normalizeInputType('text'), 'short_text');
  assert.equal(normalizeInputType('textarea'), 'long_text');
  assert.equal(normalizeInputType('select'), 'single_select');
  assert.equal(normalizeInputType('multiselect'), 'multi_select');
  assert.equal(normalizeInputType('multi_select'), 'multi_select');
  assert.equal(normalizeInputType(''), 'short_text');
});

test('validateStoryContent accepts conditional flow rules with known fields', () => {
  const content = makeValidContent();
  const result = validateStoryContent(content, {
    rules: [
      {
        id: 'route-ready',
        sourceChoiceId: 'choice-a',
        sourceFieldId: 'mood',
        operator: 'contains',
        value: 'ready',
        targetEnvelopeId: 'env-b',
      },
    ],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.stats.days, 1);
  assert.equal(result.stats.envelopes, 2);
  assert.equal(result.stats.choices, 2);
});

test('validateStoryContent requires a non-empty prologue line', () => {
  const content = makeValidContent();
  content.prologue.lines = [' ', ''];
  const result = validateStoryContent(content, { rules: [] });

  assert.match(result.errors.join('\n'), /Expected prologue\.lines/);
});

test('validateStoryContent reports malformed content and bad flow targets', () => {
  const result = validateStoryContent(
    {
      prologue: { lines: [] },
      days: [
        {
          envelopes: [
            {
              id: 'env-a',
              choices: [
                {
                  id: 'choice-a',
                  title: '',
                  card: { heading: '', body: 'Body', rule: '', inputs: [{ id: '' }] },
                },
              ],
            },
            {
              id: 'env-a',
              choices: [{ id: 'choice-a', title: 'Duplicate', card: null }],
            },
          ],
        },
      ],
    },
    {
      rules: [
        {
          id: 'bad-route',
          sourceChoiceId: 'choice-a',
          sourceFieldId: 'missing-input',
          operator: 'equals',
          value: 'yes',
          targetEnvelopeId: 'missing-env',
        },
        {
          id: 'bad-route',
          sourceChoiceId: 'missing-choice',
          sourceFieldId: '',
          operator: 'sometimes',
          value: '',
          targetEnvelopeId: 'env-a',
        },
      ],
    },
  );

  assert.match(result.errors.join('\n'), /Expected prologue\.lines/);
  assert.match(result.errors.join('\n'), /Duplicate envelope id "env-a"/);
  assert.match(result.errors.join('\n'), /Duplicate choice id "choice-a"/);
  assert.match(result.errors.join('\n'), /Choice card heading is required/);
  assert.match(result.errors.join('\n'), /Choice card rule is required/);
  assert.match(result.errors.join('\n'), /Input id is required/);
  assert.match(result.errors.join('\n'), /Unknown targetEnvelopeId "missing-env"/);
  assert.match(result.errors.join('\n'), /Unknown sourceFieldId "missing-input"/);
  assert.match(result.errors.join('\n'), /Duplicate flow rule id "bad-route"/);
  assert.match(result.errors.join('\n'), /Unsupported operator "sometimes"/);
});

test('validateStoryContent rejects deprecated realText card config', () => {
  const content = makeValidContent();
  content.days[0].envelopes[0].choices[0].card.realText = {
    enabled: true,
    message: 'Send this',
  };

  const result = validateStoryContent(content, { rules: [] });

  assert.match(result.errors.join('\n'), /realText is no longer supported/);
});

test('validateStoryExport accepts importable config wrapper shape', () => {
  const content = makeValidContent();
  const result = validateStoryExport({
    content,
    flowMap: {
      rules: [
        {
          id: 'route-filled',
          sourceChoiceId: 'choice-a',
          sourceFieldId: 'mood',
          operator: 'is_filled',
          value: '',
          targetEnvelopeId: 'env-b',
        },
      ],
    },
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.stats.flowRules, 2);
});

test('normalizeEnvelope preserves scheduledAt and sets notify defaults', () => {
  const isoTime = '2026-05-15T14:30:00Z';
  const content = {
    prologue: { lines: ['Begin.'] },
    days: [
      {
        envelopes: [
          {
            id: 'env-scheduled',
            scheduledAt: isoTime,
            choices: [makeTestChoice('choice-1')],
          },
        ],
      },
    ],
  };

  const normalized = normalizeContentModel(content);
  const envelope = normalized.days[0].envelopes[0];

  assert.equal(envelope.scheduledAt, isoTime);
  assert.equal(envelope.notify, true);
});

test('normalizeEnvelope defaults scheduledAt to null and notify to false when not set', () => {
  const content = {
    prologue: { lines: ['Begin.'] },
    days: [
      {
        envelopes: [
          {
            id: 'env-default',
            choices: [makeTestChoice('choice-1')],
          },
        ],
      },
    ],
  };

  const normalized = normalizeContentModel(content);
  const envelope = normalized.days[0].envelopes[0];

  assert.equal(envelope.scheduledAt, null);
  assert.equal(envelope.notify, false);
});

test('normalizeEnvelope respects explicit notify: false', () => {
  const isoTime = '2026-05-15T14:30:00Z';
  const content = {
    prologue: { lines: ['Begin.'] },
    days: [
      {
        envelopes: [
          {
            id: 'env-no-notify',
            scheduledAt: isoTime,
            notify: false,
            choices: [makeTestChoice('choice-1')],
          },
        ],
      },
    ],
  };

  const normalized = normalizeContentModel(content);
  const envelope = normalized.days[0].envelopes[0];

  assert.equal(envelope.scheduledAt, isoTime);
  assert.equal(envelope.notify, false);
});

test('validateStoryContent rejects invalid ISO-8601 scheduledAt format', () => {
  const content = {
    prologue: { lines: ['Begin.'] },
    days: [
      {
        envelopes: [
          {
            id: 'env-bad-date',
            scheduledAt: 'not-a-date',
            choices: [makeTestChoice('choice-1')],
          },
        ],
      },
    ],
  };

  const result = validateStoryContent(content, { rules: [] });

  assert.match(result.errors.join('\n'), /Invalid scheduledAt format/);
});

test('getEnvelopeNotificationSchedule returns scheduled envelopes with notify enabled', () => {
  const isoTime1 = '2026-05-15T14:30:00Z';
  const isoTime2 = '2026-05-16T09:00:00Z';
  const content = {
    prologue: { lines: ['Begin.'] },
    days: [
      {
        envelopes: [
          {
            id: 'env-notify-yes',
            label: 'Morning Message',
            intro: 'Good morning',
            scheduledAt: isoTime1,
            notify: true,
            choices: [makeTestChoice('choice-1')],
          },
          {
            id: 'env-notify-no',
            label: 'Evening Message',
            scheduledAt: isoTime2,
            notify: false,
            choices: [makeTestChoice('choice-2')],
          },
          {
            id: 'env-no-schedule',
            choices: [makeTestChoice('choice-3')],
          },
        ],
      },
    ],
  };

  const schedule = getEnvelopeNotificationSchedule(content);

  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].envelopeId, 'env-notify-yes');
  assert.equal(schedule[0].scheduledAt, isoTime1);
  assert.equal(schedule[0].title, 'Morning Message');
  assert.equal(schedule[0].body, 'Good morning');
});
