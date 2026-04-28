import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { validateStoryExport } from '../packages/story-core/src/index.js';

const root = resolve(new URL('..', import.meta.url).pathname);
const defaultJsonConfigs = [
  'config_importable_2026-04-23_revised.json',
  'yours-watching-config.json',
];

async function loadContentJs() {
  const dataFilePath = resolve(root, 'packages/story-content/src/storyData.js');
  const adapterFilePath = resolve(root, 'content.js');
  const dataRaw = await readFile(dataFilePath, 'utf8');
  const adapterRaw = await readFile(adapterFilePath, 'utf8');
  const sandbox = {
    window: {},
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(dataRaw, sandbox, { filename: dataFilePath });
  vm.runInContext(adapterRaw, sandbox, { filename: adapterFilePath });

  const content = sandbox.window.GAME_CONTENT;
  if (!content || typeof content !== 'object') {
    throw new Error('content.js did not define window.GAME_CONTENT.');
  }

  return {
    label: 'package story data + content.js adapter',
    source: {
      content,
      flowMap: sandbox.window.DEFAULT_FLOW_MAP || content.defaultFlowMap || { rules: [] },
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
const jsonConfigTargets = fileArgs.length ? fileArgs : defaultJsonConfigs;
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
