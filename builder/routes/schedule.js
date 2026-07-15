const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const { publishSiteOnly } = require('./publish');

const DRAFTS_DIR = path.join(__dirname, '../drafts');
const OP_BIN = '/opt/homebrew/bin/op';
const NODE_BIN = '/opt/homebrew/bin/node';
const ENV_FILE = path.join(__dirname, '../../.env.tpl');
const SENDER_SCRIPT = path.join(__dirname, '../send-scheduled.js');
const LOG_PATH = path.join(__dirname, '../../scheduler-send.log');

function plistLabelForSlug(slug) {
  return `com.mattberan.brief.send-${slug}`;
}

function plistPathForSlug(slug) {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${plistLabelForSlug(slug)}.plist`);
}

function buildPlist(slug, sendAt) {
  const label = plistLabelForSlug(slug);
  const month = sendAt.getMonth() + 1;
  const day = sendAt.getDate();
  const hour = sendAt.getHours();
  const minute = sendAt.getMinutes();

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${OP_BIN}</string>
    <string>run</string>
    <string>--env-file</string>
    <string>${ENV_FILE}</string>
    <string>--</string>
    <string>${NODE_BIN}</string>
    <string>${SENDER_SCRIPT}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Month</key>
    <integer>${month}</integer>
    <key>Day</key>
    <integer>${day}</integer>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_PATH}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_PATH}</string>
</dict>
</plist>`;
}

// POST /api/schedule
// 1. Validates send_at is in the future
// 2. Pushes site pages
// 3. Writes a one-shot launchd plist that fires at the exact send time
// 4. Marks draft status as 'scheduled'
router.post('/', async (req, res) => {
  const { issue, subject } = req.body;

  if (!issue || !issue.slug) return res.status(400).json({ error: 'Invalid issue.' });
  if (!subject) return res.status(400).json({ error: 'Subject is required before scheduling.' });
  if (!issue.send_at) return res.status(400).json({ error: 'Set a send date/time before scheduling.' });

  const sendAt = new Date(issue.send_at);
  if (isNaN(sendAt.getTime())) return res.status(400).json({ error: 'Invalid send date/time.' });
  if (sendAt <= new Date()) return res.status(400).json({ error: 'Send time must be in the future.' });

  try {
    // Push site first so pages are live before the email fires
    const urls = await publishSiteOnly(issue, subject);

    // Write plist
    const plistPath = plistPathForSlug(issue.slug);

    // Unload any existing plist for this slug (rescheduling case)
    if (fs.existsSync(plistPath)) {
      spawnSync('launchctl', ['unload', plistPath]);
    }

    fs.writeFileSync(plistPath, buildPlist(issue.slug, sendAt));
    execFileSync('launchctl', ['load', '-w', plistPath]);

    // Update draft
    const draftPath = path.join(DRAFTS_DIR, `${issue.slug}.json`);
    if (fs.existsSync(draftPath)) {
      const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
      draft.status = 'scheduled';
      draft.send_at = issue.send_at;
      fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));
    }

    res.json({ ok: true, scheduledFor: sendAt.toISOString(), urls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.plistPathForSlug = plistPathForSlug;
module.exports.plistLabelForSlug = plistLabelForSlug;
