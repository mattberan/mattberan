const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const styleLogger = require('../lib/style-logger');

const DRAFTS_DIR = path.join(__dirname, '../drafts');

function isValidSlug(slug) {
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

function draftsPath(slug) {
  if (!isValidSlug(slug)) throw new Error('Invalid slug');
  return path.join(DRAFTS_DIR, `${slug}.json`);
}

// List all drafts
router.get('/', (req, res) => {
  const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.json'));
  const drafts = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf8'));
    return { slug: data.slug, date: data.date, subject: data.subject || '', status: data.status || 'draft' };
  }).sort((a, b) => b.date.localeCompare(a.date));
  res.json(drafts);
});

// Get a single draft
router.get('/:slug', (req, res) => {
  const fp = draftsPath(req.params.slug);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Draft not found' });
  res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
});

// Save (create or update) a draft
router.put('/:slug', (req, res) => {
  const data = req.body;
  fs.writeFileSync(draftsPath(req.params.slug), JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

// Delete a draft
router.delete('/:slug', (req, res) => {
  const fp = draftsPath(req.params.slug);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  res.json({ ok: true });
});

// Log a sentence edit
router.post('/log-edit', (req, res) => {
  const { original, edited, reason, context } = req.body;
  styleLogger.logEdit({ original, edited, reason, context });
  res.json({ ok: true });
});

module.exports = router;
