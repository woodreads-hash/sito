create table if not exists public.site_settings (
  id text primary key default 'global',
  vat_number text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

grant select, insert, update, delete on public.site_settings to anon, authenticated;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings" on public.site_settings for select using (true);

drop policy if exists "Public can manage site settings" on public.site_settings;
create policy "Public can manage site settings" on public.site_settings for all using (true) with check (true);

insert into public.site_settings (id, vat_number)
values ('global', '')
on conflict (id) do nothing;
