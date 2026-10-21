-- Supabase schema for WooDreads cloud-first blog
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  text text default '',
  category text default '',
  excerpt text default '',
  cover_url text default '',
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
