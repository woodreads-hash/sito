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
- Production data is stored in Supabase (blog posts + calendar day configuration + FAQ).
- Run `supabase/schema.sql` in the Supabase SQL editor once to create/refresh the
  `blog_posts`, `day_configs` and `faqs` tables (and their RLS policies) before going live.
- Calendar availability (days, time bands, notes) is written by the admin panel to
  Supabase and read by the public calendar in near real time (polling + BroadcastChannel).
- FAQ content is managed from the admin tab “FAQ” and stored in the `faqs` table. The 30
  default questions live in `faq-data.js` (`window.WD_DEFAULT_FAQS`) and are shared by the
  site and the admin panel. The public page also tracks openings, reading time and shares;
  counters are written back to Supabase and mirrored to LocalStorage as a fallback.
- LocalStorage is only a fallback/cache layer and should not be relied on for published content.
- If Supabase is unreachable, the FAQ admin keeps working in LocalStorage and the
  “Sincronizza al cloud” button re-uploads all questions once the backend is available.
