const nodemailer = require('nodemailer');
const renderer = require('./renderer');

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
  const text = renderer.renderEmail(issue)
    .replace('{{UNSUBSCRIBE_LINK}}', `${baseUrl}/unsubscribe/?t=TEST`);
  await transport.sendMail({
    from: process.env.FROM_EMAIL,
    to: process.env.FROM_EMAIL,
    subject: `[TEST] ${subject}`,
    text,
  });
}

async function sendToList(issue, subject, recipients) {
  const transport = getTransport();
  const baseText = renderer.renderEmail(issue);
  const baseUrl = process.env.SITE_BASE_URL || 'https://mattberan.com';

  for (const to of recipients) {
    const token = Buffer.from(to).toString('base64');
    const unsubscribeLink = `${baseUrl}/unsubscribe/?t=${encodeURIComponent(token)}`;
    const text = baseText.replace('{{UNSUBSCRIBE_LINK}}', unsubscribeLink);
    await transport.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject,
      text,
    });
  }
}

module.exports = { sendTest, sendToList };
