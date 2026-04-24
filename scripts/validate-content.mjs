import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

import {
  buildCompleteFlowMap,
  getDayEnvelopes,
  normalizeContentModel,
} from '../packages/story-core/src/contentModel.js';

const root = resolve(new URL('..', import.meta.url).pathname);

function fail(message, location = '') {
  return location ? `${location}: ${message}` : message;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function loadContentJs() {
  const filePath = resolve(root, 'content.js');
  const raw = await readFile(filePath, 'utf8');
  const sandbox = {
    window: {},
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(raw, sandbox, { filename: filePath });

  const content = sandbox.window.GAME_CONTENT;
  if (!content || typeof content !== 'object') {
    throw new Error('content.js did not define window.GAME_CONTENT.');
  }

  return {
    content,
    defaultFlowMap: sandbox.window.DEFAULT_FLOW_MAP || content.defaultFlowMap || { rules: [] },
  };
}

function validateContent(content, flowMap) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeContentModel(content);
  const days = Array.isArray(normalized.days) ? normalized.days : [];

  if (!days.length) {
    errors.push(fail('Expected at least one day.', 'content.days'));
  }

  if (!Array.isArray(content.prologue?.lines) || content.prologue.lines.length === 0) {
    errors.push(fail('Expected prologue.lines to contain at least one line.', 'content.prologue'));
  }

  const envelopeIds = new Map();
  const choiceIds = new Map();
  const choiceInputs = new Map();
  let envelopeCount = 0;
  let choiceCount = 0;

  days.forEach((day, dayIndex) => {
    const dayLocation = `content.days[${dayIndex}]`;
    const envelopes = getDayEnvelopes(day);

    if (!envelopes.length) {
      errors.push(fail('Expected at least one envelope.', dayLocation));
    }

    envelopes.forEach((envelope, envelopeIndex) => {
      envelopeCount += 1;
      const envelopeLocation = `${dayLocation}.envelopes[${envelopeIndex}]`;

      if (!isNonEmptyString(envelope.id)) {
        errors.push(fail('Envelope id is required.', envelopeLocation));
      } else if (envelopeIds.has(envelope.id)) {
        errors.push(fail(`Duplicate envelope id "${envelope.id}".`, envelopeLocation));
      } else {
        envelopeIds.set(envelope.id, envelopeLocation);
      }

      if (!Array.isArray(envelope.choices) || envelope.choices.length === 0) {
        errors.push(fail('Expected at least one choice.', envelopeLocation));
        return;
      }

      envelope.choices.forEach((choice, choiceIndex) => {
        choiceCount += 1;
        const choiceLocation = `${envelopeLocation}.choices[${choiceIndex}]`;

        if (!isNonEmptyString(choice.id)) {
          errors.push(fail('Choice id is required.', choiceLocation));
        } else if (choiceIds.has(choice.id)) {
          errors.push(fail(`Duplicate choice id "${choice.id}".`, choiceLocation));
        } else {
          choiceIds.set(choice.id, choiceLocation);
        }

        if (!isNonEmptyString(choice.title)) {
          warnings.push(fail('Choice title is empty.', choiceLocation));
        }

        if (!choice.card || typeof choice.card !== 'object') {
          errors.push(fail('Choice card is required.', choiceLocation));
          return;
        }

        ['heading', 'body', 'rule'].forEach((field) => {
          if (!isNonEmptyString(choice.card[field])) {
            errors.push(fail(`Choice card ${field} is required.`, choiceLocation));
          }
        });

        const inputIds = new Set();
        if (Array.isArray(choice.card.inputs)) {
          choice.card.inputs.forEach((input, inputIndex) => {
            const inputLocation = `${choiceLocation}.card.inputs[${inputIndex}]`;
            if (!isNonEmptyString(input.id)) {
              errors.push(fail('Input id is required.', inputLocation));
              return;
            }
            if (inputIds.has(input.id)) {
              errors.push(fail(`Duplicate input id "${input.id}" on choice "${choice.id}".`, inputLocation));
            }
            inputIds.add(input.id);
          });
        }
        if (isNonEmptyString(choice.id)) choiceInputs.set(choice.id, inputIds);
      });
    });
  });

  const completeFlowMap = buildCompleteFlowMap(normalized, flowMap);
  const rules = Array.isArray(completeFlowMap.rules) ? completeFlowMap.rules : [];
  const ruleIds = new Set();
  const operators = new Set(['always', 'is_filled', 'equals', 'contains']);

  rules.forEach((rule, ruleIndex) => {
    const ruleLocation = `flowMap.rules[${ruleIndex}]`;

    if (!isNonEmptyString(rule.id)) {
      errors.push(fail('Flow rule id is required.', ruleLocation));
    } else if (ruleIds.has(rule.id)) {
      errors.push(fail(`Duplicate flow rule id "${rule.id}".`, ruleLocation));
    } else {
      ruleIds.add(rule.id);
    }

    if (!choiceIds.has(rule.sourceChoiceId)) {
      errors.push(fail(`Unknown sourceChoiceId "${rule.sourceChoiceId}".`, ruleLocation));
    }

    if (!envelopeIds.has(rule.targetEnvelopeId)) {
      errors.push(fail(`Unknown targetEnvelopeId "${rule.targetEnvelopeId}".`, ruleLocation));
    }

    if (!operators.has(rule.operator)) {
      errors.push(fail(`Unsupported operator "${rule.operator}".`, ruleLocation));
    }

    if (rule.operator !== 'always' && !isNonEmptyString(rule.sourceFieldId)) {
      errors.push(fail('Conditional flow rules require sourceFieldId.', ruleLocation));
    }

    if (isNonEmptyString(rule.sourceFieldId)) {
      const inputIds = choiceInputs.get(rule.sourceChoiceId);
      if (inputIds && !inputIds.has(rule.sourceFieldId)) {
        errors.push(fail(`Unknown sourceFieldId "${rule.sourceFieldId}" for choice "${rule.sourceChoiceId}".`, ruleLocation));
      }
    }
  });

  return {
    errors,
    warnings,
    stats: {
      days: days.length,
      envelopes: envelopeCount,
      choices: choiceCount,
      flowRules: rules.length,
    },
  };
}

const { content, defaultFlowMap } = await loadContentJs();
const result = validateContent(content, defaultFlowMap);

if (result.warnings.length) {
  console.warn('Content validation warnings:');
  result.warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (result.errors.length) {
  console.error('Content validation failed:');
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  const { days, envelopes, choices, flowRules } = result.stats;
  console.log(`Content validation passed: ${days} days, ${envelopes} envelopes, ${choices} choices, ${flowRules} flow rules.`);
}
