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

function renderParagraph(text) {
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  let result = '';
  let lastIdx = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIdx, match.index));
    if (match[1] !== undefined) {
      result += `<strong>${escapeHtml(match[1])}</strong>`;
    } else if (match[2] !== undefined) {
      result += `<em>${escapeHtml(match[2])}</em>`;
    } else if (match[3] !== undefined) {
      result += `<em>${escapeHtml(match[3])}</em>`;
    } else if (match[4] !== undefined) {
      result += `<a href="${match[5]}" target="_blank" rel="noopener">${escapeHtml(match[4])}</a>`;
    } else {
      result += `<a href="${match[6]}" target="_blank" rel="noopener">${escapeHtml(match[6])}</a>`;
    }
    lastIdx = match.index + match[0].length;
  }
  result += escapeHtml(text.slice(lastIdx));
  return result.replace(/\n/g, '<br>');
}

function itemUrl(issue, item) {
  if (item.has_deep) {
    return `${BASE_URL}/bb/${issue.slug}/${item.slug}/`;
  }
  return item.external_link || '#';
}

function renderEmailHtml(issue) {
  const s = 'font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#1a1a1a;margin:0 0 16px 0;';
  let blocks = [];

  blocks.push(`<p style="${s}">${escapeHtml(issue.greeting || '')}</p>`);

  for (const item of issue.items) {
    const url = itemUrl(issue, item);
    const hasLink = item.has_deep || !!item.external_link;
    const linkHtml = hasLink
      ? `<br><a href="${url}" style="color:#1a1a1a;">dig deeper &rarr;</a>`
      : '';
    blocks.push(`<p style="${s}">## ${escapeHtml(item.category)}<br>${escapeHtml(item.sentence)}${linkHtml}</p>`);
  }

  const outroHtml = issue.outro
    ? escapeHtml(issue.outro).replace(/\n/g, '<br>')
    : 'Thanks for subscribing, send to someone or reply with feedback!<br>/Matt';
  blocks.push(`<p style="${s}">${outroHtml}</p>`);
  blocks.push(`<p style="font-family:Georgia,serif;font-size:12px;color:#888;margin:0;">To unsubscribe: <a href="{{UNSUBSCRIBE_LINK}}" style="color:#888;">click here</a></p>`);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:24px;background:#fff;">${blocks.join('\n')}</body></html>`;
}

function renderEmail(issue) {
  let lines = [];
  lines.push(issue.greeting || '');
  lines.push('');

  for (const item of issue.items) {
    lines.push(`## ${item.category}`);
    lines.push(item.sentence);
    const url = itemUrl(issue, item);
    if (url !== '#') lines.push(url);
    lines.push('');
  }

  if (issue.outro) {
    lines.push(issue.outro);
  } else {
    lines.push("Thanks for subscribing, send to someone or reply with feedback!");
    lines.push('');
    lines.push('/Matt');
  }
  lines.push('');
  lines.push('To unsubscribe: {{UNSUBSCRIBE_LINK}}');

  return lines.join('\n');
}

function renderIssuePage(issue) {
  const tmpl = loadTemplate('issue.html');
  const issueUrl = `${BASE_URL}/bb/${issue.slug}/`;

  const itemsHtml = issue.items.map(item => {
    const url = itemUrl(issue, item);
    const hasLink = item.has_deep || !!item.external_link;
    const target = item.has_deep ? '' : ' target="_blank" rel="noopener"';
    const linkHtml = hasLink ? `<a href="${url}"${target}>dig deeper &rarr;</a>` : '';
    return `
    <article class="item">
      <span class="category">${escapeHtml(item.category)}</span>
      <p class="sentence">${escapeHtml(item.sentence)}</p>
      ${linkHtml}
    </article>`;
  }).join('\n');

  const description = issue.items.map(i => i.sentence).join(' ');
  const outroHtml = issue.outro
    ? `<p class="issue-outro">${escapeHtml(issue.outro).replace(/\n/g, '<br>')}</p>`
    : '';

  return tmpl
    .replace(/\{\{slug\}\}/g, issue.slug)
    .replace(/\{\{date\}\}/g, issue.date)
    .replace(/\{\{subject\}\}/g, escapeHtml(issue.subject || ''))
    .replace(/\{\{greeting\}\}/g, escapeHtml(issue.greeting || ''))
    .replace(/\{\{items\}\}/g, itemsHtml)
    .replace(/\{\{outro\}\}/g, outroHtml)
    .replace(/\{\{base_url\}\}/g, BASE_URL)
    .replace(/\{\{issue_url\}\}/g, issueUrl)
    .replace(/\{\{description\}\}/g, escapeHtml(description.slice(0, 160)));
}

function renderDeepPage(issue, item) {
  const tmpl = loadTemplate('deep.html');
  const issueUrl = `${BASE_URL}/bb/${issue.slug}/`;
  const pageUrl = `${issueUrl}${item.slug}/`;
  const description = (item.deep_content || '').slice(0, 160).replace(/\n/g, ' ');

  const contentHtml = (item.deep_content || '')
    .split(/\n\n+/)
    .filter(Boolean)
    .map(p => {
      const imgMatch = p.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        return `<figure><img src="${escapeHtml(imgMatch[2])}" alt="${escapeHtml(imgMatch[1])}" loading="lazy"></figure>`;
      }
      return `<p>${renderParagraph(p)}</p>`;
    })
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
  return tmpl.replace(/\{\{base_url\}\}/g, BASE_URL);
}

function renderArchive() {
  const issues = getAllIssues();
  const issuesHtml = issues.map(issue => {
    const title = escapeHtml(issue.subject || issue.date);
    return `
    <article class="issue-item">
      <time datetime="${issue.date}">${formatDate(issue.date)}</time>
      <a href="/bb/${issue.slug}/">${title}</a>
    </article>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Beran Brief — Archive</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/styles/main.css">
</head>
<body>
<header>
  <a href="/" class="home-link">Matt Beran</a>
</header>
<main class="newsletter-index">
  <h1>The Beran Brief</h1>
  <p class="tagline">Everything you need to know. Nothing you don't.</p>
  <section class="issue-list">
    <h2>All issues</h2>
    ${issuesHtml}
  </section>
</main>
<footer>
  <p>&copy; Matt Beran</p>
</footer>
</body>
</html>`;
}

function getAllIssues() {
  const siteBBDir = path.join(__dirname, '../../site/bb');
  if (!fs.existsSync(siteBBDir)) return [];

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

module.exports = { renderEmail, renderEmailHtml, renderIssuePage, renderDeepPage, renderNewsletterIndex, renderArchive };
