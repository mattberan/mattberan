// ── State ──────────────────────────────────────────────────────────────────
const DEFAULT_ITEMS = [
  { id: 1, category: 'The Take',        sentence: '', slug: '', has_deep: true,  deep_content: '', external_link: '' },
  { id: 2, category: 'Something Cool',  sentence: '', slug: '', has_deep: true,  deep_content: '', external_link: '' },
  { id: 3, category: 'Worth Your Time', sentence: '', slug: '', has_deep: false, deep_content: '', external_link: '' },
];

let issue = null;
let previewMode = 'email';
let autosaveInterval = null;
let previewTimer = null;

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
  loadSubscriberCount();
});

// ── Views ──────────────────────────────────────────────────────────────────
function showView(viewName) {
  document.querySelectorAll('.view').forEach(el => el.style.display = 'none');
  document.getElementById(`view-${viewName}`).style.display = '';
}

async function goToDashboard() {
  if (issue) {
    // Auto-save before leaving
    await saveDraftQuiet();
  }
  stopAutosave();
  issue = null;
  await loadDashboard();
  showView('dashboard');
}

function openEditor(data) {
  issue = data;
  document.getElementById('issue-date').value = data.date;
  document.getElementById('issue-subject').value = data.subject || '';
  document.getElementById('issue-greeting').value = data.greeting || '';
  document.getElementById('issue-send-at').value = data.send_at || '';
  renderItems();
  showTab('details');
  showView('editor');
  startAutosave();
  updatePreview();
  loadSubscribers();

  // Wire change listeners (re-wire each time to avoid stacking)
  const dateEl = document.getElementById('issue-date');
  const subjectEl = document.getElementById('issue-subject');
  const greetingEl = document.getElementById('issue-greeting');

  dateEl.onchange = () => {
    issue.date = dateEl.value;
    issue.slug = dateToSlug(dateEl.value);
    deferPreview();
  };
  subjectEl.oninput = () => { issue.subject = subjectEl.value; };
  greetingEl.oninput = () => { issue.greeting = greetingEl.value; deferPreview(); };

  const sendAtEl = document.getElementById('issue-send-at');
  sendAtEl.onchange = () => { issue.send_at = sendAtEl.value || null; };
}

