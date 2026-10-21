// Supabase cloud backend (publishable anon key is safe for read/public + RLS-protected operations)
// Fallback statici: in produzione i valori arrivano dall'ambiente (Vercel)
// tramite /.netlify/functions/supabase-config e sostituiscono questi.
window.SUPABASE_URL = 'https://yqksdpgkktgppxzdbbgc.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC';
window.SUPABASE_TABLE = 'blog_posts';
window.CALENDAR_TABLE = 'day_configs';
window.FAQ_TABLE = 'faqs';

// ── Configurazione dall'ambiente ───────────────────────────────────────────
// Le variabili NEXT_PUBLIC_* non vengono iniettate da sole in un sito statico:
// vengono lette server-side dalla funzione supabase-config e applicate qui
// prima di qualsiasi chiamata a Supabase.
window.SUPABASE_CONFIG_SOURCE = 'static';
window.supabaseConfigReady = (function () {
  var timeout = new Promise(function (resolve) { setTimeout(resolve, 4000); });
  var request = fetch('/.netlify/functions/supabase-config', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg || !cfg.url || !cfg.anonKey) return null;
      if (cfg.url !== window.SUPABASE_URL || cfg.anonKey !== window.SUPABASE_ANON_KEY) {
        window.SUPABASE_URL = cfg.url;
        window.SUPABASE_ANON_KEY = cfg.anonKey;
        window.SUPABASE_CONFIG_SOURCE = 'env';
      }
      return { url: window.SUPABASE_URL, anonKey: window.SUPABASE_ANON_KEY };
    })
    .catch(function () { return null; });
  return Promise.race([request, timeout]);
})();

window.supabaseHeaders = function (extra) {
  return Object.assign({
    'apikey': window.SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }, extra || {});
};

window.supabaseUrl = function (path) {
  return window.SUPABASE_URL + path;
};

window.supabaseFetch = async function (path, options) {
  if (window.supabaseConfigReady) {
    try { await window.supabaseConfigReady; } catch (e) {}
  }
  const response = await fetch(window.supabaseUrl(path), Object.assign({
    headers: window.supabaseHeaders(),
  }, options || {}));
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!response.ok) {
    const message = data && data.message ? data.message : response.statusText;
    throw new Error('Supabase ' + response.status + ': ' + message);
  }
  return data;
};

window.supabaseGetDayConfigs = async function () {
  const rows = await window.supabaseFetch(
    '/rest/v1/' + window.CALENDAR_TABLE + '?select=date,closed,note,time_band'
  );
  const notes = {};
  const overrides = {};
  const bands = {};
  (rows || []).forEach(function (row) {
    if (!row || !row.date) return;
    if (row.note) notes[row.date] = row.note;
    if (row.time_band) bands[row.date] = row.time_band;
    if (row.closed) overrides[row.date] = true;
  });
  return { notes: notes, overrides: overrides, bands: bands };
};

window.supabaseSaveDayConfig = async function (date, patch) {
  if (!date) throw new Error('date required');
  const body = Object.assign({ date: date, updated_at: new Date().toISOString() }, patch || {});
  return window.supabaseFetch(
    '/rest/v1/' + window.CALENDAR_TABLE + '?on_conflict=date',
    {
      method: 'POST',
      headers: window.supabaseHeaders({
        'Prefer': 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(body),
    }
  );
};

window.supabaseGetFaqs = async function () {
  return window.supabaseFetch(
    '/rest/v1/' + window.FAQ_TABLE +
    '?select=id,question,answer,category,sort_order,published,clicks,read_ms,read_count,shares,created_at,updated_at' +
    '&order=sort_order.asc,created_at.asc'
  );
};

window.supabaseSaveFaq = async function (faq, includeStats) {
  if (!faq || !faq.id) throw new Error('faq.id required');
  const row = {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category || '',
    sort_order: Number(faq.sort_order || 0),
    published: faq.published !== false,
    updated_at: new Date().toISOString(),
  };
  if (includeStats) {
    row.clicks = Number(faq.clicks || 0);
    row.read_ms = Number(faq.read_ms || 0);
    row.read_count = Number(faq.read_count || 0);
    row.shares = Number(faq.shares || 0);
  }
  return window.supabaseFetch(
    '/rest/v1/' + window.FAQ_TABLE + '?on_conflict=id',
    {
      method: 'POST',
      headers: window.supabaseHeaders({
        'Prefer': 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(row),
    }
  );
};

window.supabaseDeleteFaq = async function (id) {
  if (!id) throw new Error('faq.id required');
  return window.supabaseFetch(
    '/rest/v1/' + window.FAQ_TABLE + '?id=eq.' + encodeURIComponent(id),
    {
      method: 'DELETE',
      headers: window.supabaseHeaders({ 'Prefer': 'return=minimal' }),
    }
  );
};

window.supabaseTrackFaq = async function (id, deltas) {
  if (!id || !deltas || typeof deltas !== 'object') throw new Error('id e deltas richiesti');
  const allowed = ['clicks', 'shares', 'read_ms', 'read_count'];
  const rows = await window.supabaseFetch(
    '/rest/v1/' + window.FAQ_TABLE +
    '?id=eq.' + encodeURIComponent(id) +
    '&select=clicks,shares,read_ms,read_count'
  );
  const row = rows && rows[0];
  if (!row) return null;
  const patch = { updated_at: new Date().toISOString() };
  allowed.forEach(function (key) {
    const inc = Number(deltas[key] || 0);
    if (inc) patch[key] = Number(row[key] || 0) + inc;
  });
  if (Object.keys(patch).length === 1) return row;
  return window.supabaseFetch(
    '/rest/v1/' + window.FAQ_TABLE + '?id=eq.' + encodeURIComponent(id),
    {
      method: 'PATCH',
      headers: window.supabaseHeaders({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify(patch),
    }
  );
};
