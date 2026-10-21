const adapt = require('./_lib/vercel-adapter');
const { handler } = require('../netlify/functions/youtube-stats');

module.exports = adapt(handler, '/.netlify/functions/youtube-stats');
