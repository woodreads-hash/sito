const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/appointments');

module.exports = adapt(handler, '/.netlify/functions/appointments');
