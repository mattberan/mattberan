require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const email = require('./lib/email');
const subscribers = require('./lib/subscribers');

const DRAFTS_DIR = path.join(__dirname, 'drafts');

function cleanupPlist(slug) {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `com.mattberan.brief.send-${slug}.plist`);
  if (!fs.existsSync(plistPath)) return;
  spawnSync('launchctl', ['unload', plistPath]);
  fs.unlinkSync(plistPath);
  console.log(`Cleaned up launchd plist for ${slug}.`);
}

async function run() {
  if (!fs.existsSync(DRAFTS_DIR)) return;

  const now = new Date();
  const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(DRAFTS_DIR, file);
    let issue;
    try { issue = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { continue; }

    if (!issue.send_at || issue.status === 'published') continue;

    const sendAt = new Date(issue.send_at);
    if (sendAt > now) {
      console.log(`Skipping ${issue.slug} — scheduled for ${sendAt.toLocaleString()}`);
      continue;
    }

    console.log(`Sending ${issue.slug}…`);
    const subject = issue.subject || '(no subject)';
    const list = subscribers.load();

    if (list.length === 0) {
      console.log('No subscribers — skipping send.');
    } else {
      await email.sendToList(issue, subject, list);
      console.log(`Sent to ${list.length} subscribers.`);
    }

    issue.status = 'published';
    issue.send_at = null;
    fs.writeFileSync(filePath, JSON.stringify(issue, null, 2));

    // Remove the one-shot launchd plist so it doesn't re-fire next year
    cleanupPlist(issue.slug);
  }
}

run().catch(e => { console.error('Scheduler error:', e.message); process.exit(1); });
