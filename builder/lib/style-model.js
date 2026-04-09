const fs = require('fs');
const path = require('path');
const ollama = require('./ollama');
const { getRecentEdits } = require('./style-logger');

const MODEL_FILE = path.join(__dirname, '../style/voice-model.json');

const DEFAULT_MODEL = {
  last_updated: new Date().toISOString().split('T')[0],
  rules: [
    'Use active voice — Matt speaks directly',
    'Short > long. If it can be cut, cut it.',
    'Lead with the implication, not the feature',
    'Sound like a practitioner, not a vendor'
  ],
  vocabulary: {
    prefer: ['shipped', 'broke', 'actually', "here's the thing"],
    avoid: ['leverage', 'utilize', 'exciting', 'robust']
  },
  tone_notes: "Practitioner voice. Never vendor-speak. 20 years of ITSM frustration, zero patience for fluff."
};

function load() {
  if (!fs.existsSync(MODEL_FILE)) return DEFAULT_MODEL;
  return JSON.parse(fs.readFileSync(MODEL_FILE, 'utf8'));
}

function save(model) {
  fs.writeFileSync(MODEL_FILE, JSON.stringify(model, null, 2));
}

async function update() {
  const edits = getRecentEdits(20);
  if (edits.length === 0) return;
  const current = load();
  try {
    const updated = await ollama.updateVoiceModel(edits, current);
    updated.last_updated = new Date().toISOString().split('T')[0];
    save(updated);
    return updated;
  } catch (err) {
    console.error('Voice model update failed:', err.message);
  }
}

module.exports = { load, save, update };
