const express = require('express');
const router = express.Router();
const subscribers = require('../lib/subscribers');

// GET /api/subscribers
router.get('/', (req, res) => {
  res.json(subscribers.load());
});

// POST /api/subscribers — add one email
router.post('/', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  res.json(subscribers.add(email));
});

// DELETE /api/subscribers — remove one email
router.delete('/', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  res.json(subscribers.remove(email));
});

// POST /api/subscribers/sync — pull directly from Formspree API
router.post('/sync', async (req, res) => {
  try {
    const result = await subscribers.syncFromFormspree();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscribers/import — CSV file upload fallback
router.post('/import', (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV data' });
  try {
    const result = subscribers.importCSV(csv);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
