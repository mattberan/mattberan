const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

async function updateVoiceModel(newEdits, currentModel) {
  const editsText = newEdits.map(e =>
    `Original: "${e.original}"\nEdited: "${e.edited}"\nReason: ${e.reason || '(no reason given)'}`
  ).join('\n\n');

  const prompt = `Here are Matt Beran's recent edits to his newsletter. Each entry shows what he changed and why.
Analyze these and update the style rules. Be specific and actionable.
Return ONLY valid JSON matching this structure — no explanation, no markdown fences:

${JSON.stringify(currentModel, null, 2)}

Recent edits:
${editsText}`;

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
  const data = await response.json();

  try {
    return JSON.parse(data.response);
  } catch {
    throw new Error('Ollama returned invalid JSON for voice model update');
  }
}

module.exports = { updateVoiceModel };
