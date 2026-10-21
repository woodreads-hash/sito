// Netlify Function — Day Time Bands (persisted in Strapi DayConfig.timeBand)
// Backend opzionale: senza STRAPI_URL la GET risponde vuota e le scritture 503.
const { hasBackend, apiUrl, isBackendError } = require('../lib/strapi');

function cors(headers) {
  return { ...headers, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
}

async function strapiFetch(path, opts = {}) {
  return fetch(apiUrl(path), { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
}

async function findByDate(date) {
  const r = await strapiFetch(`day-configs?filters[date][$eq]=${encodeURIComponent(date)}`);
  const d = await r.json();
  const item = (d.data || [])[0];
  if (!item) return null;
  return { id: item.id, ...(item.attributes || item) };
}

async function upsert(date, { note, closed, timeBand }) {
  const cfg = await findByDate(date);
  const payload = {
    data: {
      date,
      note: note !== undefined ? (note ? String(note) : null) : (cfg ? cfg.note || null : null),
      closed: closed !== undefined ? !!closed : (cfg ? !!cfg.closed : false),
      timeBand: timeBand !== undefined ? (timeBand || null) : (cfg ? cfg.timeBand || null : null),
    },
  };
  let r;
  if (cfg) r = await strapiFetch(`day-configs/${cfg.id}`, { method: 'PUT', body: JSON.stringify(payload) });
  else r = await strapiFetch('day-configs', { method: 'POST', body: JSON.stringify(payload) });
  const d = await r.json();
  const item = d.data || d;
  return item?.attributes ? { id: item.id, ...item.attributes } : (item || {});
}

async function allConfigs() {
  const r = await strapiFetch('day-configs?pagination[pageSize]=1000');
  const d = await r.json();
  return (d.data || []).map((item) => ({ id: item.id, ...(item.attributes || item) }));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors({}) };
  const method = event.httpMethod;
  try {
    if (method === 'GET') {
      if (!hasBackend()) return { statusCode: 200, headers: cors({}), body: JSON.stringify({}) };
      const configs = await allConfigs();
      const bands = {};
      configs.forEach((c) => { if (c.timeBand) bands[c.date] = c.timeBand; });
      return { statusCode: 200, headers: cors({}), body: JSON.stringify(bands) };
    }
    if (method === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const { date, band } = body;
      if (!date) return { statusCode: 400, headers: cors({}), body: JSON.stringify({ error: 'date required' }) };
      if (!hasBackend()) {
        return { statusCode: 503, headers: cors({}), body: JSON.stringify({ error: 'backend non configurato' }) };
      }
      const cfg = await upsert(date, { timeBand: band || null, closed: !band });
      return { statusCode: 200, headers: cors({}), body: JSON.stringify({ ok: true, band: cfg.timeBand || null }) };
    }
    return { statusCode: 405, headers: cors({}), body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    if (isBackendError(err)) {
      console.warn('[day-bands] backend non raggiungibile:', err.message);
      if (method === 'GET') return { statusCode: 200, headers: cors({}), body: JSON.stringify({}) };
      return { statusCode: 503, headers: cors({}), body: JSON.stringify({ error: 'backend non raggiungibile' }) };
    }
    return { statusCode: 500, headers: cors({}), body: JSON.stringify({ error: err.message }) };
  }
};
