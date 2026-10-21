const adapt = require('../_lib/vercel-adapter');
const { handler } = require('../../netlify/functions/blog');

module.exports = adapt(handler, '/.netlify/functions/blog/categories');
