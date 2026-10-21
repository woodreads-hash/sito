const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/social-stats');

module.exports = adapt(handler, '/.netlify/functions/social-stats');
