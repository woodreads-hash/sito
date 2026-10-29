const SITE = 'https://www.woodreads.com';
const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqksdpgkktgppxzdbbgc.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC');
const DEFAULT_IMAGE = 'https://www.woodreads.com/og-default.jpg';

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value, max) {
  const text = stripHtml(value);
  return text.length > max ? text.slice(0, max - 1).trim() + '…' : text;
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

async function findFaq(slug) {
  const rows = await supabaseGet('/rest/v1/faqs?select=id,question,answer,category,published,sort_order&order=sort_order.asc');
  if (!Array.isArray(rows)) return null;
  return rows.find((row) => {
    if (row.published === false) return false;
    return slugify(row.question, row.id) === slug || String(row.id) === slug;
  }) || null;
}

async function findPost(slug) {
  const rows = await supabaseGet('/rest/v1/blog_posts?select=title,slug,excerpt,text,cover_url,category,created_at,updated_at,status&slug=eq.' + encodeURIComponent(slug) + '&status=eq.published&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function absoluteImage(value) {
  const image = String(value || '').trim();
  if (!image) return DEFAULT_IMAGE;
  if (/^https?:\/\//i.test(image)) return image;
  return SITE + (image.charAt(0) === '/' ? image : '/' + image);
}

function socialImage(value) {
  const image = absoluteImage(value);
  return /\.(jpe?g|png|gif)(\?|#|$)/i.test(image) ? image : DEFAULT_IMAGE;
}

function pageHtml({ title, description, url, image, imageAlt, type, published, fallbackUrl, label }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(url);
  const safeImage = escapeHtml(image);
  const safeImageAlt = escapeHtml(imageAlt || title);
  const safeFallback = escapeHtml(fallbackUrl);
  const safeLabel = escapeHtml(label);
  return '<!DOCTYPE html>' +
    '<html lang="it"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>' + safeTitle + '</title>' +
    '<meta name="description" content="' + safeDescription + '"/>' +
    '<meta name="robots" content="noindex, follow"/>' +
    '<link rel="canonical" href="' + safeUrl + '"/>' +
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>' +
    '<meta property="og:site_name" content="WooDreads"/>' +
    '<meta property="og:locale" content="it_IT"/>' +
    '<meta property="og:type" content="' + escapeHtml(type || 'website') + '"/>' +
    '<meta property="og:title" content="' + safeTitle + '"/>' +
    '<meta property="og:description" content="' + safeDescription + '"/>' +
    '<meta property="og:url" content="' + safeUrl + '"/>' +
    '<meta property="og:image" content="' + safeImage + '"/>' +
    '<meta property="og:image:alt" content="' + safeImageAlt + '"/>' +
    (published ? '<meta property="article:published_time" content="' + escapeHtml(published) + '"/>' : '') +
    '<meta name="twitter:card" content="summary_large_image"/>' +
    '<meta name="twitter:title" content="' + safeTitle + '"/>' +
    '<meta name="twitter:description" content="' + safeDescription + '"/>' +
    '<meta name="twitter:image" content="' + safeImage + '"/>' +
    '<meta name="theme-color" content="#0D0D0F"/>' +
    '<style>html,body{margin:0;min-height:100%;background:#0D0D0F;color:#F5F5F7;font-family:system-ui,-apple-system,sans-serif}body{display:flex;align-items:center;justify-content:center;padding:2rem}a{color:#8CFF00}main{max-width:560px;text-align:center}span{display:block;font-size:.7rem;letter-spacing:3px;text-transform:uppercase;color:#B58CFF;margin-bottom:1rem}h1{font-size:1.5rem;line-height:1.2;margin:0 0 1rem}p{color:rgba(245,245,247,.65);line-height:1.7;margin:0 0 1.5rem}</style>' +
    '</head><body><main><span>WooDreads</span><h1>' + safeTitle + '</h1><p>' + safeDescription + '</p><a href="' + safeFallback + '">' + safeLabel + '</a></main>' +
    '<script>location.replace(' + JSON.stringify(fallbackUrl) + ');</script>' +
    '</body></html>';
}

module.exports = async (req, res) => {
  const query = req.query || {};
  const type = String(query.type || '').toLowerCase();
  const slug = String(query.slug || '').trim();
  let title = 'WooDreads — Dreadmaker Roma';
  let description = 'Dreadmaker a Roma dal 2012. Creazione, manutenzione e restauro di dreads naturali e cyberdread.';
  let url = SITE + '/';
  let image = DEFAULT_IMAGE;
  let imageAlt = 'WooDreads — Dreadmaker Roma';
  let published = '';
  let fallbackUrl = SITE + '/';
  let label = 'Apri WooDreads';
  let ogType = 'website';

  if (type === 'faq' && slug) {
    const faq = await findFaq(slug);
    if (faq) {
      const cleanSlug = slugify(faq.question, faq.id);
      title = faq.question + ' — FAQ WooDreads';
      description = truncate(faq.answer, 200);
      url = SITE + '/faq/' + cleanSlug;
      imageAlt = faq.question;
      fallbackUrl = SITE + '/faq.html?slug=' + encodeURIComponent(cleanSlug);
      label = 'Apri la FAQ';
      ogType = 'article';
    } else {
      title = 'FAQ non trovata — WooDreads';
      description = 'Questa FAQ non esiste o è stata spostata. Consulta tutte le domande frequenti.';
      url = SITE + '/faq/' + encodeURIComponent(slug);
      fallbackUrl = SITE + '/faq';
      label = 'Vai alle FAQ';
    }
  } else if (type === 'blog' && slug) {
    const post = await findPost(slug);
    if (post) {
      title = post.title + ' — Blog WooDreads';
      description = truncate(post.excerpt || post.text, 200);
      url = SITE + '/blog/' + encodeURIComponent(post.slug);
      image = socialImage(post.cover_url);
      imageAlt = post.title;
      published = post.created_at || '';
      fallbackUrl = SITE + '/blog-post.html?slug=' + encodeURIComponent(post.slug);
      label = 'Leggi l’articolo';
      ogType = 'article';
    } else {
      title = 'Articolo non trovato — WooDreads';
      description = 'Questo articolo non esiste o è stato spostato. Torna al blog per leggere gli altri contenuti.';
      url = SITE + '/blog/' + encodeURIComponent(slug);
      fallbackUrl = SITE + '/blog';
      label = 'Vai al blog';
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Vary', 'User-Agent');
  res.status(200).send(pageHtml({ title, description, url, image, imageAlt, type: ogType, published, fallbackUrl, label }));
};
