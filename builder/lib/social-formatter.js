const BASE_URL = process.env.SITE_BASE_URL || 'https://mattberan.com';

function itemUrl(issue, item) {
  if (item.has_deep) return `${BASE_URL}/bb/${issue.slug}/${item.slug}/`;
  return item.external_link || `${BASE_URL}/bb/${issue.slug}/`;
}

function format(issue) {
  const posts = [];

  for (const item of issue.items) {
    const url = itemUrl(issue, item);

    posts.push({
      item_id: item.id,
      category: item.category,
      platforms: {
        linkedin: `${item.sentence}\n\n${url}\n\n#ITSM #ServiceManagement`,
        bluesky: `${item.sentence}\n\n${url}`,
        community: `${item.category}: ${item.sentence}\n${url}`,
      }
    });
  }

  return posts;
}

module.exports = { format };
