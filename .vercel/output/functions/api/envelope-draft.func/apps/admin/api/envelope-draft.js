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
