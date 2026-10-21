const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/appointments');
const { subPath } = require('./_lib/route');

module.exports = adapt(handler, (req) => '/.netlify/functions/appointments' + subPath(req, 'appointments'));
