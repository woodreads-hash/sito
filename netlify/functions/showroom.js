// Netlify Function — proxy per Strapi Photo Showroom
// Imposta STRAPI_URL nelle variabili d'ambiente Netlify

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

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

  try {
    let url;

    if (path === 'categories') {
      // GET /api/photo-categories?sort=order
      search.set('sort', 'order');
      url = `${STRAPI_URL}/api/photo-categories?${search}`;
    } else if (path === 'photos') {
      // GET /api/photos?populate=*&sort=order
      search.set('populate', '*');
      search.set('sort', 'featured:desc,order');

      const page = params.p || 1;
      const pageSize = params.n || 20;
      search.set('pagination[page]', page);
      search.set('pagination[pageSize]', pageSize);

      if (params.cat) {
        search.set('filters[category][slug][$eq]', params.cat);
      }

      url = `${STRAPI_URL}/api/photos?${search}`;
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found' }),
      };
    }

    const resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ error: 'Strapi error' }),
      };
    }

    const data = await resp.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
