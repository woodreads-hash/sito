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
