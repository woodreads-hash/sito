# Deploy notes

## Target: Vercel (primary)

The site is a static frontend plus serverless functions, deployed as a single Vercel
project with the **"Other"** framework preset (classic model: static output from the
project root + Vercel Functions built from the `api/` directory).

### Why not the "Services" model
With the *Services* preset Vercel refuses to build the project-level `api/` directory
("The `api/` directory will not be built because services are configured") and the
per-service configuration cannot select the `@vercel/node` builder that turns `api/*.js`
into functions — a service rooted at `api/` is detected as a plain static service.
The classic model builds `api/**/*.js` as Vercel Functions out of the box, which is
exactly the Netlify layout this site already had.

### Routing (top level of `vercel.json`)
- `/.netlify/functions/*` → `/api/*` (the frontend keeps calling the old Netlify paths,
  so no frontend code changes are needed)
- `/.netlify/functions/<domain>/<sub-rotta>` → `/api/<domain>` for the grouped
  endpoints (`blog/categories`, `blog/post`, `showroom/categories`, `showroom/photos`,
  `appointments/slots`): one function per domain, to stay under the Hobby limit of
  12 Serverless Functions per deployment
- `/wd-panel-x7q9` → `/admin.html` (secret admin URL)
- `/admin` is **not** a file, so it answers `404` with the styled `404.html`.
- `/netlify/*` is redirected to `404` and the `netlify/` folder is not uploaded at all
  (see `.vercelignore`), so the server-side sources are never public.

### Deploy steps
1. Import the repo `github.com/woodreads-hash/sito` in Vercel (branch `main`).
2. Set the **Framework Preset to "Other"** (Root Directory = repository root,
   Build Command = empty, Output Directory = `.`).
   With the *Services* preset the project has no buildable API — see above.
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
   - Hermes/channel variables from `.env.example` (`HERMES_*`, `WHATSAPP_*`,
     `INSTAGRAM_*`, `TIKTOK_*`, `META_APP_SECRET`). All are server-side; do not put
     them in `supabase-config.js` or any public table. `SUPABASE_SERVICE_ROLE_KEY` is
     optional but recommended for the Hermes webhook.
4. Deploy. No build command, no build step: the output is the project root (static files)
   plus the functions in `api/`.
5. Attach the domain `woodreads.com` (Settings → Domains) so the site keeps its address.

