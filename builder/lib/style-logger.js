const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../style/edits-log.jsonl');

function logEdit({ original, edited, reason, context }) {
  if (original === edited) return; // no actual change
  const entry = {
    timestamp: new Date().toISOString(),
    original,
    edited,
    reason: reason || '',
    context: context || '',
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

function getRecentEdits(n = 20) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-n).map(l => JSON.parse(l));
}

module.exports = { logEdit, getRecentEdits };
