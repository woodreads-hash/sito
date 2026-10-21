// Netlify Function — Social Media Stats proxy
// Backend opzionale: senza STRAPI_URL il frontend tiene la cache locale.
const { hasBackend, apiUrl, isBackendError } = require('../strapi');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  if (!hasBackend()) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: 'backend social non configurato' }),
    };
  }

  try {
    const resp = await fetch(apiUrl('social-stat'));
    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: 'Strapi error' }) };
    }
    const data = await resp.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    if (isBackendError(err)) {
      console.warn('[social-stats] backend non raggiungibile:', err.message);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: 'backend social non raggiungibile' }),
      };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
