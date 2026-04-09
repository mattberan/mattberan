// ── State ──────────────────────────────────────────────────────────────────
const DEFAULT_ITEMS = [
  { id: 1, category: 'The Take',        sentence: '', slug: '', has_deep: true,  deep_content: '', external_link: '' },
  { id: 2, category: 'Something Cool',  sentence: '', slug: '', has_deep: true,  deep_content: '', external_link: '' },
  { id: 3, category: 'Worth Your Time', sentence: '', slug: '', has_deep: false, deep_content: '', external_link: '' },
];

let issue = {
  slug: '',
  date: nextThursday(),
  subject: '',
  preheader: '',
  salutation: '',
  greeting: '',
  items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
};

let previewMode = 'email';
let autosaveTimer = null;
let previewTimer = null;

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('issue-date').value = issue.date;
  issue.slug = dateToSlug(issue.date);
  renderItems();
  await loadDraftPicker();
  await checkForResume();
  scheduleAutosave();
  updatePreview();

  // Wire change listeners
  document.getElementById('issue-date').addEventListener('change', e => {
    issue.date = e.target.value;
    issue.slug = dateToSlug(e.target.value);
    deferPreview();
  });
  document.getElementById('issue-subject').addEventListener('input', e => {
    issue.subject = e.target.value;
  });
  document.getElementById('issue-preheader').addEventListener('input', e => {
    issue.preheader = e.target.value;
    deferPreview();
  });
  document.getElementById('issue-salutation').addEventListener('input', e => {
    issue.salutation = e.target.value;
    deferPreview();
  });
  document.getElementById('issue-greeting').addEventListener('input', e => {
    issue.greeting = e.target.value;
    deferPreview();
  });
});

// ── Date helpers ───────────────────────────────────────────────────────────
function nextThursday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 4=Thu
  const daysUntilThursday = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilThursday);
  return d.toISOString().split('T')[0];
}

function dateToSlug(dateStr) {
  // Format: DDMMYYYY
  const [y, m, d] = dateStr.split('-');
  return `${d}${m}${y}`;
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
      <div class="sentence-row">
        <textarea data-field="sentence" data-idx="${idx}" rows="2">${esc(item.sentence)}</textarea>
        <button class="btn-suggest" data-idx="${idx}" onclick="suggestSentence(${idx})">Suggest</button>
      </div>
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

  // Wire input listeners
  div.querySelectorAll('[data-field]').forEach(el => {
    const field = el.dataset.field;
    const i = parseInt(el.dataset.idx);
    const originalSentence = { value: item.sentence };

    el.addEventListener('input', () => {
      if (field === 'sentence') {
        const prev = originalSentence.value;
        const next = el.value;
        issue.items[i].sentence = next;
        // Auto-slug from sentence
        const slugEl = div.querySelector(`[data-field="slug"]`);
        if (slugEl && (!slugEl.value || slugEl.value === slugify(prev))) {
          slugEl.value = slugify(next);
          issue.items[i].slug = slugify(next);
        }
        // Show why-field if sentence changed from original
        if (next !== prev && prev !== '') {
          document.getElementById(`why-${i}`).style.display = '';
        }
        deferPreview();
      } else if (field === 'why') {
        // Logged on blur
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
          originalSentence.value = current; // reset after logging
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

// ── Slug helper ────────────────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Draft persistence ──────────────────────────────────────────────────────
function buildIssuePayload() {
  return {
    ...issue,
    date: document.getElementById('issue-date').value,
    subject: document.getElementById('issue-subject').value,
    preheader: document.getElementById('issue-preheader').value,
    salutation: document.getElementById('issue-salutation').value,
    greeting: document.getElementById('issue-greeting').value,
  };
}

async function saveDraft() {
  const payload = buildIssuePayload();
  issue = payload;
  const slug = issue.slug || dateToSlug(issue.date);
  issue.slug = slug;
  await fetch(`/api/issues/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(issue),
  });
  showStatus('Draft saved');
  toast('Draft saved');
  await loadDraftPicker();
}

function scheduleAutosave() {
  setInterval(async () => {
    if (!issue.date) return;
    const payload = buildIssuePayload();
    issue = payload;
    await fetch(`/api/issues/${issue.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issue),
    });
    showStatus('Autosaved ' + new Date().toLocaleTimeString());
  }, 60000);
}

async function loadDraftPicker() {
  const picker = document.getElementById('draft-picker');
  const res = await fetch('/api/issues');
  const drafts = await res.json();
  picker.innerHTML = '<option value="">Open draft…</option>' +
    drafts.map(d => `<option value="${d.slug}">${d.date}</option>`).join('');

  picker.onchange = async () => {
    if (!picker.value) return;
    const res = await fetch(`/api/issues/${picker.value}`);
    const data = await res.json();
    loadIssueDraft(data);
    picker.value = '';
  };
}

function loadIssueDraft(data) {
  issue = data;
  document.getElementById('issue-date').value = data.date;
  document.getElementById('issue-subject').value = data.subject || '';
  document.getElementById('issue-preheader').value = data.preheader || '';
  document.getElementById('issue-salutation').value = data.salutation || '';
  document.getElementById('issue-greeting').value = data.greeting || '';
  renderItems();
  updatePreview();
}

async function checkForResume() {
  const todaySlug = dateToSlug(nextThursday());
  const res = await fetch(`/api/issues/${todaySlug}`);
  if (!res.ok) return;
  const data = await res.json();
  const banner = document.getElementById('resume-banner');
  document.getElementById('resume-msg').textContent = `Resume draft from ${data.date}?`;
  banner.style.display = 'flex';
  document.getElementById('resume-yes').onclick = () => {
    loadIssueDraft(data);
    banner.style.display = 'none';
  };
  document.getElementById('resume-no').onclick = () => {
    banner.style.display = 'none';
  };
}

// ── AI suggest ─────────────────────────────────────────────────────────────
async function suggestSentence(idx) {
  const btn = document.querySelector(`[data-idx="${idx}"].btn-suggest`) ||
              document.querySelector(`#item-block-${idx} .btn-suggest`);
  if (btn) { btn.textContent = '…'; btn.classList.add('loading'); }

  const item = issue.items[idx];
  try {
    const res = await fetch('/api/social/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, context: '' }),
    });
    const { suggestion } = await res.json();
    const sentenceEl = document.querySelector(`#item-block-${idx} [data-field="sentence"]`);
    if (sentenceEl) {
      sentenceEl.value = suggestion;
      issue.items[idx].sentence = suggestion;
      deferPreview();
    }
    toast('Suggestion applied');
  } catch (e) {
    toast('Suggest failed: ' + e.message);
  } finally {
    if (btn) { btn.textContent = 'Suggest'; btn.classList.remove('loading'); }
  }
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

async function publish() {
  const subject = document.getElementById('issue-subject').value;
  if (!subject) { toast('Add a subject line before publishing'); return; }
  if (!confirm(`Publish issue ${issue.slug} and send to your full list?`)) return;

  toast('Publishing…');
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: buildIssuePayload(), subject, testOnly: false }),
    });
    const data = await res.json();
    if (data.ok) toast('Published! Pages live + email sent.');
    else toast('Error: ' + data.error);
  } catch (e) {
    toast('Error: ' + e.message);
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
