// Netlify Function — Blog proxy (Strapi BlogPosts / BlogCategories)
// Backend opzionale: senza STRAPI_URL il proxy risponde con liste vuote.
const { hasBackend, apiUrl, isBackendError } = require('../strapi');

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

function emptyCategories() {
  return { data: [] };
}

function emptyPost() {
  return { data: null };
}

function emptyList(page, pageSize) {
  return {
    data: [],
    meta: { pagination: { page, pageSize, pageCount: 1, total: 0 } },
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors({}) };

  const path = event.path.replace(/^\/\.netlify\/functions\/blog\/?/, '');
  const method = event.httpMethod;
  const q = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(q.p || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(q.n || '10', 10) || 10));

  const emptyFor = () => {
    if (path === 'categories') return emptyCategories();
    if (path === 'post') return emptyPost();
    return emptyList(page, pageSize);
  };

  try {
    // Categories list
    if (path === 'categories') {
      if (!hasBackend()) return { statusCode: 200, headers: cors({}), body: JSON.stringify(emptyCategories()) };
      const r = await fetch(apiUrl('blog-categories?sort=name'));
      if (!r.ok) {
        console.warn('[blog] backend categorie non valido, risposta vuota');
        return { statusCode: 200, headers: cors({}), body: JSON.stringify(emptyCategories()) };
      }
      const d = await r.json();
      return { statusCode: 200, headers: cors({}), body: JSON.stringify(d) };
    }

    // Single post by slug
    if (path === 'post') {
      const slug = sanitizeParam(q.slug || '');
      if (!slug) {
        return { statusCode: 400, headers: cors({}), body: JSON.stringify({ error: 'slug required' }) };
      }
      if (!hasBackend()) return { statusCode: 200, headers: cors({}), body: JSON.stringify(emptyPost()) };
      const params = new URLSearchParams();
      params.set('filters[slug][$eq]', slug);
      params.set('populate', '*');
      const r = await fetch(apiUrl(`blog-posts?${params.toString()}`));
      if (!r.ok) {
        console.warn('[blog] backend post non valido, risposta vuota');
        return { statusCode: 200, headers: cors({}), body: JSON.stringify(emptyPost()) };
      }
      const d = await r.json();
      return { statusCode: 200, headers: cors({}), body: JSON.stringify(d) };
    }

    // Posts list (published only when using public role)
    if (path === '' || path === 'posts') {
      if (!hasBackend()) {
        return { statusCode: 200, headers: cors({}), body: JSON.stringify(emptyList(page, pageSize)) };
      }
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
      const r = await fetch(apiUrl(`blog-posts?${params.toString()}`));
      if (!r.ok) {
        console.warn('[blog] backend lista non valido, risposta vuota');
        return { statusCode: 200, headers: cors({}), body: JSON.stringify(emptyList(page, pageSize)) };
      }
      const d = await r.json();
      return { statusCode: 200, headers: cors({}), body: JSON.stringify(d) };
    }

    return { statusCode: 404, headers: cors({}), body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    if (isBackendError(err)) {
      console.warn('[blog] backend non raggiungibile:', err.message);
      return { statusCode: 200, headers: cors({}), body: JSON.stringify(emptyFor()) };
    }
    return { statusCode: 500, headers: cors({}), body: JSON.stringify({ error: err.message }) };
  }
};
