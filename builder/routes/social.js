const express = require('express');
const router = express.Router();
const anthropic = require('../lib/anthropic');
const styleModel = require('../lib/style-model');
const socialFormatter = require('../lib/social-formatter');

// POST /api/social — generate 3 platform variants for all items
router.post('/', async (req, res) => {
  const { issue } = req.body;
  try {
    const posts = socialFormatter.format(issue);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social/suggest — suggest a sentence for one item
router.post('/suggest', async (req, res) => {
  const { item, context } = req.body;
  try {
    const voice = styleModel.load();
    const suggestion = await anthropic.suggestSentence(item, context, voice);
    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
