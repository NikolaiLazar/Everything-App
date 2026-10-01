create table if not exists public.receipts_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store text not null default 'Unbekannt',
  purchased_at date not null default current_date,
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.receipts_receipts enable row level security;

create policy "receipts_receipts: own rows" on public.receipts_receipts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists receipts_receipts_purchased_at_idx on public.receipts_receipts (purchased_at);

-- Positionen einer Kassenzettel-Zeile. category ist ein Text-Key (kein DB-Enum),
-- damit die feste Kategorieliste im Client (categories.ts) ohne Migration erweiterbar bleibt.
create table if not exists public.receipts_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  receipt_id uuid not null references public.receipts_receipts (id) on delete cascade,
  name text not null,
  category text not null default 'sonstiges',
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2),
  total_price numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.receipts_items enable row level security;

create policy "receipts_items: own rows" on public.receipts_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists receipts_items_receipt_id_idx on public.receipts_items (receipt_id);
