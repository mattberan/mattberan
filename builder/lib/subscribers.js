const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../subscribers.json');

function load() {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function save(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function add(email) {
  const list = load();
  const normalized = email.trim().toLowerCase();
  if (!list.includes(normalized)) {
    list.push(normalized);
    save(list);
  }
  return load();
}

function remove(email) {
  const list = load();
  const normalized = email.trim().toLowerCase();
  save(list.filter(e => e !== normalized));
  return load();
}

function importCSV(csvText) {
  // Handles Formspree CSV export — looks for an "email" column
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const emailCol = headers.indexOf('email');
  if (emailCol === -1) throw new Error('No "email" column found in CSV');

  const list = load();
  let added = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    const email = cols[emailCol]?.toLowerCase();
    if (email && email.includes('@') && !list.includes(email)) {
      list.push(email);
      added++;
    }
  }
  save(list);
  return { added, total: load().length };
}

async function fetchFormspreeEmails(formId, apiKey) {
  let page = 0;
  let emails = [];
  while (true) {
    const url = `https://formspree.io/api/0/forms/${formId}/submissions?page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`Formspree API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    for (const sub of (data.submissions || [])) {
      const email = (sub.email || sub._replyto || '').trim().toLowerCase();
      if (email && email.includes('@')) emails.push({ email, unsubscribe: !!sub.unsubscribe });
    }
    if (!data.next) break;
    page++;
  }
  return emails;
}

async function syncFromFormspree() {
  const apiKey = process.env.FORMSPREE_API_KEY;
  if (!apiKey) throw new Error('FORMSPREE_API_KEY not set');

  // Fetch subscribers
  const subFormId = process.env.FORMSPREE_FORM_ID;
  if (!subFormId) throw new Error('FORMSPREE_FORM_ID not set');
  const subEntries = await fetchFormspreeEmails(subFormId, apiKey);

  // Fetch unsubscribes (optional — only if form ID is configured)
  const unsubFormId = process.env.FORMSPREE_UNSUB_FORM_ID;
  const unsubApiKey = process.env.FORMSPREE_UNSUB_API_KEY || apiKey;
  let unsubEmails = new Set();
  if (unsubFormId) {
    const unsubEntries = await fetchFormspreeEmails(unsubFormId, unsubApiKey);
    unsubEntries.forEach(e => unsubEmails.add(e.email));
  }

  let list = load();
  let added = 0;
  let removed = 0;

  // Add new subscribers
  for (const { email } of subEntries) {
    if (!list.includes(email) && !unsubEmails.has(email)) {
      list.push(email);
      added++;
    }
  }

  // Remove unsubscribers
  const before = list.length;
  list = list.filter(e => !unsubEmails.has(e));
  removed = before - list.length;

  save(list);
  return { added, removed, total: list.length };
}

module.exports = { load, add, remove, importCSV, syncFromFormspree };
