// Run with: op run --env-file=.env.tpl -- node builder/send-confirmations.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { syncFromFormspree } = require('./lib/subscribers');
const { sendConfirmation } = require('./lib/email');

(async () => {
  console.log('[send-confirmations] Syncing from Formspree...');
  const result = await syncFromFormspree();
  console.log(`[send-confirmations] Sync done: +${result.added} confirmed, -${result.removed} removed, ${result.newPending.length} new pending`);

  if (result.newPending.length === 0) {
    console.log('[send-confirmations] No new pending signups. Done.');
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const email of result.newPending) {
    try {
      await sendConfirmation(email);
      console.log(`[send-confirmations] Sent confirmation to ${email}`);
      sent++;
    } catch (err) {
      console.error(`[send-confirmations] Failed to send to ${email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[send-confirmations] Done. Sent: ${sent}, Failed: ${failed}`);
})().catch(err => {
  console.error('[send-confirmations] Fatal error:', err.message);
  process.exit(1);
});
