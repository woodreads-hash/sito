// Backend Strapi opzionale.
//
// Il sito resta funzionante anche senza Strapi: in quel caso le API rispondono
// con payload validi ma vuoti e il contenuto reale arriva da Supabase/localStorage.
// Se STRAPI_URL e' impostata ma il backend non risponde, il comportamento e' lo
// stesso (modalita' degradata) invece di restituire un errore 500.
const RAW_URL = (process.env.STRAPI_URL || '').trim();
const STRAPI_URL = RAW_URL ? RAW_URL.replace(/\/+$/, '') : '';

const NETWORK_ERRORS = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
];

function hasBackend() {
  return !!STRAPI_URL;
}

function apiUrl(path) {
  if (!STRAPI_URL) return null;
  return `${STRAPI_URL}/api/${path}`;
}

function isBackendError(err) {
  if (!err) return true;
  const cause = err.cause || {};
  const codes = [err.code, cause.code];
  if (codes.some((code) => code && NETWORK_ERRORS.includes(code))) return true;
  return /fetch failed|ENOTFOUND|ECONNREFUSED|socket hang up|network/i.test(err.message || '');
}

module.exports = { STRAPI_URL, hasBackend, apiUrl, isBackendError };
