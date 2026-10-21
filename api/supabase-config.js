const adapt = require('./_lib/vercel-adapter');
const { handler } = require('../netlify/functions/supabase-config');

module.exports = adapt(handler, '/.netlify/functions/supabase-config');