### Backend attuale
- **Supabase è il backend principale** (il browser interroga direttamente l'API REST):
  `blog_posts` (articoli, media e contatori), `day_configs` (fasce orarie, chiusure,
  note del giorno), `faqs` (domande + statistiche), `gallery_photos` (galleria) e
  `quiz_results` (percorsi anonimi del mini quiz).
- Eseguire `supabase/schema.sql` nella SQL editor di Supabase per creare/aggiornare
  tabelle, policy RLS, bucket `gallery` e funzioni RPC `blog_track_view` /
  `blog_track_time`. Lo script è idempotente e include un articolo dimostrativo
  eliminabile dall'admin.
- Il blog pubblico legge solo `blog_posts.status = 'published'`; l'admin scrive
  direttamente su Supabase. I contatori di visualizzazioni e tempo di lettura sono
  aggiornati con RPC atomiche, senza funzioni serverless aggiuntive.
- **Strapi non è più disponibile**: galleria, slot di prenotazione e contatori social
  hanno fallback (payload vuoti, valori statici, CTA WhatsApp). Le funzioni in
  `api/_lib/handlers/` rispondono 200 con dati vuoti invece di 500.
- La configurazione Supabase (URL + chiave publishable) arriva al browser da
  `/.netlify/functions/supabase-config`, che legge `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` dall'ambiente. `supabase-config.js` applica i valori
  prima di ogni chiamata Supabase (con timeout di 4 s e fallback statici).

### Weekly counters
- `supabase/hermes.sql` adds `weekly_metrics`, `social_stat_snapshots`, the
  `increment_weekly_metric` / `get_weekly_metrics` RPCs and the tracking hooks used by
  blog, FAQ, quiz, gallery, appointments and social stats.
- The week is calculated in `Europe/Rome` and starts on Monday. Every counter can show
  a `+X` badge for the current week; the value resets automatically at the next Monday
  without deleting history.
- Social `+X` values are calculated from the difference between the first and latest
  snapshot of the week. Negative differences are shown as `+0` in the UI.
- The badges are rendered by `window.WD_WEEKLY` in `supabase-config.js`; any dynamic
  admin render can call `WD_WEEKLY.refresh()` after updating the DOM.

### Hermes multi-channel (WhatsApp, Instagram, TikTok)
- The admin section is inside the existing secret panel `/wd-panel-x7q9` → **Hermes**.
  It contains the global kill switch, RAG training, unresolved questions, live chat
  monitor, RLHF corrections, contact rules, channel setup guides and the runtime prompt.
- **Run `supabase/hermes.sql` once in the Supabase SQL Editor** before opening the
  Hermes tab. It is idempotent and is also included at the end of `supabase/schema.sql`.
  It creates the Hermes tables, `pgvector` knowledge base, RLS policies, Realtime
  publication entries and the initial brand/blacklist seeds.
- `api/hermes.js` is the **12th and last** top-level Vercel Function. It handles:
  - `GET /api/hermes?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` (Meta verification)
  - `GET /api/hermes?action=status` (booleans/config state only, no secrets)
  - `POST /api/hermes?channel=whatsapp`
  - `POST /api/hermes?channel=instagram`
  - `POST /api/hermes?channel=tiktok`
- Webhook URLs shown in the panel:
  - `https://www.woodreads.com/api/hermes?channel=whatsapp`
  - `https://www.woodreads.com/api/hermes?channel=instagram`
  - `https://www.woodreads.com/api/hermes?channel=tiktok`
- Credentials are **never** written to public Supabase tables or returned by the status
  endpoint. They live only in Vercel Environment Variables:
  `HERMES_VERIFY_TOKEN`, `META_APP_SECRET`, `WHATSAPP_TOKEN`,
  `WHATSAPP_PHONE_NUMBER_ID`, `INSTAGRAM_TOKEN`, `INSTAGRAM_USER_ID`,
  `TIKTOK_ACCESS_TOKEN`, `TIKTOK_SEND_URL`, `TIKTOK_BUSINESS_ID`,
  `TIKTOK_WEBHOOK_SECRET`, `HERMES_AI_API_KEY` (or `OPENROUTER_API_KEY`),
  `HERMES_AI_BASE_URL`, `HERMES_AI_MODEL`, `PUBLIC_SITE_URL`, `META_API_VERSION`.
  `SUPABASE_SERVICE_ROLE_KEY` is optional but recommended for the webhook; without it
  the function falls back to the publishable key and the permissive prototype RLS.
  `HERMES_AI_BASE_URL` defaults to OpenRouter; for OpenAI set
  `https://api.openai.com/v1` and a compatible `HERMES_AI_MODEL`.
- Meta signature verification is active only when `META_APP_SECRET` is set. The Vercel
  adapter forwards `req.rawBody` when the platform exposes it; otherwise it signs the
  serialized JSON body. If Meta rejects the webhook, leave `META_APP_SECRET` unset until
  the raw-body path is available, or verify through a proxy that preserves raw bytes.
- The first inbound message from a new contact always receives the standard welcome
  message. Later messages use RAG + recent RLHF corrections + the AI model; if the AI
  is not configured or the send fails, the fallback is stored and the question appears
  in **Da chiarire**.
- Channel rules: a blacklist blocks a contact, a whitelist (if any `allow` rule exists
  for that channel) restricts replies to listed contacts. The studio WhatsApp number
  `393485393826` is seeded as blacklisted so the owner does not receive auto-replies.
- TikTok requires an approved **Business Direct Message API** app; until the send
  endpoint is approved, messages are still stored and shown with an “Invio fallito”
  marker.
- The admin login is still client-side. Hermes tables use permissive RLS for this
  prototype; for a real production deployment move admin auth and Hermes writes behind
  a server-side role/API. The panel never displays raw Meta/TikTok/API secrets.
- `hermes/SOUL.md` is excluded from Vercel by `.vercelignore` and is **not** used as the
  runtime prompt. It contains historical payment/bank details: remove or rotate them
  before sharing the repository, and never seed them into Supabase.

### Local development
```bash
# full stack (static files + API functions) with the same routing as production
npx vercel dev -L --listen 3000

# or without the Vercel CLI (same server, no proxy)
node api/_lib/dev-server.js
```
Both serve the site, the `/.netlify/functions/*` API paths and the admin panel.

### Folder map
- `api/` — Vercel functions: **12 file** (il limite Hobby è 12 Serverless Functions per
  deployment). Ogni file è un wrapper sottile che adatta l'handler condiviso alla
  firma Vercel `(req, res)`. `api/hermes.js` è la dodicesima funzione e copre webhook
  WhatsApp/Instagram/TikTok, stato integrazione e risposte AI.
  - `api/blog.js` → `blog`, `blog/categories`, `blog/post`
  - `api/showroom.js` → `showroom/categories`, `showroom/photos`
  - `api/appointments.js` → `appointments`, `appointments/slots`
  - `api/share.js` → HTML Open Graph per crawler social su `/faq/:slug` e `/blog/:slug`
  - `api/hermes.js` → webhook multi-canale Hermes, verifica Meta/TikTok, stato e AI
  - `api/day-notes.js`, `api/day-bands.js`, `api/day-overrides.js`,
    `api/social-stats.js`, `api/youtube-stats.js`, `api/supabase-config.js`, `api/data.js`
  - la sotto-rotta viene ricavata dall'URL originale della richiesta
    (`api/_lib/route.js`), quindi il frontend continua a chiamare
    `/.netlify/functions/<dominio>/<sotto-rotta>` senza modifiche
- `api/_lib/handlers/*.js` — business logic (one handler per endpoint), the single
  source of truth shared by Vercel and Netlify.
- `api/_lib/vercel-adapter.js` — converts a Vercel `(req, res)` call into the Netlify
  `event` shape, so the handlers stay unchanged.
- `api/_lib/route.js` — mapping tra rotta pubblica e sotto-rotta del dominio.
- `api/_lib/dev-server.js` — local dev server (static + API).
- `api/_lib/strapi.js` — optional-backend helper (`hasBackend`, `apiUrl`, `isBackendError`).
- `blog-utils.js` — sanitizzazione HTML, conversione Markdown/plain text, slug, reading time
  e helper YouTube condivisi da admin e pagina articolo.
- `netlify/functions/*.js` — thin Netlify wrappers around the same handlers
  (used by the Netlify fallback deploy).
- `.vercelignore` — keeps `api-gateway/`, `progetto-locale/`, `strapi/`, `hermes/`,
  `nginx/`, `systemd/`, `scripts/`, `prompts/`, `supabase/`, `netlify/` out of the upload.

## Cloud configuration
- Local env: `.env` (gitignored, mai committato) — contiene `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `vercel dev` e `api/_lib/dev-server.js` lo caricano da soli.
- Production env: le stesse due variabili vanno impostate nella dashboard Vercel
  (Project → Settings → Environment Variables). Vanno applicate a **Production, Preview
  e Development**.
- Hermes/channel credentials are server-side only: set `HERMES_VERIFY_TOKEN`,
  `META_APP_SECRET`, `WHATSAPP_*`, `INSTAGRAM_*`, `TIKTOK_*`, `HERMES_AI_*` and
  `PUBLIC_SITE_URL` in Vercel. The panel reads only masked/configured status via
  `/api/hermes?action=status`; it never receives the raw secrets.
- `.env` e `.env.local` sono in `.gitignore` **e** in `.vercelignore`: il file non viene
  committato né pubblicato come file statico.
- HTTPS and secure headers are configured in `vercel.json` (and mirrored in `netlify.toml`).
- Blog, quiz, FAQ and gallery use Supabase directly from the browser. The legacy
  serverless blog endpoints remain available for compatibility but are not used by
  the public pages.

## Admin access
- Public link to `/admin` is removed from the site (`/admin` answers 404).
- Reserved admin URL: `/wd-panel-x7q9`.
- The Hermes tab is inside this panel and is reachable from the top admin navigation.
- Replace hardcoded admin credentials with hashed server-side credentials before production.
  The current login is client-side, so Hermes RLS is permissive for this prototype; do
  not treat it as a hardened multi-user admin.

## Data persistence
- Production data is stored in Supabase: `blog_posts`, `day_configs`, `faqs`,
  `gallery_photos`, `quiz_results`, `weekly_metrics`, `social_stat_snapshots` and the
  Hermes tables (`hermes_settings`, `hermes_channels`, `hermes_conversations`,
  `hermes_messages`, `hermes_unanswered`, `hermes_corrections`,
  `hermes_contact_rules`, `hermes_training_documents`, `hermes_training_chunks`).
- Run `supabase/schema.sql` in the Supabase SQL editor to create/refresh tables, RLS
  policies, the public `gallery` bucket, the `blog_track_view` / `blog_track_time`
  RPC functions, the weekly counters and the Hermes schema. If the database already
  exists, `supabase/hermes.sql` can be run alone for the new section.
- Blog articles are created, edited and deleted from the admin panel directly on
  Supabase. The public blog, article page and homepage preview read only published
  posts; BroadcastChannel, storage events and polling keep open tabs in sync.
- Blog views and reading time are updated through the two RPC functions; the admin
  shows total views, average time and per-article counters.
- Quiz results are inserted directly into `quiz_results`; the admin reads them from
  Supabase and refreshes every 15 seconds while the tab is open.
- Calendar availability, FAQ content and gallery photos are also managed from the
  admin panel and stored in Supabase.
- LocalStorage remains a fallback/cache layer only (FAQ, calendar, gallery, quiz).
  It is not the source of truth for published blog content.

## Fallback: Netlify
Netlify is no longer the target (credits exhausted), but the project still deploys there:
`netlify/functions/*.js` are thin wrappers around the same handlers in `api/_lib/handlers/`
and `netlify.toml` keeps the same redirects and headers. The Hermes wrapper is
`netlify/functions/hermes.js`, and `/api/hermes` is redirected to it so the same admin
and webhook URLs work on both targets.
