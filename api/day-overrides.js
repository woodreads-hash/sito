const adapt = require('./_lib/vercel-adapter');
const { handler } = require('../netlify/functions/day-overrides');

module.exports = adapt(handler, '/.netlify/functions/day-overrides');
