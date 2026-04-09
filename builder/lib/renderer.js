const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../templates');
const DRAFTS_DIR = path.join(__dirname, '../drafts');
const BASE_URL = process.env.SITE_BASE_URL || 'https://mattberan.com';

function loadTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function itemUrl(issue, item) {
  if (item.has_deep) {
    return `${BASE_URL}/newsletter/${issue.slug}/${item.slug}/`;
  }
  return item.external_link || '#';
}

function renderEmail(issue) {
  let lines = [];
  if (issue.preheader) {
    lines.push(issue.preheader);
    lines.push('');
  }
  lines.push(issue.salutation || 'Hi!');
  lines.push('');
  lines.push(issue.greeting || '');
  lines.push('');

  for (const item of issue.items) {
    lines.push(item.category);
    lines.push(item.sentence);
    lines.push(itemUrl(issue, item));
    lines.push('');
  }

  lines.push("Thanks for subscribing, send to someone or reply with feedback!");
  lines.push('');
  lines.push('/Matt');
  lines.push('');
  lines.push('{{{unsubscribe}}}');

  return lines.join('\n');
}

function renderIssuePage(issue) {
  const tmpl = loadTemplate('issue.html');
  const issueUrl = `${BASE_URL}/newsletter/${issue.slug}/`;

  const itemsHtml = issue.items.map(item => {
    const url = itemUrl(issue, item);
    const target = item.has_deep ? '' : ' target="_blank" rel="noopener"';
    return `
    <article class="item">
      <span class="category">${escapeHtml(item.category)}</span>
      <p class="sentence">${escapeHtml(item.sentence)}</p>
      <a href="${url}"${target}>dig deeper &rarr;</a>
    </article>`;
  }).join('\n');

  const description = issue.items.map(i => i.sentence).join(' ');

  return tmpl
    .replace(/\{\{slug\}\}/g, issue.slug)
    .replace(/\{\{date\}\}/g, issue.date)
    .replace(/\{\{greeting\}\}/g, escapeHtml(issue.greeting || ''))
    .replace(/\{\{items\}\}/g, itemsHtml)
    .replace(/\{\{base_url\}\}/g, BASE_URL)
    .replace(/\{\{issue_url\}\}/g, issueUrl)
    .replace(/\{\{description\}\}/g, escapeHtml(description.slice(0, 160)));
}

function renderDeepPage(issue, item) {
  const tmpl = loadTemplate('deep.html');
  const issueUrl = `${BASE_URL}/newsletter/${issue.slug}/`;
  const pageUrl = `${issueUrl}${item.slug}/`;
  const description = (item.deep_content || '').slice(0, 160).replace(/\n/g, ' ');

  // Convert newlines to paragraphs
  const contentHtml = (item.deep_content || '')
    .split(/\n\n+/)
    .filter(Boolean)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return tmpl
    .replace(/\{\{slug\}\}/g, issue.slug)
    .replace(/\{\{item_slug\}\}/g, item.slug)
    .replace(/\{\{date\}\}/g, issue.date)
    .replace(/\{\{category\}\}/g, escapeHtml(item.category))
    .replace(/\{\{sentence\}\}/g, escapeHtml(item.sentence))
    .replace(/\{\{content\}\}/g, contentHtml)
    .replace(/\{\{base_url\}\}/g, BASE_URL)
    .replace(/\{\{issue_url\}\}/g, issueUrl)
    .replace(/\{\{page_url\}\}/g, pageUrl)
    .replace(/\{\{description\}\}/g, escapeHtml(description));
}

function renderNewsletterIndex() {
  const tmpl = loadTemplate('index.html');
  const issues = getAllIssues();

  const issuesHtml = issues.map(issue => {
    const url = `${BASE_URL}/newsletter/${issue.slug}/`;
    return `
    <article class="issue-item">
      <time datetime="${issue.date}">${formatDate(issue.date)}</time>
      <a href="/newsletter/${issue.slug}/">${escapeHtml(issue.items.map(i => i.sentence).join(' / '))}</a>
    </article>`;
  }).join('\n');

  return tmpl.replace(/\{\{issues\}\}/g, issuesHtml).replace(/\{\{base_url\}\}/g, BASE_URL);
}

function getAllIssues() {
  const siteNewsletterDir = path.join(__dirname, '../../site/newsletter');
  if (!fs.existsSync(siteNewsletterDir)) return [];

  // Read drafts to get issue metadata for any published issues
  const draftsDir = path.join(__dirname, '../drafts');
  if (!fs.existsSync(draftsDir)) return [];

  return fs.readdirSync(draftsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(draftsDir, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

module.exports = { renderEmail, renderIssuePage, renderDeepPage, renderNewsletterIndex };
