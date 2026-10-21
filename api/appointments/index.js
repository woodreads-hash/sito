const adapt = require('../_lib/vercel-adapter');
const { handler } = require('../../netlify/functions/appointments');

module.exports = adapt(handler, '/.netlify/functions/appointments');
