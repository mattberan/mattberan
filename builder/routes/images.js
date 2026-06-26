const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../../site/images');
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

router.post('/', (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!filename || !data) return res.status(400).json({ error: 'Missing filename or data' });

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return res.status(400).json({ error: 'Invalid file type' });

    const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    fs.mkdirSync(IMAGES_DIR, { recursive: true });

    let destName = safe;
    let destPath = path.join(IMAGES_DIR, destName);
    let n = 1;
    while (fs.existsSync(destPath)) {
      destName = `${path.basename(safe, ext)}-${n}${ext}`;
      destPath = path.join(IMAGES_DIR, destName);
      n++;
    }

    fs.writeFileSync(destPath, Buffer.from(data, 'base64'));
    res.json({ url: `/images/${destName}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
