const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const renderer = require('../lib/renderer');
const email = require('../lib/email');

const SITE_DIR = path.join(__dirname, '../../site');

// POST /api/publish — renders pages, commits, pushes, sends email
router.post('/', async (req, res) => {
  const { issue, subject, testOnly = false } = req.body;
  const errors = [];

  try {
    // 1. Render and write site pages
    const issueDir = path.join(SITE_DIR, 'newsletter', issue.slug);
    fs.mkdirSync(issueDir, { recursive: true });

    fs.writeFileSync(
      path.join(issueDir, 'index.html'),
      renderer.renderIssuePage(issue)
    );

    for (const item of issue.items) {
      if (item.has_deep && item.deep_content) {
        const itemDir = path.join(issueDir, item.slug);
        fs.mkdirSync(itemDir, { recursive: true });
        fs.writeFileSync(
          path.join(itemDir, 'index.html'),
          renderer.renderDeepPage(issue, item)
        );
      }
    }

    // 2. Rebuild newsletter index
    fs.writeFileSync(
      path.join(SITE_DIR, 'newsletter', 'index.html'),
      renderer.renderNewsletterIndex()
    );

    if (testOnly) {
      await email.sendTest(issue, subject);
      return res.json({ ok: true, mode: 'test' });
    }

    // 3. Commit and push
    const repoRoot = path.join(__dirname, '../..');
    execSync('git add site/', { cwd: repoRoot });
    execSync(`git commit -m "Issue ${issue.slug}: ${subject}"`, { cwd: repoRoot });
    execSync('git push', { cwd: repoRoot });

    // 4. Send to full list
    await email.sendToList(issue, subject, []);

    res.json({ ok: true, mode: 'publish' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
