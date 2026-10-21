const adapt = require('./_lib/vercel-adapter');
const { handler } = require('../netlify/functions/day-bands');

module.exports = adapt(handler, '/.netlify/functions/day-bands');
