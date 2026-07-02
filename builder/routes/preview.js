const express = require('express');
const router = express.Router();
const renderer = require('../lib/renderer');

// POST /api/preview — body is the issue JSON, returns rendered HTML/text
router.post('/', (req, res) => {
  const issue = req.body;
  const mode = req.query.mode || 'email'; // 'email' | 'web'
  try {
    let output;
    if (mode === 'web') output = renderer.renderIssuePage(issue);
    else if (mode === 'email-html') output = renderer.renderEmailHtml(issue);
    else output = renderer.renderEmail(issue);
    res.json({ html: output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
