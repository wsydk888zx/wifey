import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateStoryExport } from '../packages/story-core/src/index.js';

const root = resolve(new URL('..', import.meta.url).pathname);
const defaultJsonConfigCandidates = [
  'config_importable_2026-04-23_revised.json',
  'yours-watching-config.json',
  'Backup Scripts/config_importable_2026-04-23_revised.json',
  'Backup Scripts/yours-watching-config.json',
];

async function resolveExistingDefaultJsonConfigs() {
  const existing = [];

  for (const candidate of defaultJsonConfigCandidates) {
    try {
      await access(resolve(root, candidate));
      existing.push(candidate);
    } catch {
      // Keep going; the validator should work even if old backup files moved.
    }
  }

  return existing;
}

async function loadContentJs() {
  const dataFilePath = resolve(root, 'packages/story-content/src/storyData.js');
  const moduleUrl = `${pathToFileURL(dataFilePath).href}?t=${Date.now()}`;
  const module = await import(moduleUrl);
  const content = module.storyContent || module.default;

  if (!content || typeof content !== 'object') {
    throw new Error('storyData.js did not export story content.');
  }

  return {
    label: 'package story data',
    source: {
      content,
      flowMap: content.defaultFlowMap || { rules: [] },
    },
  };
}

async function loadJsonConfig(fileArg) {
  const filePath = resolve(root, fileArg);
  const raw = await readFile(filePath, 'utf8');

  return {
    label: fileArg,
    source: JSON.parse(raw),
  };
}

const fileArgs = process.argv.slice(2);
const jsonConfigTargets = fileArgs.length ? fileArgs : await resolveExistingDefaultJsonConfigs();
const targets = [await loadContentJs()];

for (const fileArg of jsonConfigTargets) {
  targets.push(await loadJsonConfig(fileArg));
}

targets.forEach(({ label, source }) => {
  const result = validateStoryExport(source);

  if (result.warnings.length) {
    console.warn(`${label}: validation warnings:`);
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (result.errors.length) {
    console.error(`${label}: validation failed:`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  const { days, envelopes, choices, flowRules } = result.stats;
  console.log(
    `${label}: validation passed: ${days} days, ${envelopes} envelopes, ${choices} choices, ${flowRules} flow rules.`,
  );
});
