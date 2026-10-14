// Netlify Function — Blog proxy (Strapi BlogPosts / BlogCategories)
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

function cors(headers) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function sanitizeParam(v, max = 120) {
  if (typeof v !== 'string') return '';
  return v.replace(/[^\w\-. /áàâäãåçéèêëíìîïóòôöõúùûüñ]/gi, '').trim().slice(0, max);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors({}) };

  const path = event.path.replace(/^\/\.netlify\/functions\/blog\/?/, '');
  const method = event.httpMethod;
  const q = event.queryStringParameters || {};

  try {
    // Categories list
    if (path === 'categories') {
      const url = `${STRAPI_URL}/api/blog-categories?sort=name`;
      const r = await fetch(url);
      const d = await r.json();
      return { statusCode: r.status, headers: cors({}), body: JSON.stringify(d) };
    }

    // Single post by slug
    if (path === 'post') {
      const slug = sanitizeParam(q.slug || '');
      if (!slug) {
        return { statusCode: 400, headers: cors({}), body: JSON.stringify({ error: 'slug required' }) };
      }
      const params = new URLSearchParams();
      params.set('filters[slug][$eq]', slug);
      params.set('populate', '*');
      const url = `${STRAPI_URL}/api/blog-posts?${params.toString()}`;
      const r = await fetch(url);
      const d = await r.json();
      return { statusCode: r.status, headers: cors({}), body: JSON.stringify(d) };
    }

    // Posts list (published only when using public role)
    if (path === '' || path === 'posts') {
      const page = Math.max(1, parseInt(q.p || '1', 10) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(q.n || '10', 10) || 10));
      const category = sanitizeParam(q.cat || '');
      const params = new URLSearchParams();
      params.set('populate', '*');
      params.set('sort', 'publishedAt:desc');
      params.set('pagination[page]', page);
      params.set('pagination[pageSize]', pageSize);
      if (category) params.set('filters[category][slug][$eq]', category);
      if (q.search) {
        const s = sanitizeParam(q.search);
        if (s) params.set('filters[title][$containsi]', s);
      }
      const url = `${STRAPI_URL}/api/blog-posts?${params.toString()}`;
      const r = await fetch(url);
      const d = await r.json();
      return { statusCode: r.status, headers: cors({}), body: JSON.stringify(d) };
    }

    return { statusCode: 404, headers: cors({}), body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    return { statusCode: 500, headers: cors({}), body: JSON.stringify({ error: err.message }) };
  }
};
