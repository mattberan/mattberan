const express = require('express');
const router = express.Router();
const renderer = require('../lib/renderer');

// POST /api/preview — body is the issue JSON, returns rendered HTML/text
router.post('/', (req, res) => {
  const issue = req.body;
  const mode = req.query.mode || 'email'; // 'email' | 'web'
  try {
    const output = mode === 'web' ? renderer.renderIssuePage(issue) : renderer.renderEmail(issue);
    res.json({ html: output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
