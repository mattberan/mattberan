const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const renderer = require('../lib/renderer');

const SECRET_ARCHIVE_DIR = path.join(__dirname, '../../site/thisiswhereistoreallmynewsletters');
const email = require('../lib/email');
const subscribers = require('../lib/subscribers');

const SITE_DIR = path.join(__dirname, '../../site');

const BASE_URL = process.env.SITE_BASE_URL || 'https://mattberan.com';

// POST /api/publish
// modes: testOnly, siteOnly, emailOnly, or full (default)
router.post('/', async (req, res) => {
  const { issue, subject, testOnly = false, siteOnly = false, emailOnly = false } = req.body;

  try {
    // Test email only — no render, no push
    if (testOnly) {
      await email.sendTest(issue, subject);
      return res.json({ ok: true, mode: 'test' });
    }

    // Email only — no render, no push
    if (emailOnly) {
      const list = subscribers.load();
      if (list.length === 0) return res.json({ ok: true, mode: 'email', warning: 'No subscribers yet.' });
      await email.sendToList(issue, subject, list);
      if (issue.slug && /^[a-zA-Z0-9_-]+$/.test(issue.slug)) {
        const draftPath = path.join(__dirname, '../drafts', `${issue.slug}.json`);
        if (fs.existsSync(draftPath)) {
          const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
          draft.status = 'published';
          fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));
        }
      }
      return res.json({ ok: true, mode: 'email' });
    }

    // Render and write site pages
    const issueDir = path.join(SITE_DIR, 'bb', issue.slug);
    fs.mkdirSync(issueDir, { recursive: true });
    fs.writeFileSync(path.join(issueDir, 'index.html'), renderer.renderIssuePage(issue));

    for (const item of issue.items) {
      if (item.has_deep && item.deep_content) {
        const itemDir = path.join(issueDir, item.slug);
        fs.mkdirSync(itemDir, { recursive: true });
        fs.writeFileSync(path.join(itemDir, 'index.html'), renderer.renderDeepPage(issue, item));
      }
    }

    fs.writeFileSync(path.join(SITE_DIR, 'bb', 'index.html'), renderer.renderNewsletterIndex());
    fs.mkdirSync(SECRET_ARCHIVE_DIR, { recursive: true });
    fs.writeFileSync(path.join(SECRET_ARCHIVE_DIR, 'index.html'), renderer.renderArchive());

    // Commit and push (skip if nothing changed)
    const repoRoot = path.join(__dirname, '../..');

    // Stash any uncommitted working-tree changes so they don't block git ops
    const stashOut = spawnSync('git', ['stash'], { cwd: repoRoot }).stdout.toString();
    const didStash = !stashOut.includes('No local changes to save');

    try {
      // Fetch + rebase onto origin BEFORE committing so the push never gets rejected
      execFileSync('git', ['fetch', 'origin'], { cwd: repoRoot });
      execFileSync('git', ['rebase', 'origin/main'], { cwd: repoRoot });

      execFileSync('git', ['add', 'site/'], { cwd: repoRoot });
      const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: repoRoot });
      if (diff.status !== 0) {
        execFileSync('git', ['commit', '-m', `Issue ${issue.slug}: ${subject}`], { cwd: repoRoot });
        try {
          execFileSync('git', ['push'], { cwd: repoRoot });
        } catch (pushErr) {
          throw new Error('Git push failed: ' + (pushErr.stderr?.toString().trim() || pushErr.message));
        }
      }
    } finally {
      if (didStash) spawnSync('git', ['stash', 'pop'], { cwd: repoRoot });
    }

    // Site only — return URLs for proofing
    if (siteOnly) {
      const urls = {
        issue: `${BASE_URL}/bb/${issue.slug}/`,
        deepPages: issue.items
          .filter(i => i.has_deep && i.deep_content)
          .map(i => ({ category: i.category, url: `${BASE_URL}/bb/${issue.slug}/${i.slug}/` })),
      };
      return res.json({ ok: true, mode: 'site', urls });
    }

    // Full publish — also send email
    const list = subscribers.load();
    if (list.length === 0) return res.json({ ok: true, mode: 'publish', warning: 'No subscribers yet — pages published but no email sent.' });
    await email.sendToList(issue, subject, list);
    res.json({ ok: true, mode: 'publish' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