// ── Dashboard ──────────────────────────────────────────────────────────────
async function loadDashboard() {
  const res = await fetch('/api/issues');
  const drafts = await res.json();
  const tbody = document.getElementById('drafts-tbody');
  const noMsg = document.getElementById('no-drafts');
  const table = document.getElementById('drafts-table');

  if (drafts.length === 0) {
    table.style.display = 'none';
    noMsg.style.display = '';
    return;
  }

  table.style.display = '';
  noMsg.style.display = 'none';
  tbody.innerHTML = drafts.map(d => {
    const status = d.status === 'published'
      ? '<span class="badge badge-published">Published</span>'
      : d.send_at
        ? '<span class="badge badge-scheduled">Scheduled</span>'
        : '<span class="badge badge-draft">Draft</span>';
    const subject = d.subject
      ? `<span class="subject-col">${esc(d.subject)}</span>`
      : `<span class="subject-col empty">No subject</span>`;
    return `<tr>
      <td class="date-col">${d.date}</td>
      <td>${subject}</td>
      <td class="status-col">${status}</td>
      <td class="actions-col">
        <button class="row-btn edit-btn" onclick="editDraft('${d.slug}')">Edit</button>
        <button class="row-btn delete-btn" onclick="deleteDraftFromDash('${d.slug}', '${d.date}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

async function loadSubscriberCount() {
  const res = await fetch('/api/subscribers');
  const list = await res.json();
  document.getElementById('dash-sub-count').textContent = list.length;
}

function newIssue() {
  const data = {
    slug: dateToSlug(nextThursday()),
    date: nextThursday(),
    subject: '',
    greeting: '',
    status: 'draft',
    send_at: null,
    items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
  };
  openEditor(data);
}

async function editDraft(slug) {
  const res = await fetch(`/api/issues/${slug}`);
  if (!res.ok) { toast('Draft not found'); return; }
  const data = await res.json();
  openEditor(data);
}

async function deleteDraftFromDash(slug, date) {
  if (!confirm(`Delete draft for ${date}? This cannot be undone.`)) return;
  await fetch(`/api/issues/${slug}`, { method: 'DELETE' });
  await loadDashboard();
  toast('Draft deleted');
}

// ── Date helpers ───────────────────────────────────────────────────────────
function nextThursday() {
  const d = new Date();
  const day = d.getDay();
  const daysUntilThursday = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilThursday);
  return d.toISOString().split('T')[0];
}

function dateToSlug(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}${m}${y}`;
}

// ── Tab navigation ─────────────────────────────────────────────────────────
function showTab(tabName) {
  document.querySelectorAll('.tab-pane').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).style.display = '';
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById('preview-panel').style.display = tabName === 'subscribers' ? 'none' : '';
  if (tabName === 'subscribers') loadSubscribers();
}

// ── Item rendering ─────────────────────────────────────────────────────────
function renderItems() {
  const container = document.getElementById('items-container');
  container.innerHTML = '';
  issue.items.forEach((item, idx) => {
    container.appendChild(buildItemBlock(item, idx));
  });
}

function buildItemBlock(item, idx) {
  const div = document.createElement('div');
  div.className = 'item-block';
  div.id = `item-block-${idx}`;
  div.innerHTML = `
    <div class="item-header">
      <span class="item-num">Item ${item.id}</span>
    </div>
    <div class="field-group">
      <label>Category</label>
      <input type="text" value="${esc(item.category)}" data-field="category" data-idx="${idx}">
    </div>
    <div class="field-group">
      <label>Sentence</label>
      <textarea data-field="sentence" data-idx="${idx}" rows="2">${esc(item.sentence)}</textarea>
    </div>
    <div class="why-field" id="why-${idx}" style="display:none">
      <div class="field-group">
        <label>Why did you change this? (optional)</label>
        <textarea data-field="why" data-idx="${idx}" rows="2" placeholder="e.g. Too passive. I want it to feel like news."></textarea>
      </div>
    </div>
    <div class="toggle-row">
      <input type="checkbox" id="has-deep-${idx}" data-idx="${idx}" ${item.has_deep ? 'checked' : ''} onchange="toggleDeep(${idx})">
      <label for="has-deep-${idx}">Has deep page</label>
    </div>
    <div id="deep-section-${idx}" style="${item.has_deep ? '' : 'display:none'}">
      <div class="field-group">
        <label>Deep content</label>
        <textarea data-field="deep_content" data-idx="${idx}" rows="6">${esc(item.deep_content || '')}</textarea>
      </div>
    </div>
    <div id="link-section-${idx}" style="${item.has_deep ? 'display:none' : ''}">
      <div class="field-group">
        <label>External link</label>
        <input type="url" data-field="external_link" data-idx="${idx}" value="${esc(item.external_link || '')}" placeholder="https://…">
      </div>
    </div>
    <div class="field-group">
      <label>Item slug</label>
      <input type="text" data-field="slug" data-idx="${idx}" value="${esc(item.slug)}" placeholder="auto-generated from sentence">
    </div>
  `;

  div.querySelectorAll('[data-field]').forEach(el => {
    const field = el.dataset.field;
    const i = parseInt(el.dataset.idx);
    const originalSentence = { value: item.sentence };

    el.addEventListener('input', () => {
      if (field === 'sentence') {
        const prev = originalSentence.value;
        const next = el.value;
        issue.items[i].sentence = next;
        const slugEl = div.querySelector(`[data-field="slug"]`);
        if (slugEl && (!slugEl.value || slugEl.value === slugify(prev))) {
          slugEl.value = slugify(next);
          issue.items[i].slug = slugify(next);
        }
        if (next !== prev && prev !== '') {
          document.getElementById(`why-${i}`).style.display = '';
        }
        deferPreview();
      } else if (field === 'why') {
        // logged on blur
      } else if (field === 'slug') {
        issue.items[i].slug = el.value;
      } else if (field === 'deep_content') {
        issue.items[i].deep_content = el.value;
        deferPreview();
      } else if (field === 'external_link') {
        issue.items[i].external_link = el.value;
        deferPreview();
      } else if (field === 'category') {
        issue.items[i].category = el.value;
        deferPreview();
      }
    });

    if (field === 'why') {
      el.addEventListener('blur', () => {
        const reason = el.value.trim();
        const current = issue.items[i].sentence;
        if (reason || originalSentence.value !== current) {
          logEdit(originalSentence.value, current, reason, `item ${i + 1}, issue ${issue.slug}`);
          originalSentence.value = current;
          document.getElementById(`why-${i}`).style.display = 'none';
          el.value = '';
        }
      });
    }
  });

  return div;
}

function toggleDeep(idx) {
  const checked = document.getElementById(`has-deep-${idx}`).checked;
  issue.items[idx].has_deep = checked;
  document.getElementById(`deep-section-${idx}`).style.display = checked ? '' : 'none';
  document.getElementById(`link-section-${idx}`).style.display = checked ? 'none' : '';
  deferPreview();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Preview ────────────────────────────────────────────────────────────────
function setPreviewMode(mode) {
  previewMode = mode;
  document.getElementById('preview-email-btn').classList.toggle('active', mode === 'email');
  document.getElementById('preview-web-btn').classList.toggle('active', mode === 'web');
  updatePreview();
}

function deferPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 300);
}

