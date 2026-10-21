const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/day-overrides');

module.exports = adapt(handler, '/.netlify/functions/day-overrides');
