const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/youtube-stats');

module.exports = adapt(handler, '/.netlify/functions/youtube-stats');
