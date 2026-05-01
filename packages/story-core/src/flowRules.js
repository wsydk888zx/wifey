export const FLOW_OPERATOR_OPTIONS = [
  {
    value: 'always',
    label: 'Always',
    description: 'Route immediately after this choice.',
  },
  {
    value: 'is_filled',
    label: 'Response is filled',
    description: 'Route when a response field has any answer.',
  },
  {
    value: 'equals',
    label: 'Response equals',
    description: 'Route when a response field matches an exact value.',
  },
  {
    value: 'contains',
    label: 'Response contains',
    description: 'Route when a response field contains a value.',
  },
];

export const FLOW_OPERATORS = FLOW_OPERATOR_OPTIONS.map((option) => option.value);

export function getFlowOperatorLabel(value) {
  return FLOW_OPERATOR_OPTIONS.find((option) => option.value === value)?.label || value || 'Always';
}

export function normalizeFlowResponseValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') return value.trim();
  return '';
}

export function matchesFlowRule(rule, responses = {}) {
  const operator = rule?.operator || 'always';
  const normalized = normalizeFlowResponseValue(responses?.[rule?.sourceFieldId]);
  const expected = String(rule?.value || '').trim();

  if (operator === 'always') return true;

  if (operator === 'is_filled') {
    return Array.isArray(normalized) ? normalized.length > 0 : !!normalized;
  }

  if (operator === 'equals') {
    if (Array.isArray(normalized)) return normalized.includes(expected);
    return normalized === expected;
  }

  if (operator === 'contains') {
    if (Array.isArray(normalized)) {
      const expectedLower = expected.toLowerCase();
      return normalized.some((item) => item.toLowerCase().includes(expectedLower));
    }

    return !!normalized && normalized.toLowerCase().includes(expected.toLowerCase());
  }

  return false;
}
