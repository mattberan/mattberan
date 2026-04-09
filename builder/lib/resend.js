const { Resend } = require('resend');
const renderer = require('./renderer');

function getClient() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set in .env');
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendTest(issue, subject) {
  const resendClient = getClient();
  const text = renderer.renderEmail(issue);
  await resendClient.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: process.env.RESEND_FROM_EMAIL, // Matt's own address
    subject,
    text,
  });
}

async function sendToList(issue, subject) {
  const resendClient = getClient();
  const text = renderer.renderEmail(issue);
  await resendClient.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: process.env.RESEND_FROM_EMAIL, // Resend handles list delivery via audience
    subject,
    text,
    tags: [{ name: 'issue', value: issue.slug }],
  });
}

module.exports = { sendTest, sendToList };