async function updatePreview() {
  if (!issue) return;
  const frame = document.getElementById('preview-frame');
  try {
    const res = await fetch(`/api/preview?mode=${previewMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildIssuePayload()),
    });
    const { html } = await res.json();
    if (previewMode === 'email') {
      frame.innerHTML = `<div class="email-preview">${escHtml(html)}</div>`;
    } else {
      frame.innerHTML = `<div class="web-preview">${html}</div>`;
    }
  } catch (e) {
    frame.textContent = 'Preview error: ' + e.message;
  }
}

// ── Draft persistence ──────────────────────────────────────────────────────
function buildIssuePayload() {
  return {
    ...issue,
    date: document.getElementById('issue-date').value,
    subject: document.getElementById('issue-subject').value,
    greeting: document.getElementById('issue-greeting').value,
  };
}

async function saveDraftQuiet() {
  if (!issue) return;
  const payload = buildIssuePayload();
  issue = payload;
  issue.slug = issue.slug || dateToSlug(issue.date);
  await fetch(`/api/issues/${issue.slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(issue),
  });
}

async function saveDraft() {
  await saveDraftQuiet();
  showStatus('Draft saved');
  toast('Draft saved');
}

function startAutosave() {
  stopAutosave();
  autosaveInterval = setInterval(async () => {
    if (!issue) return;
    await saveDraftQuiet();
    showStatus('Autosaved ' + new Date().toLocaleTimeString());
  }, 60000);
}

function stopAutosave() {
  if (autosaveInterval) { clearInterval(autosaveInterval); autosaveInterval = null; }
}

async function deleteDraft() {
  if (!issue) return;
  if (!confirm(`Delete draft for ${issue.date}? This cannot be undone.`)) return;
  await fetch(`/api/issues/${issue.slug}`, { method: 'DELETE' });
  stopAutosave();
  issue = null;
  await loadDashboard();
  showView('dashboard');
  toast('Draft deleted');
}

// ── Style logging ──────────────────────────────────────────────────────────
async function logEdit(original, edited, reason, context) {
  if (original === edited) return;
  await fetch('/api/issues/log-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original, edited, reason, context }),
  });
}

// ── Social posts ───────────────────────────────────────────────────────────
async function generateSocial() {
  const panel = document.getElementById('social-panel');
  const output = document.getElementById('social-output');
  panel.style.display = '';
  output.innerHTML = '<p style="color:#888;font-size:13px">Generating…</p>';

  try {
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: buildIssuePayload() }),
    });
    const { posts } = await res.json();
    output.innerHTML = '';
    posts.forEach(post => {
      const block = document.createElement('div');
      block.innerHTML = `<div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #eee">
        <div style="font-weight:700;margin-bottom:8px;font-size:13px">${esc(post.category)}</div>
        ${Object.entries(post.platforms).map(([platform, text]) => `
          <div class="social-item">
            <div class="platform">${platform}</div>
            <textarea rows="3">${esc(text)}</textarea>
            <button class="btn-copy" onclick="copyText(this, ${JSON.stringify(text).replace(/"/g, '&quot;')})">Copy</button>
          </div>
        `).join('')}
      </div>`;
      output.appendChild(block);
    });
  } catch (e) {
    output.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

function closeSocial() {
  document.getElementById('social-panel').style.display = 'none';
}

function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
  });
}

