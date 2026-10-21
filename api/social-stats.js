const adapt = require('./_lib/vercel-adapter');
const { handler } = require('../netlify/functions/social-stats');

module.exports = adapt(handler, '/.netlify/functions/social-stats');
