const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/day-notes');

module.exports = adapt(handler, (req) => {
  const raw = req.query && req.query.date;
  const date = Array.isArray(raw) ? raw[0] : raw;
  return '/.netlify/functions/day-notes' + (date ? '/' + encodeURIComponent(String(date)) : '');
});
