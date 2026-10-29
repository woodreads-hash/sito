-- Supabase schema for WooDreads cloud-first blog
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  text text default '',
  category text default '',
  excerpt text default '',
  cover_url text default '',
  video_url text not null default '',
  reading_time integer not null default 5,
  image_name text default '',
  video_name text default '',
  youtube text default '',
  status text not null default 'draft',
  views bigint not null default 0,
  time_on_page bigint not null default 0,
  interactions bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts add column if not exists video_url text not null default '';

create index if not exists blog_posts_status_idx on public.blog_posts (status);
create index if not exists blog_posts_updated_at_idx on public.blog_posts (updated_at desc);

alter table public.blog_posts enable row level security;

-- Demo/dev permissive policies. For hardened production, replace with Supabase Auth role checks.
drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
  on public.blog_posts for select
  using (status = 'published' or true);

drop policy if exists "Admin can write blog posts" on public.blog_posts;
create policy "Admin can write blog posts"
  on public.blog_posts for all
  using (true)
  with check (true);

insert into public.blog_posts
  (title, slug, text, category, excerpt, cover_url, reading_time, status, created_at, updated_at)
values (
  'Guida alla manutenzione dei dreads naturali a Roma: come curarli senza cera',
  'guida-manutenzione-dreads-naturali-roma',
  '<h2>Perché evitare la cera</h2><p>La cera rende i dreads pesanti, pastosi e difficili da lavare. Nel metodo WooDreads la manutenzione si basa su acqua controllata, shampoo delicato, palm rolling e una routine settimanale.</p><img src="https://yqksdpgkktgppxzdbbgc.supabase.co/storage/v1/object/public/gallery/Anna%20Lou%20-%20WooDrdeads.com.webp" alt="Manutenzione dei dreads naturali" loading="lazy"/><h3>Lavaggio corretto</h3><p>Usa uno shampoo leggero due volte, risciacqua abbondantemente e tampona con microfibra. Non coprire il lavoro con prodotti pesanti: l''aria e il movimento fissano la struttura.</p><h2>Routine settimanale</h2><ul><li>Giorno 1: lavaggio delicato.</li><li>Giorno 2: asciugatura completa all''aria.</li><li>Giorno 4: idratazione leggera.</li><li>Giorno 7: controllo radice e palm rolling.</li></ul><p>Con costanza otterrai dreads lucidi, ordinati e senza cera, con meno stress per capelli e cute.</p>',
  'Manutenzione',
  'Scopri come lavare, idratare, proteggere e mantenere sani i dreads naturali senza cera. Una guida pratica passo dopo passo con il metodo WooDreads.',
  'https://yqksdpgkktgppxzdbbgc.supabase.co/storage/v1/object/public/gallery/Afro%20Sottili%20-%20WooDreads.com.webp',
  6,
  'published',
  '2026-01-15T09:00:00Z',
  '2026-01-15T09:00:00Z'
)
on conflict (slug) do nothing;

create table if not exists public.day_configs (
  date text primary key,
  closed boolean not null default false,
  note text,
  time_band text,
  updated_at timestamptz not null default now()
);

create index if not exists day_configs_updated_at_idx on public.day_configs (updated_at desc);

alter table public.day_configs enable row level security;

-- Demo/dev permissive policies. For hardened production, replace with Supabase Auth role checks.
drop policy if exists "Public can read day configs" on public.day_configs;
create policy "Public can read day configs"
  on public.day_configs for select
  using (true);

drop policy if exists "Admin can write day configs" on public.day_configs;
create policy "Admin can write day configs"
  on public.day_configs for all
  using (true)
  with check (true);

