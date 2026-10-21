const adapt = require('./_lib/vercel-adapter');
const { handler } = require('./_lib/handlers/supabase-config');

module.exports = adapt(handler, '/.netlify/functions/supabase-config');
