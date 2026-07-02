const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../subscribers.json');
const PENDING_FILE = path.join(__dirname, '../pending.json');

function load() {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function save(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function loadPending() {
  try {
    const raw = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    // migrate old plain-string format
    return raw.map(item => typeof item === 'string' ? { email: item, sent: false } : item);
  } catch { return []; }
}

function savePending(list) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(list, null, 2));
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
    if (!res.ok) throw new Error(`Formspree API error on form ${formId}: ${res.status} ${res.statusText}`);
    const data = await res.json();
    for (const sub of (data.submissions || [])) {
      const email = (sub.email || sub._replyto || '').trim().toLowerCase();
      if (email && email.includes('@')) emails.push(email);
    }
    if (!data.next) break;
    page++;
  }
  return emails;
}

// Returns { added, removed, newPending }
// newPending = emails just added to pending (caller should send them confirmation emails)
async function syncFromFormspree() {
  const apiKey = process.env.FORMSPREE_API_KEY;
  if (!apiKey) throw new Error('FORMSPREE_API_KEY not set');

  const subFormId = process.env.FORMSPREE_FORM_ID;
  if (!subFormId) throw new Error('FORMSPREE_FORM_ID not set');

  const confirmFormId = process.env.FORMSPREE_CONFIRM_FORM_ID;
  const unsubFormId = process.env.FORMSPREE_UNSUB_FORM_ID;
  const confirmApiKey = process.env.FORMSPREE_CONFIRM_API_KEY || apiKey;
  const unsubApiKey = process.env.FORMSPREE_UNSUB_API_KEY || apiKey;

  const [signups, confirms, unsubs] = await Promise.all([
    fetchFormspreeEmails(subFormId, apiKey),
    confirmFormId ? fetchFormspreeEmails(confirmFormId, confirmApiKey) : Promise.resolve([]),
    unsubFormId ? fetchFormspreeEmails(unsubFormId, unsubApiKey) : Promise.resolve([]),
  ]);

  const confirmedSet = new Set(confirms);
  const unsubSet = new Set(unsubs);

  let list = load();
  let pending = loadPending();
  let added = 0;
  let removed = 0;
  const newPending = [];

  for (const email of signups) {
    if (unsubSet.has(email)) continue;

    if (confirmedSet.has(email)) {
      if (!list.includes(email)) {
        list.push(email);
        added++;
      }
      pending = pending.filter(p => p.email !== email);
    } else {
      if (!list.includes(email) && !pending.some(p => p.email === email)) {
        pending.push({ email, sent: false });
        newPending.push(email);
      }
    }
  }

  const before = list.length;
  list = list.filter(e => !unsubSet.has(e));
  removed = before - list.length;
  pending = pending.filter(p => !unsubSet.has(p.email));

  save(list);
  savePending(pending);
  return { added, removed, total: list.length, newPending };
}

module.exports = { load, add, remove, importCSV, syncFromFormspree, loadPending, savePending };
