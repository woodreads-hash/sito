const adapt = require('../_lib/vercel-adapter');
const { handler } = require('../_lib/handlers/blog');

module.exports = adapt(handler, '/.netlify/functions/blog/categories');
