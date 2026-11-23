const SITE = 'https://www.woodreads.com';
const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqksdpgkktgppxzdbbgc.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC');

const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'daily', priority: '0.9' },
  { path: '/faq', changefreq: 'weekly', priority: '0.9' },
  { path: '/gioco/', changefreq: 'weekly', priority: '0.8' },
  { path: '/privacy.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/cookie-policy.html', changefreq: 'yearly', priority: '0.3' },
];

function xmlEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function slugify(text, fallback) {
  const slug = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || String(fallback || 'faq');
}

function isoDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

async function supabaseGet(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(SUPABASE_URL + path, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function sitemapXml() {
  const today = isoDate();
  const [posts, faqs] = await Promise.all([
    supabaseGet('/rest/v1/blog_posts?select=slug,created_at,updated_at&status=eq.published&order=updated_at.desc&limit=1000'),
    supabaseGet('/rest/v1/faqs?select=id,question,published,sort_order,updated_at&order=sort_order.asc&limit=1000'),
  ]);

  const urls = STATIC_PAGES.map((page) => ({
    loc: SITE + page.path,
    lastmod: today,
    changefreq: page.changefreq,
    priority: page.priority,
  }));

  (Array.isArray(posts) ? posts : []).forEach((post) => {
    if (!post || !post.slug) return;
    urls.push({
      loc: SITE + '/blog/' + encodeURIComponent(post.slug),
      lastmod: isoDate(post.updated_at || post.created_at),
      changefreq: 'monthly',
      priority: '0.7',
    });
  });

  (Array.isArray(faqs) ? faqs : []).filter((faq) => faq && faq.published !== false).forEach((faq) => {
    urls.push({
      loc: SITE + '/faq/' + slugify(faq.question, faq.id),
      lastmod: isoDate(faq.updated_at),
      changefreq: 'monthly',
      priority: '0.6',
    });
  });

  const body = urls.map((url) => [
    '  <url>',
    '    <loc>' + xmlEscape(url.loc) + '</loc>',
    '    <lastmod>' + url.lastmod + '</lastmod>',
    '    <changefreq>' + url.changefreq + '</changefreq>',
    '    <priority>' + url.priority + '</priority>',
    '  </url>',
  ].join('\n')).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body + '\n' +
    '</urlset>\n';
}

function robotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /wd-panel-x7q9',
    'Disallow: /admin.html',
    'Disallow: /api/',
    '',
    'Sitemap: ' + SITE + '/sitemap.xml',
    '',
  ].join('\n');
}

module.exports = { SITE, sitemapXml, robotsTxt };
