import { buildCompleteFlowMap, getDayEnvelopes, normalizeContentModel } from './contentModel.js';
import { FLOW_OPERATORS } from './flowRules.js';

function fail(message, location = '') {
  return location ? `${location}: ${message}` : message;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getContentValidationTarget(source, fallbackFlowMap) {
  const content =
    source?.content && typeof source.content === 'object'
      ? source.content
      : source;

  return {
    content,
    flowMap:
      source?.flowMap ||
      fallbackFlowMap ||
      content?.defaultFlowMap ||
      { rules: [] },
  };
}

export function validateStoryContent(content, flowMap) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeContentModel(content);
  const days = Array.isArray(normalized.days) ? normalized.days : [];

  if (!days.length) {
    errors.push(fail('Expected at least one day.', 'content.days'));
  }

  const prologueLines = Array.isArray(content?.prologue?.lines) ? content.prologue.lines : [];
  if (!prologueLines.some(isNonEmptyString)) {
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

      if (envelope.scheduledAt) {
        try {
          const date = new Date(envelope.scheduledAt);
          if (isNaN(date.getTime())) {
            errors.push(fail(`Invalid scheduledAt format: "${envelope.scheduledAt}". Expected ISO-8601.`, envelopeLocation));
          }
        } catch (e) {
          errors.push(fail(`scheduledAt parse error: ${e.message}`, envelopeLocation));
        }
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

        if (Object.hasOwn(choice.card, 'realText')) {
          errors.push(fail('Choice card realText is no longer supported.', choiceLocation));
        }

        const inputIds = new Set();
        if (Array.isArray(choice.card.inputs)) {
          choice.card.inputs.forEach((input, inputIndex) => {
            const inputLocation = `${choiceLocation}.card.inputs[${inputIndex}]`;
            if (!isNonEmptyString(input.id)) {
              errors.push(fail('Input id is required.', inputLocation));
              return;
            }

            if (inputIds.has(input.id)) {
              errors.push(
                fail(`Duplicate input id "${input.id}" on choice "${choice.id}".`, inputLocation),
              );
            }

            inputIds.add(input.id);
          });
        }

        const revealItemIds = new Set();
        if (Array.isArray(choice.card.revealItems)) {
          choice.card.revealItems.forEach((item, itemIndex) => {
            const itemLocation = `${choiceLocation}.card.revealItems[${itemIndex}]`;

            if (!isNonEmptyString(item?.id)) {
              errors.push(fail('Reveal item id is required.', itemLocation));
            } else if (revealItemIds.has(item.id)) {
              errors.push(
                fail(`Duplicate reveal item id "${item.id}" on choice "${choice.id}".`, itemLocation),
              );
            } else {
              revealItemIds.add(item.id);
            }

            if (!isNonEmptyString(item?.title)) {
              warnings.push(fail('Reveal item title is empty.', itemLocation));
            }
          });
        }

        if (isNonEmptyString(choice.id)) choiceInputs.set(choice.id, inputIds);
      });
    });
  });

  const completeFlowMap = buildCompleteFlowMap(normalized, flowMap);
  const rules = Array.isArray(completeFlowMap.rules) ? completeFlowMap.rules : [];
  const ruleIds = new Set();
  const operators = new Set(FLOW_OPERATORS);

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
        errors.push(
          fail(
            `Unknown sourceFieldId "${rule.sourceFieldId}" for choice "${rule.sourceChoiceId}".`,
            ruleLocation,
          ),
        );
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

export function validateStoryExport(source, fallbackFlowMap) {
  const { content, flowMap } = getContentValidationTarget(source, fallbackFlowMap);
  return validateStoryContent(content, flowMap);
}
