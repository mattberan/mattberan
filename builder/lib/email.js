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
  const text = renderer.renderEmail(issue);
  await transport.sendMail({
    from: process.env.FROM_EMAIL,
    to: process.env.FROM_EMAIL,
    subject: `[TEST] ${subject}`,
    text,
  });
}

async function sendToList(issue, subject, recipients) {
  const transport = getTransport();
  const text = renderer.renderEmail(issue);
  // Send individually so each gets a personalized unsubscribe link later
  for (const to of recipients) {
    await transport.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject,
      text,
    });
  }
}

module.exports = { sendTest, sendToList };