create table if not exists public.faqs (
  id text primary key,
  question text not null,
  answer text not null default '',
  category text default '',
  sort_order integer not null default 0,
  published boolean not null default true,
  clicks bigint not null default 0,
  read_ms bigint not null default 0,
  read_count bigint not null default 0,
  shares bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faqs_sort_idx on public.faqs (sort_order asc, created_at asc);

alter table public.faqs enable row level security;

-- Demo/dev permissive policies. For hardened production, replace with Supabase Auth role checks.
drop policy if exists "Public can read faqs" on public.faqs;
create policy "Public can read faqs"
  on public.faqs for select
  using (true);

drop policy if exists "Public can write faqs" on public.faqs;
create policy "Public can write faqs"
  on public.faqs for all
  using (true)
  with check (true);

-- ── Gallery (foto gestite dall'admin) ───────────────────────────────────────
create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  storage_path text,
  bucket text not null default 'gallery',
  title text not null default '',
  description text not null default '',
  category text not null default 'generale',
  tags text[] not null default '{}',
  featured boolean not null default false,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gallery_photos_order_idx on public.gallery_photos (sort_order asc, created_at asc);

alter table public.gallery_photos enable row level security;

-- Demo/dev permissive policies. For hardened production, replace with Supabase Auth role checks.
drop policy if exists "Public can read gallery photos" on public.gallery_photos;
create policy "Public can read gallery photos"
  on public.gallery_photos for select
  using (true);

drop policy if exists "Public can write gallery photos" on public.gallery_photos;
create policy "Public can write gallery photos"
  on public.gallery_photos for all
  using (true)
  with check (true);

-- Bucket pubblico per le immagini caricate dall'admin
insert into storage.buckets (id, name, public, file_size_limit)
values ('gallery', 'gallery', true, 52428800)
on conflict (id) do update set public = true;

drop policy if exists "Public can read gallery objects" on storage.objects;
create policy "Public can read gallery objects"
  on storage.objects for select
  using (bucket_id = 'gallery');

drop policy if exists "Public can upload gallery objects" on storage.objects;
create policy "Public can upload gallery objects"
  on storage.objects for insert
  with check (bucket_id = 'gallery');

drop policy if exists "Public can update gallery objects" on storage.objects;
create policy "Public can update gallery objects"
  on storage.objects for update
  using (bucket_id = 'gallery')
  with check (bucket_id = 'gallery');

drop policy if exists "Public can delete gallery objects" on storage.objects;
create policy "Public can delete gallery objects"
  on storage.objects for delete
  using (bucket_id = 'gallery');

-- ── Risultati quiz (percorsi anonimi) ───────────────────────────────────────
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  result text not null default '',
  consult boolean not null default false,
  path text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists quiz_results_created_at_idx on public.quiz_results (created_at desc);

grant select, insert, delete on public.quiz_results to anon, authenticated;

alter table public.quiz_results enable row level security;

drop policy if exists "Public can read quiz results" on public.quiz_results;
create policy "Public can read quiz results"
  on public.quiz_results for select
  using (true);

drop policy if exists "Public can insert quiz results" on public.quiz_results;
create policy "Public can insert quiz results"
  on public.quiz_results for insert
  with check (true);

drop policy if exists "Admin can delete quiz results" on public.quiz_results;
create policy "Admin can delete quiz results"
  on public.quiz_results for delete
  using (true);

-- ── Contatori blog atomici ──────────────────────────────────────────────────
create or replace function public.blog_track_view(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.blog_posts
  set views = views + 1
  where id = p_post_id;
$$;

create or replace function public.blog_track_time(p_post_id uuid, p_seconds integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.blog_posts
  set time_on_page = time_on_page + greatest(0, least(coalesce(p_seconds, 0), 3600))
  where id = p_post_id;
$$;

grant execute on function public.blog_track_view(uuid) to anon, authenticated;
grant execute on function public.blog_track_time(uuid, integer) to anon, authenticated;

create extension if not exists vector;

create table if not exists public.weekly_metrics (
  metric text not null,
  week_start date not null,
  count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (metric, week_start)
);

create index if not exists weekly_metrics_week_idx on public.weekly_metrics (week_start desc);

create table if not exists public.social_stat_snapshots (
  id bigserial primary key,
  metric text not null,
  value bigint not null,
  captured_at timestamptz not null default now()
);

create index if not exists social_stat_snapshots_metric_idx on public.social_stat_snapshots (metric, captured_at desc);
create index if not exists social_stat_snapshots_captured_idx on public.social_stat_snapshots (captured_at desc);

create or replace function public.increment_weekly_metric(p_metric text, p_amount bigint default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week date := date_trunc('week', (now() at time zone 'Europe/Rome'))::date;
begin
  if p_metric is null or btrim(p_metric) = '' then
    return;
  end if;
  insert into public.weekly_metrics (metric, week_start, count, updated_at)
  values (p_metric, v_week, coalesce(p_amount, 0), now())
  on conflict (metric, week_start) do update
    set count = public.weekly_metrics.count + excluded.count,
        updated_at = now();
end;
$$;

create or replace function public.get_weekly_metrics()
returns table(metric text, count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select wm.metric, wm.count
  from public.weekly_metrics wm
  where wm.week_start = date_trunc('week', (now() at time zone 'Europe/Rome'))::date
  order by wm.metric;
$$;

create or replace function public.record_social_snapshots(p_metrics jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_value numeric;
  v_prev numeric;
  v_prev_at timestamptz;
  v_week date := date_trunc('week', (now() at time zone 'Europe/Rome'))::date;
  v_week_ts timestamptz := (v_week::timestamp at time zone 'Europe/Rome');
begin
  if p_metrics is null or jsonb_typeof(p_metrics) <> 'object' then
    return;
  end if;
  delete from public.social_stat_snapshots where captured_at < now() - interval '90 days';
  for v_key, v_value in
    select key, value::numeric
    from jsonb_each_text(p_metrics)
    where value ~ '^-?[0-9]+([.][0-9]+)?$'
  loop
    select s.value, s.captured_at into v_prev, v_prev_at
    from public.social_stat_snapshots s
    where s.metric = v_key and s.captured_at >= v_week_ts
    order by s.captured_at desc
    limit 1;
    if v_prev is not null and v_prev_at > now() - interval '30 minutes' then
      continue;
    end if;
    if v_prev is not null and v_value <> v_prev then
      insert into public.weekly_metrics (metric, week_start, count, updated_at)
      values ('social:' || v_key, v_week, (v_value - v_prev)::bigint, now())
      on conflict (metric, week_start) do update
        set count = public.weekly_metrics.count + excluded.count,
            updated_at = now();
    end if;
    insert into public.social_stat_snapshots (metric, value) values (v_key, v_value::bigint);
  end loop;
end;
$$;

create or replace function public.faq_track(
  p_id text,
  p_clicks integer default 0,
  p_shares integer default 0,
  p_read_ms integer default 0,
  p_read_count integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.faqs
  set clicks = clicks + greatest(coalesce(p_clicks, 0), 0),
      shares = shares + greatest(coalesce(p_shares, 0), 0),
      read_ms = read_ms + greatest(coalesce(p_read_ms, 0), 0),
      read_count = read_count + greatest(coalesce(p_read_count, 0), 0),
      updated_at = now()
  where id = p_id;
  if not found then
    return;
  end if;
  if coalesce(p_clicks, 0) > 0 then
    perform public.increment_weekly_metric('faq_clicks', p_clicks);
    perform public.increment_weekly_metric('faq_click:' || p_id, p_clicks);
  end if;
  if coalesce(p_shares, 0) > 0 then
    perform public.increment_weekly_metric('faq_shares', p_shares);
    perform public.increment_weekly_metric('faq_share:' || p_id, p_shares);
  end if;
  if coalesce(p_read_ms, 0) > 0 then
    perform public.increment_weekly_metric('faq_read_ms', p_read_ms);
    perform public.increment_weekly_metric('faq_read:' || p_id, p_read_ms);
  end if;
  if coalesce(p_read_count, 0) > 0 then
    perform public.increment_weekly_metric('faq_reads', p_read_count);
  end if;
end;
$$;

create or replace function public.blog_track_view(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.blog_posts set views = views + 1 where id = p_post_id;
  if not found then
    return;
  end if;
  perform public.increment_weekly_metric('blog_views', 1);
  perform public.increment_weekly_metric('blog_view:' || p_post_id::text, 1);
end;
$$;

create or replace function public.blog_track_time(p_post_id uuid, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seconds integer := greatest(0, least(coalesce(p_seconds, 0), 3600));
begin
  update public.blog_posts set time_on_page = time_on_page + v_seconds where id = p_post_id;
  if not found then
    return;
  end if;
  if v_seconds > 0 then
    perform public.increment_weekly_metric('blog_time', v_seconds);
    perform public.increment_weekly_metric('blog_time:' || p_post_id::text, v_seconds);
  end if;
end;
$$;

grant execute on function public.increment_weekly_metric(text, bigint) to anon, authenticated;
grant execute on function public.get_weekly_metrics() to anon, authenticated;
grant execute on function public.record_social_snapshots(jsonb) to anon, authenticated;
grant execute on function public.faq_track(text, integer, integer, integer, integer) to anon, authenticated;
grant execute on function public.blog_track_view(uuid) to anon, authenticated;
grant execute on function public.blog_track_time(uuid, integer) to anon, authenticated;

create table if not exists public.hermes_settings (
  id text primary key default 'global',
  enabled boolean not null default true,
  brand_prompt text not null default '',
  first_message text not null default '',
  fallback_message text not null default '',
  model text not null default 'openrouter/free',
  updated_at timestamptz not null default now()
);

create table if not exists public.hermes_channels (
  channel text primary key,
  enabled boolean not null default false,
  display_name text not null default '',
  external_id text not null default '',
  updated_at timestamptz not null default now(),
  constraint hermes_channels_channel_check check (channel in ('whatsapp', 'instagram', 'tiktok'))
);

create table if not exists public.hermes_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  contact_id text not null,
  contact_name text not null default '',
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  unread_count integer not null default 0,
  needs_attention boolean not null default false,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, contact_id)
);

create index if not exists hermes_conversations_last_idx on public.hermes_conversations (last_message_at desc);
create index if not exists hermes_conversations_attention_idx on public.hermes_conversations (needs_attention, last_message_at desc);

create table if not exists public.hermes_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.hermes_conversations(id) on delete cascade,
  channel text not null,
  direction text not null,
  external_id text unique,
  contact_id text not null default '',
  body text not null default '',
  message_type text not null default 'text',
  needs_attention boolean not null default false,
  corrected boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint hermes_messages_direction_check check (direction in ('inbound', 'outbound'))
);

create index if not exists hermes_messages_conversation_idx on public.hermes_messages (conversation_id, created_at asc);
create index if not exists hermes_messages_created_idx on public.hermes_messages (created_at desc);

create table if not exists public.hermes_unanswered (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.hermes_conversations(id) on delete cascade,
  message_id uuid references public.hermes_messages(id) on delete set null,
  channel text not null default '',
  contact_id text not null default '',
  question text not null default '',
  reason text not null default '',
  resolved boolean not null default false,
  answer text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists hermes_unanswered_open_idx on public.hermes_unanswered (resolved, created_at desc);

create table if not exists public.hermes_corrections (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.hermes_conversations(id) on delete cascade,
  message_id uuid references public.hermes_messages(id) on delete set null,
  correction text not null default '',
  admin_note text not null default '',
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists hermes_corrections_created_idx on public.hermes_corrections (created_at desc);

create table if not exists public.hermes_contact_rules (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'all',
  contact text not null,
  mode text not null default 'block',
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (channel, contact),
  constraint hermes_contact_rules_mode_check check (mode in ('allow', 'block')),
  constraint hermes_contact_rules_channel_check check (channel in ('all', 'whatsapp', 'instagram', 'tiktok'))
);

create index if not exists hermes_contact_rules_contact_idx on public.hermes_contact_rules (contact);

create table if not exists public.hermes_training_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  source_type text not null default 'text',
  content text not null default '',
  char_count integer not null default 0,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);

create index if not exists hermes_training_documents_created_idx on public.hermes_training_documents (created_at desc);

create table if not exists public.hermes_training_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.hermes_training_documents(id) on delete cascade,
  content text not null default '',
  embedding vector(384),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hermes_training_chunks_document_idx on public.hermes_training_chunks (document_id);
create index if not exists hermes_training_chunks_fts_idx on public.hermes_training_chunks using gin (to_tsvector('simple', content));
drop index if exists public.hermes_training_chunks_embedding_idx;

create or replace function public.match_hermes_chunks(p_query_embedding vector(384), p_match_count integer default 5)
returns table(id uuid, document_id uuid, content text, similarity double precision)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.document_id, c.content, 1 - (c.embedding <=> p_query_embedding) as similarity
  from public.hermes_training_chunks c
  where c.embedding is not null
  order by c.embedding <=> p_query_embedding
  limit greatest(1, least(coalesce(p_match_count, 5), 20));
$$;

create or replace function public.search_hermes_chunks(p_query text, p_match_count integer default 5)
returns table(id uuid, document_id uuid, content text, rank_score real)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.document_id, c.content,
    ts_rank(to_tsvector('simple', c.content), plainto_tsquery('simple', p_query)) as rank_score
  from public.hermes_training_chunks c
  where to_tsvector('simple', c.content) @@ plainto_tsquery('simple', p_query)
  order by rank_score desc, c.created_at desc
  limit greatest(1, least(coalesce(p_match_count, 5), 20));
$$;

grant execute on function public.match_hermes_chunks(vector, integer) to anon, authenticated;
grant execute on function public.search_hermes_chunks(text, integer) to anon, authenticated;

alter table public.weekly_metrics enable row level security;
alter table public.social_stat_snapshots enable row level security;
alter table public.hermes_settings enable row level security;
alter table public.hermes_channels enable row level security;
alter table public.hermes_conversations enable row level security;
alter table public.hermes_messages enable row level security;
alter table public.hermes_unanswered enable row level security;
alter table public.hermes_corrections enable row level security;
alter table public.hermes_contact_rules enable row level security;
alter table public.hermes_training_documents enable row level security;
alter table public.hermes_training_chunks enable row level security;

grant select, insert, update, delete on public.hermes_settings to anon, authenticated;
grant select, insert, update, delete on public.hermes_channels to anon, authenticated;
grant select, insert, update, delete on public.hermes_conversations to anon, authenticated;
grant select, insert, update, delete on public.hermes_messages to anon, authenticated;
grant select, insert, update, delete on public.hermes_unanswered to anon, authenticated;
grant select, insert, update, delete on public.hermes_corrections to anon, authenticated;
grant select, insert, update, delete on public.hermes_contact_rules to anon, authenticated;
grant select, insert, update, delete on public.hermes_training_documents to anon, authenticated;
grant select, insert, update, delete on public.hermes_training_chunks to anon, authenticated;

drop policy if exists "Public can manage hermes settings" on public.hermes_settings;
create policy "Public can manage hermes settings" on public.hermes_settings for all using (true) with check (true);
drop policy if exists "Public can manage hermes channels" on public.hermes_channels;
create policy "Public can manage hermes channels" on public.hermes_channels for all using (true) with check (true);
drop policy if exists "Public can manage hermes conversations" on public.hermes_conversations;
create policy "Public can manage hermes conversations" on public.hermes_conversations for all using (true) with check (true);
drop policy if exists "Public can manage hermes messages" on public.hermes_messages;
create policy "Public can manage hermes messages" on public.hermes_messages for all using (true) with check (true);
drop policy if exists "Public can manage hermes unanswered" on public.hermes_unanswered;
create policy "Public can manage hermes unanswered" on public.hermes_unanswered for all using (true) with check (true);
drop policy if exists "Public can manage hermes corrections" on public.hermes_corrections;
create policy "Public can manage hermes corrections" on public.hermes_corrections for all using (true) with check (true);
drop policy if exists "Public can manage hermes contact rules" on public.hermes_contact_rules;
create policy "Public can manage hermes contact rules" on public.hermes_contact_rules for all using (true) with check (true);
drop policy if exists "Public can manage hermes training documents" on public.hermes_training_documents;
create policy "Public can manage hermes training documents" on public.hermes_training_documents for all using (true) with check (true);
drop policy if exists "Public can manage hermes training chunks" on public.hermes_training_chunks;
create policy "Public can manage hermes training chunks" on public.hermes_training_chunks for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.hermes_conversations;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.hermes_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.hermes_unanswered;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.hermes_settings;
exception when duplicate_object then null; when undefined_object then null; end $$;

insert into public.hermes_settings (id, enabled, brand_prompt, first_message, fallback_message, model)
values (
  'global',
  true,
  'Sei Hermes, l''assistente AI di WooDreads, studio di dreadmaker a Roma. Parla in italiano con un tono solare, empatico e professionale. Usa con misura emoji come ☀️, ✨ e 🌿. Non inventare prezzi: per creazioni e restauri complessi serve una consulenza con Andriy. Chiedi sempre foto o un breve video panoramico prima di un preventivo. Non usare cera e non consigliare prodotti pesanti. Se non conosci la risposta, dillo con onestà e chiedi aiuto al team. Rispondi in modo breve, chiaro e utile.',
  'Ciao! ☀️ Benvenut* in WooDreads. Qual è il servizio di cui hai bisogno e come posso esserti utile oggi?',
  'Ho preso nota della tua richiesta ✨ Ti rispondo a breve con tutte le informazioni. Se preferisci, scrivici direttamente su WhatsApp al 348 539 3826.',
  'openrouter/free'
)
on conflict (id) do nothing;

insert into public.hermes_channels (channel, enabled, display_name, external_id)
values
  ('whatsapp', false, 'WhatsApp Business', ''),
  ('instagram', false, 'Instagram Direct', ''),
  ('tiktok', false, 'TikTok Direct', '')
on conflict (channel) do nothing;

insert into public.hermes_contact_rules (channel, contact, mode, note)
values ('whatsapp', '393485393826', 'block', 'Numero studio: evita risposte automatiche al proprietario')
on conflict (channel, contact) do nothing;

insert into public.hermes_training_documents (id, title, source_type, content, char_count, status)
values (
  '00000000-0000-4000-8000-000000000001',
  'Brand voice WooDreads',
  'brand',
  'WooDreads è uno studio di dreadmaker a Roma. Il metodo usa l''uncinetto, senza cera. I dreads si lavano con uno shampoo delicato, senza siliconi, balsami o oli pesanti. La manutenzione si fa in media ogni 2-3 mesi. Per un preventivo servono foto o un video panoramico dei capelli. La creazione di un full set richiede in media dalle 5 alle 10 ore, a volte su due appuntamenti. Il prezzo dipende da lunghezza, spessore e densità: non dare un prezzo finale senza la conferma di Andriy. Lo studio si trova a Roma, Palazzo Giallo, Civico 9. La caparra per una prenotazione è di 20 euro, scalabile dal totale. La riprogrammazione è gratuita fino a 24 ore prima. I capelli vanno lavati e asciugati due giorni prima della seduta.',
  680,
  'ready'
)
on conflict (id) do nothing;

insert into public.hermes_training_chunks (id, document_id, content, embedding, metadata)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'WooDreads è uno studio di dreadmaker a Roma. Il metodo usa l''uncinetto, senza cera. I dreads si lavano con uno shampoo delicato, senza siliconi, balsami o oli pesanti. La manutenzione si fa in media ogni 2-3 mesi. Per un preventivo servono foto o un video panoramico dei capelli. La creazione di un full set richiede in media dalle 5 alle 10 ore, a volte su due appuntamenti. Il prezzo dipende da lunghezza, spessore e densità: non dare un prezzo finale senza la conferma di Andriy. Lo studio si trova a Roma, Palazzo Giallo, Civico 9. La caparra per una prenotazione è di 20 euro, scalabile dal totale. La riprogrammazione è gratuita fino a 24 ore prima. I capelli vanno lavati e asciugati due giorni prima della seduta.',
  null,
  '{"source":"brand"}'::jsonb
)
on conflict (id) do nothing;