// ── Send / Publish ─────────────────────────────────────────────────────────
async function sendTest() {
  const subject = document.getElementById('issue-subject').value || '(no subject)';
  toast('Sending test email…');
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: buildIssuePayload(), subject, testOnly: true }),
    });
    const data = await res.json();
    if (data.ok) toast('Test email sent to your inbox');
    else toast('Error: ' + data.error);
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

async function pushToSite() {
  const subject = document.getElementById('issue-subject').value;
  if (!subject) { toast('Add a subject line before pushing'); return; }

  toast('Pushing to site…');
  try {
    await saveDraftQuiet();
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: buildIssuePayload(), subject, siteOnly: true }),
    });
    const data = await res.json();
    if (data.ok) {
      showSiteLinks(data.urls);
      toast('Pages pushed — ready to proof!');
    } else {
      toast('Error: ' + data.error);
    }
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

function showSiteLinks(urls) {
  const panel = document.getElementById('site-links-panel');
  let html = `<span style="color:#888;font-size:12px">Allow ~60s for Vercel to deploy, then:</span>
    <a href="${urls.issue}" target="_blank">Issue page</a>`;
  for (const p of urls.deepPages) {
    html += `<a href="${p.url}" target="_blank">${esc(p.category)}</a>`;
  }
  panel.innerHTML = html;
  panel.style.display = 'flex';
}

async function sendEmail() {
  const subject = document.getElementById('issue-subject').value;
  if (!subject) { toast('Add a subject line before sending'); return; }
  const subCount = document.getElementById('sub-count').textContent;
  if (!confirm(`Send "${subject}" to ${subCount} subscribers?\n\nThis cannot be undone.`)) return;

  toast('Sending…');
  try {
    const payload = buildIssuePayload();
    payload.status = 'published';
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: payload, subject, emailOnly: true }),
    });
    const data = await res.json();
    if (data.ok) {
      issue.status = 'published';
      await saveDraftQuiet();
      toast(data.warning || 'Email sent!');
    } else {
      toast('Error: ' + data.error);
    }
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

// ── Subscribers ────────────────────────────────────────────────────────────
async function loadSubscribers() {
  const res = await fetch('/api/subscribers');
  const list = await res.json();
  document.getElementById('sub-count').textContent = list.length;
  document.getElementById('sub-count-big').textContent = list.length;
  const ul = document.getElementById('sub-list');
  ul.innerHTML = list.length === 0
    ? '<li class="empty">No subscribers yet</li>'
    : list.map(email => `
        <li>
          <span>${esc(email)}</span>
          <button class="remove-btn" onclick="removeSubscriber('${esc(email)}')">Remove</button>
        </li>`).join('');
}

async function addSubscriber() {
  const input = document.getElementById('sub-email-input');
  const email = input.value.trim();
  if (!email) return;
  const res = await fetch('/api/subscribers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.ok) { input.value = ''; loadSubscribers(); toast('Subscriber added'); }
  else toast('Invalid email');
}

async function removeSubscriber(email) {
  if (!confirm(`Remove ${email} from your subscriber list?\n\nThis won't send them any notification.`)) return;
  await fetch('/api/subscribers', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  loadSubscribers();
  toast('Removed');
}

async function syncFromFormspree() {
  toast('Syncing from Formspree…');
  try {
    const res = await fetch('/api/subscribers/sync', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      if (document.getElementById('sub-count')) loadSubscribers();
      loadSubscriberCount();
      const msg = `Synced — ${data.added} added${data.removed ? `, ${data.removed} unsubscribed` : ''} (${data.total} total)`;
      toast(msg);
    } else {
      toast('Sync failed: ' + data.error);
    }
  } catch (err) {
    toast('Sync error: ' + err.message);
  }
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function showStatus(msg) {
  document.getElementById('save-status').textContent = msg;
}
