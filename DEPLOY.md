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
- Production data is stored in Supabase (blog posts + calendar day configuration).
- Run `supabase/schema.sql` in the Supabase SQL editor once to create/refresh the
  `blog_posts` and `day_configs` tables (and their RLS policies) before going live.
- Calendar availability (days, time bands, notes) is written by the admin panel to
  Supabase and read by the public calendar in near real time (polling + BroadcastChannel).
- LocalStorage is only a fallback/cache layer and should not be relied on for published content.
