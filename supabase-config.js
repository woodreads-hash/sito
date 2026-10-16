// Supabase cloud backend (publishable anon key is safe for read/public + RLS-protected operations)
window.SUPABASE_URL = 'https://yqksdpgkktgppxzdbbgc.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC';
window.SUPABASE_TABLE = 'blog_posts';
window.CALENDAR_TABLE = 'day_configs';

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
