import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_AI_INTENSITY,
  normalizeContentModel,
  validateStoryExport,
} from '@wifey/story-core';

const serverDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(serverDir, '../../..');
const adminRoot = resolve(serverDir, '..');
const port = Number(process.env.PORT || 8787);
const model = process.env.ADMIN_AI_MODEL || 'claude-haiku-4-5';
const storyDataPath = resolve(repoRoot, 'packages/story-content/src/storyData.js');

// In-memory response store — keyed by `${envelopeId}::${choiceId}`
const responseStore = new Map();

function readEnvFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const eq = trimmed.indexOf('=');
      if (eq === -1) return;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && !process.env[key]) process.env[key] = value;
    });
  } catch {
    // Local env files are optional.
  }
}

readEnvFile(join(repoRoot, '.env.local'));
readEnvFile(join(repoRoot, '.env'));
readEnvFile(join(adminRoot, '.env.local'));
readEnvFile(join(adminRoot, '.env'));

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ADMIN_AI_ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function normalizeIntensity(value) {
  const intensity = Number(value);
  if (!Number.isFinite(intensity)) return DEFAULT_AI_INTENSITY;
  return Math.min(10, Math.max(1, Math.round(intensity)));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    ...corsHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolveBody(body));
    req.on('error', reject);
  });
}

async function readJsonPayload(req, res) {
  try {
    const raw = await readRequestBody(req);
    return JSON.parse(raw || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
    return null;
  }
}

function createAnthropicClient(res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, {
      error: 'Missing ANTHROPIC_API_KEY. Add it to .env.local and restart the admin AI server.',
    });
    return null;
  }

  return new Anthropic({ apiKey });
}

function extractToolDraft(response, res) {
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse?.input) {
    sendJson(res, 502, { error: 'Claude returned no draft.' });
    return null;
  }

  return toolUse.input;
}

async function handleCardDraft(req, res) {
  const client = createAnthropicClient(res);
  if (!client) return;

  const payload = await readJsonPayload(req, res);
  if (!payload) return;

  const cardRequest = {
    dayTheme: payload?.dayTheme || '',
    envelopeLabel: payload?.envelopeLabel || '',
    envelopeIntro: payload?.envelopeIntro || '',
    choice: {
      title: payload?.choice?.title || '',
      hint: payload?.choice?.hint || '',
      heading: payload?.choice?.heading || '',
      body: payload?.choice?.body || '',
      rule: payload?.choice?.rule || '',
    },
    draftGoal: payload?.draftGoal || 'rewrite',
    tone: payload?.tone || 'romantic',
    intensity: Number(payload?.intensity || 5),
    boundaries: payload?.boundaries || '',
    notes: payload?.notes || '',
  };

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      hint: { type: 'string' },
      heading: { type: 'string' },
      body: { type: 'string' },
      rule: { type: 'string' },
      rationale: { type: 'string' },
    },
    required: ['title', 'hint', 'heading', 'body', 'rule', 'rationale'],
  };

  const system = [
    'You rewrite story cards for an admin authoring tool.',
    'Return only valid JSON matching the schema.',
    'Treat the provided card text as the source material to improve, not as something to ignore.',
    'Make the rewrite materially different when the requested draft goal asks for it.',
    'Keep title concise, hint brief, heading evocative, body readable, and rule specific.',
    'Respect stated boundaries and notes.',
    'Do not add branching logic, timing changes, or metadata.',
  ].join(' ');

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: JSON.stringify(cardRequest, null, 2) }],
      tools: [
        {
          name: 'submit_card_draft',
          description: 'Submit the completed card draft with all required fields.',
          input_schema: schema,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_card_draft' },
    });
  } catch (error) {
    sendJson(res, 502, { error: `Claude request failed: ${error.message}` });
    return;
  }

  const draft = extractToolDraft(response, res);
  if (!draft) return;

  sendJson(res, 200, {
    draft,
    model: response.model || model,
    responseId: response.id || null,
  });
}

