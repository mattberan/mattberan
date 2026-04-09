const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function suggestSentence(item, context, voice) {
  const rules = (voice.rules || []).join('\n- ');
  const avoid = (voice.vocabulary?.avoid || []).join(', ');
  const prefer = (voice.vocabulary?.prefer || []).join(', ');

  const prompt = `You're helping Matt Beran write a one-sentence hook for his newsletter "The Beran Brief".

Matt's voice rules:
- ${rules}

Prefer these words: ${prefer}
Avoid these words: ${avoid}

Tone: ${voice.tone_notes || 'Practitioner voice. Never vendor-speak. Direct and sharp.'}

Category: ${item.category}
Current sentence: ${item.sentence || '(empty)'}
Additional context: ${context || '(none)'}

Write exactly one sentence. No explanation. No quotes. Just the sentence.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text.trim();
}

module.exports = { suggestSentence };
