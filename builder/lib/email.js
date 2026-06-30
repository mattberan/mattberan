const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { renderEmail, renderEmailHtml } = require('./renderer');

const LOG_FILE = path.join(__dirname, '../../email.log');

function logSend(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFileSync(LOG_FILE, line);
}

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.porkbun.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // STARTTLS on 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendTest(issue, subject) {
  const transport = getTransport();
  const baseUrl = process.env.SITE_BASE_URL || 'https://mattberan.com';
  const unsubscribeLink = `${baseUrl}/unsubscribe/?t=TEST`;
  const text = renderEmail(issue).replace('{{UNSUBSCRIBE_LINK}}', unsubscribeLink);
  const html = renderEmailHtml(issue).replace('{{UNSUBSCRIBE_LINK}}', unsubscribeLink);
  try {
    await transport.sendMail({
      from: process.env.FROM_EMAIL,
      to: process.env.FROM_EMAIL,
      subject: `[TEST] ${subject}`,
      text,
      html,
    });
    logSend({ type: 'test', slug: issue.slug, subject, to: process.env.FROM_EMAIL, ok: true });
  } catch (err) {
    logSend({ type: 'test', slug: issue.slug, subject, to: process.env.FROM_EMAIL, ok: false, error: err.message });
    throw err;
  }
}

async function sendToList(issue, subject, recipients) {
  const transport = getTransport();
  const baseUrl = process.env.SITE_BASE_URL || 'https://mattberan.com';
  const baseText = renderEmail(issue);
  const baseHtml = renderEmailHtml(issue);

  let sent = 0, failed = 0;
  for (const to of recipients) {
    const token = Buffer.from(to).toString('base64');
    const unsubscribeLink = `${baseUrl}/unsubscribe/?t=${encodeURIComponent(token)}`;
    try {
      await transport.sendMail({
        from: process.env.FROM_EMAIL,
        to,
        subject,
        text: baseText.replace('{{UNSUBSCRIBE_LINK}}', unsubscribeLink),
        html: baseHtml.replace('{{UNSUBSCRIBE_LINK}}', unsubscribeLink),
      });
      sent++;
    } catch (err) {
      failed++;
      logSend({ type: 'send_error', slug: issue.slug, subject, to, error: err.message });
    }
  }

  logSend({ type: 'send', slug: issue.slug, subject, sent, failed, total: recipients.length });

  const date = new Date().toISOString().slice(0, 10);
  const csv = 'email\n' + recipients.join('\n');
  await transport.sendMail({
    from: process.env.FROM_EMAIL,
    to: process.env.FROM_EMAIL,
    subject: `[BB Backup] ${recipients.length} subscribers — ${subject}`,
    text: `Subscriber list at time of send (${recipients.length} total).`,
    attachments: [{ filename: `subscribers-${date}.csv`, content: csv, contentType: 'text/csv' }],
  });
}

async function sendConfirmation(to) {
  const transport = getTransport();
  const baseUrl = process.env.SITE_BASE_URL || 'https://mattberan.com';
  const token = encodeURIComponent(Buffer.from(to).toString('base64'));
  const confirmLink = `${baseUrl}/confirm/?t=${token}`;
  const text = `Hey — you signed up for The Beran Brief.\n\nClick the link below to confirm your subscription:\n\n${confirmLink}\n\nIf you didn't sign up, you can ignore this email. No action needed.\n\n— Matt`;
  const html = `<p>Hey — you signed up for The Beran Brief.</p><p>Click the link below to confirm your subscription:</p><p><a href="${confirmLink}">${confirmLink}</a></p><p>If you didn't sign up, you can ignore this email. No action needed.</p><p>— Matt</p>`;
  try {
    await transport.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject: 'Confirm your subscription to The Beran Brief',
      text,
      html,
    });
    logSend({ type: 'confirm', to, ok: true });
  } catch (err) {
    logSend({ type: 'confirm', to, ok: false, error: err.message });
    throw err;
  }
}

module.exports = { sendTest, sendToList, sendConfirmation };
