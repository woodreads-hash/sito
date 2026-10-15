// Supabase cloud backend (publishable anon key is safe for read/public + RLS-protected operations)
window.SUPABASE_URL = 'https://yqksdpgkktgppxzdbbgc.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC';
window.SUPABASE_TABLE = 'blog_posts';

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