async function handleEnvelopeDraft(req, res) {
  const client = createAnthropicClient(res);
  if (!client) return;

  const payload = await readJsonPayload(req, res);
  if (!payload) return;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      intro: { type: 'string' },
      choicesHeading: { type: 'string' },
      choicesIntro: { type: 'string' },
      rationale: { type: 'string' },
    },
    required: ['intro', 'choicesHeading', 'choicesIntro', 'rationale'],
  };

  const system = [
    'You write envelope content for an interactive intimate story admin tool.',
    'The intro is narrative text that arrives with the sealed envelope; it sets the scene before any choices appear.',
    'The choicesHeading is a short evocative title shown above the path options.',
    'The choicesIntro is 1-2 sentences that frame the decision for the reader without giving away the choices.',
    'Keep all three consistent in tone and distinct in purpose.',
    'Respect stated boundaries and notes. Return only valid JSON matching the schema.',
  ].join(' ');

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(
            {
              dayTheme: payload.dayTheme || '',
              envelopeLabel: payload.envelopeLabel || '',
              currentIntro: payload.intro || '',
              currentChoicesHeading: payload.choicesHeading || '',
              currentChoicesIntro: payload.choicesIntro || '',
              tone: payload.tone || 'romantic',
              intensity: Number(payload.intensity || 5),
              draftGoal: payload.draftGoal || 'rewrite',
              notes: payload.notes || '',
              boundaries: payload.boundaries || '',
            },
            null,
            2,
          ),
        },
      ],
      tools: [
        {
          name: 'submit_envelope_draft',
          description: 'Submit the completed envelope draft with all required fields.',
          input_schema: schema,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_envelope_draft' },
    });
  } catch (error) {
    sendJson(res, 502, { error: `Claude request failed: ${error.message}` });
    return;
  }

  const draft = extractToolDraft(response, res);
  if (!draft) return;

  sendJson(res, 200, {
    draft,
    model: response.model || model,
    responseId: response.id || null,
  });
}

function handleGetResponses(req, res) {
  const result = {};
  for (const [key, fields] of responseStore.entries()) {
    result[key] = fields;
  }
  sendJson(res, 200, { responses: result });
}

async function handlePostResponses(req, res) {
  const payload = await readJsonPayload(req, res);
  if (!payload) return;

  const { envelopeId, choiceId, responses } = payload;
  if (!envelopeId || !choiceId || typeof responses !== 'object') {
    sendJson(res, 400, { error: 'Missing envelopeId, choiceId, or responses.' });
    return;
  }

  const key = `${envelopeId}::${choiceId}`;
  responseStore.set(key, responses);
  sendJson(res, 200, { ok: true });
}

async function handleSaveContent(req, res) {
  const payload = await readJsonPayload(req, res);
  if (!payload) return;

  const content = normalizeContentModel(payload.content || {});
  const flowMap =
    payload.flowMap && typeof payload.flowMap === 'object' ? payload.flowMap : { rules: [] };

  const validation = validateStoryExport({ content, flowMap });
  if (validation.errors.length) {
    sendJson(res, 400, { error: `Save blocked: ${validation.errors[0]}` });
    return;
  }

  const savedAt = new Date().toISOString();
  const contentWithFlow = { ...content, defaultFlowMap: flowMap };
  const body = [
    '// Yours, Watching — Complete Five-Day Narrative',
    `// Last saved by admin: ${savedAt}`,
    '',
    `export const storyContent = ${JSON.stringify(contentWithFlow, null, 2)};`,
    '',
    '// Assign to global scope for defaultContent.js to pick up',
    'if (typeof globalThis !== \'undefined\') {',
    '  globalThis.WIFEY_STORY_CONTENT = storyContent;',
    '}',
    '',
    'export default storyContent;',
    '',
  ].join('\n');

  writeFileSync(storyDataPath, body, 'utf8');
  sendJson(res, 200, { ok: true, savedAt });
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'admin-ai', model });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/responses') {
    handleGetResponses(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/responses') {
    handlePostResponses(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/save-content') {
    handleSaveContent(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/card-draft') {
    handleCardDraft(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/envelope-draft') {
    handleEnvelopeDraft(req, res);
    return;
  }

  sendJson(res, 404, {
    error: 'Not found.',
    routes: ['/health', '/api/responses', '/api/save-content', '/api/card-draft', '/api/envelope-draft'],
  });
});

server.listen(port, () => {
  console.log(`Admin AI server running at http://localhost:${port}`);
});
