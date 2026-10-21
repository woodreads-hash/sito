const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/showroom');
const { subPath } = require('./_lib/route');

module.exports = adapt(handler, (req) => '/.netlify/functions/showroom' + subPath(req, 'showroom'));
