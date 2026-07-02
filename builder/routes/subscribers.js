const express = require('express');
const router = express.Router();
const subscribers = require('../lib/subscribers');
const { sendConfirmation } = require('../lib/email');

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

// POST /api/subscribers/sync — pull from Formspree and send any pending confirmation emails
router.post('/sync', async (req, res) => {
  try {
    const result = await subscribers.syncFromFormspree();

    const pending = subscribers.loadPending();
    const unsent = pending.filter(p => !p.sent);
    let confirmSent = 0, confirmFailed = 0;

    for (const item of pending) {
      if (item.sent) continue;
      try {
        await sendConfirmation(item.email);
        item.sent = true;
        confirmSent++;
      } catch {
        confirmFailed++;
      }
    }

    if (confirmSent > 0 || confirmFailed > 0) subscribers.savePending(pending);

    res.json({ ...result, confirmSent, confirmFailed, pendingTotal: unsent.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscribers/export — download subscriber list as CSV
router.get('/export', (req, res) => {
  const list = subscribers.load();
  const csv = 'email\n' + list.join('\n');
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="subscribers-${date}.csv"`);
  res.send(csv);
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
