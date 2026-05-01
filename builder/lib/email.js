const nodemailer = require('nodemailer');
const { renderEmail, renderEmailHtml } = require('./renderer');

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
  await transport.sendMail({
    from: process.env.FROM_EMAIL,
    to: process.env.FROM_EMAIL,
    subject: `[TEST] ${subject}`,
    text,
    html,
  });
}

async function sendToList(issue, subject, recipients) {
  const transport = getTransport();
  const baseUrl = process.env.SITE_BASE_URL || 'https://mattberan.com';
  const baseText = renderEmail(issue);
  const baseHtml = renderEmailHtml(issue);

  for (const to of recipients) {
    const token = Buffer.from(to).toString('base64');
    const unsubscribeLink = `${baseUrl}/unsubscribe/?t=${encodeURIComponent(token)}`;
    await transport.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject,
      text: baseText.replace('{{UNSUBSCRIBE_LINK}}', unsubscribeLink),
      html: baseHtml.replace('{{UNSUBSCRIBE_LINK}}', unsubscribeLink),
    });
  }
}

module.exports = { sendTest, sendToList };
