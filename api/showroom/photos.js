const adapt = require('../_lib/vercel-adapter');
const { handler } = require('../_lib/handlers/showroom');

module.exports = adapt(handler, '/.netlify/functions/showroom/photos');
