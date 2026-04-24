import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCompleteFlowMap,
  getDayEnvelopes,
  normalizeContentModel,
} from '../src/contentModel.js';
import { replacePlaceholders } from '../src/placeholders.js';

test('replacePlaceholders handles supported name tokens', () => {
  const result = replacePlaceholders(
    '{{HerName}} trusts {{hisName}}. {her} answers {His}.',
    { herName: 'MIRA', hisName: 'JON' },
  );

  assert.equal(result, 'Mira trusts jon. mira answers Jon.');
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
