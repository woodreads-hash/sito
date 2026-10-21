# Deploy notes

## Target: Vercel (primary)

The site is a static frontend plus serverless functions, deployed as a single Vercel
**Services** project.

### Services model
- **One service: `site`** — `root: "."`. It serves the static site (HTML/CSS/JS/images) and
  the API functions declared in `api/`.
- **No bindings.** Every backend call goes to an external service (Strapi, Supabase,
  YouTube Data API), never to another service of this project, so there is nothing to bind.
- **Public routing (top level of `vercel.json`)**
  - `/.netlify/functions/*` → `/api/*` (the frontend keeps calling the old Netlify paths,
    so no frontend code changes are needed)
  - `/wd-panel-x7q9` → `/admin.html` (secret admin URL)
  - `/(.*)` → the `site` service
- **Internal routing (inside the `site` service)**: the same rules, so the API and the
  admin URL keep working regardless of which layer resolves the request first.
- `/admin` is **not** a file, so it answers `404` with the styled `404.html`.
- `/netlify/*` is redirected to `404` so the Netlify function sources are never public.

### Deploy steps
1. Import the repo `github.com/woodreads-hash/sito` in Vercel (branch `main`).
2. Set the **Framework Preset to "Services"** (required: the repo contains more than one
   deployable folder, so Vercel asks for a `vercel.json` describing the services).
3. Add the environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` — **Supabase project URL** (default: `https://yqksdpgkktgppxzdbbgc.supabase.co`).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase **publishable** (anon) key.
     Both are read server-side by the function `/.netlify/functions/supabase-config` and
     handed to the browser, because in a static site the `NEXT_PUBLIC_` prefix alone does
     not inject anything into the client. The same values live in the local `.env` file
     (never committed) and in `supabase-config.js` as fallback, so the site works even
     if the dashboard variables are missing.
   - `STRAPI_URL` — **optional, leave empty**. Public URL of a Strapi instance. Only needed for the
     gallery, the appointment slots and the live social counters. When it is not set (or
     unreachable) the API answers with empty payloads and the site keeps working with
     Supabase + LocalStorage (see “Backend attuale”).
   - `YOUTUBE_API_KEY` — YouTube Data API key (channel stats). Optional.
   - `YOUTUBE_CHANNEL_ID` and/or `YOUTUBE_HANDLE` — which channel to read.
4. Deploy. No build command, no build step: the service is plain static output + functions.
5. Attach the domain `woodreads.com` (Settings → Domains) so the site keeps its address.

### Backend attuale
- **Supabase è il backend principale** (il browser interroga direttamente l'API REST):
  `day_configs` (fasce orarie, chiusure, note del giorno) e `blog_posts` (articoli).
  La tabella `faqs` non esiste ancora nel progetto: eseguire `supabase/schema.sql`
  nella SQL editor di Supabase per crearla (FAQ in cloud + contatori).
- **Strapi non è più disponibile**: galleria, slot di prenotazione e contatori social
  hanno fallback (payload vuoti, valori statici, CTA WhatsApp). Le funzioni in
  `netlify/functions/` rispondono 200 con dati vuoti invece di 500.
- La configurazione Supabase (URL + chiave publishable) arriva al browser da
  `/.netlify/functions/supabase-config`, che legge `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` dall'ambiente. `supabase-config.js` applica i valori
  prima di ogni chiamata Supabase (con timeout di 4 s e fallback statici).

### Local development
```bash
# full stack (static files + API functions) with the same routing as production
npx vercel dev -L --listen 3000

# or without the Vercel CLI (same server, no proxy)
node api/_lib/dev-server.js
```
Both serve the site, the `/.netlify/functions/*` API paths and the admin panel.

### Folder map
- `api/` — Vercel functions (one file per endpoint). They are thin wrappers around the
  Netlify handlers in `netlify/functions/`.
- `api/_lib/vercel-adapter.js` — converts a Vercel `(req, res)` call into the Netlify
  `event` shape, so `netlify/functions/*.js` stays the single source of truth.
- `api/_lib/dev-server.js` — local dev server (static + API).
- `netlify/functions/*.js` — business logic, unchanged, still used by the Netlify deploy.
- `.vercelignore` — keeps `api-gateway/`, `progetto-locale/`, `strapi/`, `hermes/`,
  `nginx/`, `systemd/`, `scripts/`, `prompts/`, `supabase/` out of the upload.

## Cloud configuration
- Local env: `.env` (gitignored, mai committato) — contiene `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `vercel dev` e `api/_lib/dev-server.js` lo caricano da soli.
- Production env: le stesse due variabili vanno impostate nella dashboard Vercel
  (Project → Settings → Environment Variables). Vanno applicate a **Production, Preview
  e Development**.
- `.env` e `.env.local` sono in `.gitignore` **e** in `.vercelignore`: il file non viene
  committato né pubblicato come file statico.
- HTTPS and secure headers are configured in `vercel.json` (and mirrored in `netlify.toml`).
- Backend blog endpoints are proxied through the serverless functions to Strapi.

## Admin access
- Public link to `/admin` is removed from the site (`/admin` answers 404).
- Reserved admin URL: `/wd-panel-x7q9`.
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

## Fallback: Netlify
Netlify is no longer the target (credits exhausted), but the project still deploys there:
`netlify/functions/*.js` are the untouched Netlify functions and `netlify.toml` keeps the
same redirects and headers.
