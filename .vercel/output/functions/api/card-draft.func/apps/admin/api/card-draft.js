import Anthropic from '@anthropic-ai/sdk';

const model = process.env.ADMIN_AI_MODEL || 'claude-haiku-4-5';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY.' });
    return;
  }

  const payload = req.body || {};
  const client = new Anthropic({ apiKey });

  const cardRequest = {
    dayTheme: payload.dayTheme || '',
    envelopeLabel: payload.envelopeLabel || '',
    envelopeIntro: payload.envelopeIntro || '',
    choice: {
      title: payload.choice?.title || '',
      hint: payload.choice?.hint || '',
      heading: payload.choice?.heading || '',
      body: payload.choice?.body || '',
      rule: payload.choice?.rule || '',
    },
    draftGoal: payload.draftGoal || 'rewrite',
    tone: payload.tone || 'romantic',
    intensity: Number(payload.intensity || 5),
    boundaries: payload.boundaries || '',
    notes: payload.notes || '',
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
    res.status(502).json({ error: `Claude request failed: ${error.message}` });
    return;
  }

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse?.input) {
    res.status(502).json({ error: 'Claude returned no draft.' });
    return;
  }

  res.status(200).json({
    draft: toolUse.input,
    model: response.model || model,
    responseId: response.id || null,
  });
}
