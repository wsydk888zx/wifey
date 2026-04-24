const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);

function readEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) process.env[key] = value;
    });
  } catch {}
}

readEnvFile(path.join(ROOT, '.env.local'));
readEnvFile(path.join(ROOT, '.env'));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleCardDraft(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, {
      error: 'Missing ANTHROPIC_API_KEY. Add it to .env.local and restart the server.',
    });
    return;
  }

  let payload;
  try {
    const raw = await readRequestBody(req);
    payload = JSON.parse(raw || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
    return;
  }

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

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: JSON.stringify(cardRequest, null, 2) }],
      tools: [{
        name: 'submit_card_draft',
        description: 'Submit the completed card draft with all required fields.',
        input_schema: schema,
      }],
      tool_choice: { type: 'tool', name: 'submit_card_draft' },
    });
  } catch (error) {
    sendJson(res, 502, { error: `Claude request failed: ${error.message}` });
    return;
  }

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse?.input) {
    sendJson(res, 502, { error: 'Claude returned no draft.' });
    return;
  }

  sendJson(res, 200, {
    draft: toolUse.input,
    model: response.model || 'claude-haiku-4-5',
    responseId: response.id || null,
  });
}

async function handleEnvelopeDraft(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'Missing ANTHROPIC_API_KEY. Add it to .env.local and restart the server.' });
    return;
  }

  let payload;
  try {
    const raw = await readRequestBody(req);
    payload = JSON.parse(raw || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
    return;
  }

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
    'The intro is narrative text that arrives with the sealed envelope — it sets the scene before any choices appear.',
    'The choicesHeading is a short evocative title (3-7 words) shown above the path options.',
    'The choicesIntro is 1-2 sentences that frame the decision for the reader without giving away the choices.',
    'Keep all three consistent in tone and distinct in purpose.',
    'Respect stated boundaries and notes. Return only valid JSON matching the schema.',
  ].join(' ');

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system,
      messages: [{
        role: 'user',
        content: JSON.stringify({
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
        }, null, 2),
      }],
      tools: [{
        name: 'submit_envelope_draft',
        description: 'Submit the completed envelope draft with all required fields.',
        input_schema: schema,
      }],
      tool_choice: { type: 'tool', name: 'submit_envelope_draft' },
    });
  } catch (error) {
    sendJson(res, 502, { error: `Claude request failed: ${error.message}` });
    return;
  }

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse?.input) {
    sendJson(res, 502, { error: 'Claude returned no draft.' });
    return;
  }

  sendJson(res, 200, { draft: toolUse.input, model: response.model || 'claude-haiku-4-5' });
}

function serveFile(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(ROOT, pathname);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/card-draft') {
    handleCardDraft(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/envelope-draft') {
    handleEnvelopeDraft(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  serveFile(req, res);
});

server.listen(PORT, () => {
  console.log(`Preview server running at http://localhost:${PORT}`);
});
