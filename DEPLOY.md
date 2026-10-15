# Deploy notes

## Cloud configuration
- Set environment variables from `.env.example` in Netlify/Vercel dashboard.
- HTTPS and secure headers are configured in `netlify.toml`.
- Backend blog endpoints are proxied through Netlify Functions to Strapi.

## Admin access
- Public link to `/admin` is removed from the site.
- Reserved admin URL: `/wd-panel-x7q9` (configure your preferred secret path).
- Replace hardcoded admin credentials with hashed server-side credentials before production.

## Data persistence
- Production blog data should be stored in Strapi/Supabase.
- LocalStorage is only a fallback/demo layer and should not be relied on for published content.
