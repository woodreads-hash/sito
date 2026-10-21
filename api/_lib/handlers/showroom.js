// Netlify Function — proxy per Strapi Photo Showroom
// Backend opzionale: senza STRAPI_URL risponde con collezioni vuote.
const { hasBackend, apiUrl, isBackendError } = require('../strapi');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const path = event.path.replace(/^\/\.netlify\/functions\/showroom\//, '');
  const params = event.queryStringParameters || {};
  const search = new URLSearchParams();

  const page = Math.max(1, parseInt(params.p || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.n || '20', 10) || 20));

  const emptyCategories = () => ({ data: [] });
  const emptyPhotos = () => ({
    data: [],
    meta: { pagination: { page, pageSize, pageCount: 1, total: 0 } },
  });

  try {
    let url;
    let isPhotos = false;

    if (path === 'categories') {
      // GET /api/photo-categories?sort=order
      search.set('sort', 'order');
      url = apiUrl(`photo-categories?${search}`);
    } else if (path === 'photos') {
      // GET /api/photos?populate=*&sort=order
      isPhotos = true;
      search.set('populate', '*');
      search.set('sort', 'featured:desc,order');
      search.set('pagination[page]', page);
      search.set('pagination[pageSize]', pageSize);

      if (params.cat) {
        search.set('filters[category][slug][$eq]', params.cat);
      }

      url = apiUrl(`photos?${search}`);
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found' }),
      };
    }

    if (!url) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(isPhotos ? emptyPhotos() : emptyCategories()),
      };
    }

    const resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!resp.ok) {
      console.warn('[showroom] backend non valido, risposta vuota');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(isPhotos ? emptyPhotos() : emptyCategories()),
      };
    }

    const data = await resp.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    if (isBackendError(err)) {
      console.warn('[showroom] backend non raggiungibile:', err.message);
      const isPhotos = path === 'photos';
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(isPhotos ? emptyPhotos() : emptyCategories()),
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
