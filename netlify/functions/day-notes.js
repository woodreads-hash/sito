// Netlify Function — Day Notes (persisted in Strapi DayConfig)
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

function cors(headers) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

async function strapiFetch(path, opts = {}) {
  return fetch(`${STRAPI_URL}/api/${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

async function findByDate(date) {
  const r = await strapiFetch(`day-configs?filters[date][$eq]=${encodeURIComponent(date)}`);
  const d = await r.json();
  const item = (d.data || [])[0];
  if (!item) return null;
  return { id: item.id, ...(item.attributes || item) };
}

async function upsert(date, { note, closed }) {
  const cfg = await findByDate(date);
  const currentClosed = cfg ? !!cfg.closed : false;
  const currentNote = cfg ? (cfg.note || null) : null;
  const payload = {
    data: {
      date,
      closed: closed !== undefined ? !!closed : currentClosed,
      note: note !== undefined ? (note ? String(note).trim() : null) : currentNote,
    },
  };
  let r;
  if (cfg) {
    r = await strapiFetch(`day-configs/${cfg.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    r = await strapiFetch('day-configs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
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

  const path = event.path.replace(/^\/\.netlify\/functions\/day-notes\/?/, '');
  const method = event.httpMethod;

  try {
    if (method === 'GET') {
      const configs = await allConfigs();
      const notes = {};
      configs.forEach((c) => {
        if (c.note) notes[c.date] = c.note;
      });
      return { statusCode: 200, headers: cors({}), body: JSON.stringify(notes) };
    }

    if (method === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const { date, note } = body;
      if (!date) return { statusCode: 400, headers: cors({}), body: JSON.stringify({ error: 'date required' }) };
      const cfg = await upsert(date, { note: note ? String(note) : null });
      return { statusCode: 200, headers: cors({}), body: JSON.stringify({ ok: true, note: cfg.note || null }) };
    }

    if (method === 'DELETE') {
      const raw = path || event.queryStringParameters?.date || '';
      const date = decodeURIComponent(raw);
      if (!date) return { statusCode: 400, headers: cors({}), body: JSON.stringify({ error: 'date required' }) };
      await upsert(date, { note: null });
      return { statusCode: 200, headers: cors({}), body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: cors({}), body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: cors({}), body: JSON.stringify({ error: err.message }) };
  }
};
