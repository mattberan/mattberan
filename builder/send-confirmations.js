// Run with: op run --env-file=.env.tpl -- node builder/send-confirmations.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { syncFromFormspree, loadPending, savePending } = require('./lib/subscribers');
const { sendConfirmation } = require('./lib/email');

(async () => {
  console.log('[send-confirmations] Syncing from Formspree...');
  const result = await syncFromFormspree();
  console.log(`[send-confirmations] Sync: +${result.added} confirmed, -${result.removed} removed, ${result.newPending.length} newly pending`);

  const pending = loadPending();
  const unsent = pending.filter(p => !p.sent);

  if (unsent.length === 0) {
    console.log('[send-confirmations] No unsent confirmations. Done.');
    return;
  }

  console.log(`[send-confirmations] Sending to ${unsent.length} pending subscriber(s)...`);
  let sent = 0, failed = 0;

  for (const item of pending) {
    if (item.sent) continue;
    try {
      await sendConfirmation(item.email);
      item.sent = true;
      sent++;
      console.log(`[send-confirmations] Sent to ${item.email}`);
    } catch (err) {
      failed++;
      console.error(`[send-confirmations] Failed to send to ${item.email}: ${err.message}`);
    }
  }

  savePending(pending);
  console.log(`[send-confirmations] Done. Sent: ${sent}, Failed: ${failed}`);
})().catch(err => {
  console.error('[send-confirmations] Fatal error:', err.message);
  process.exit(1);
});
