export const INPUT_TYPE_OPTIONS = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'single_select', label: 'Single Select' },
  { value: 'multi_select', label: 'Multiple Select' },
];

export function normalizeInputType(type) {
  if (type === 'text') return 'short_text';
  if (type === 'textarea') return 'long_text';
  if (type === 'select') return 'single_select';
  if (type === 'multiselect') return 'multi_select';
  return type || 'short_text';
}

export function isSelectInputType(type) {
  const normalized = normalizeInputType(type);
  return normalized === 'single_select' || normalized === 'multi_select';
}

export function getInputTypeLabel(type) {
  const normalized = normalizeInputType(type);
  return INPUT_TYPE_OPTIONS.find((option) => option.value === normalized)?.label || 'Short Text';
}
