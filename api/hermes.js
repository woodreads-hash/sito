const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/hermes');

module.exports = adapt(handler, '/api/hermes');
