// Le rotte pubbliche sono /.netlify/functions/<nome> (usate dal frontend)
// e /api/<nome> (rotte native Vercel). Ogni funzione raggruppa piu' endpoint
// dello stesso dominio: la sotto-rotta viene ricavata dall'URL originale.
const PREFIXES = ['/.netlify/functions', '/api'];

function requestPath(req) {
  const raw = String((req && req.url) || '');
  return raw.split('?')[0].split('#')[0];
}

// '/categories' per la funzione blog.js quando arriva /blog/categories
function subPath(req, name) {
  const path = requestPath(req);
  for (const prefix of PREFIXES) {
    const base = prefix + '/' + name;
    if (path === base) return '';
    if (path.startsWith(base + '/')) return path.slice(base.length);
  }
  return '';
}

module.exports = { PREFIXES, requestPath, subPath };
