const adapt = require('../_lib/vercel-adapter');
const { handler } = require('../../netlify/functions/showroom');

module.exports = adapt(handler, '/.netlify/functions/showroom/categories');
