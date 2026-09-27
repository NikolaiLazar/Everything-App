create table if not exists public.clock_alarms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  time time not null,
  label text not null default '',
  -- Wochentage 0 (So) bis 6 (Sa); leer = jeden Tag
  days smallint[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.clock_alarms enable row level security;

create policy "clock_alarms: own rows" on public.clock_alarms
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
