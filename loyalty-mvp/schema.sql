-- ============================================================
-- Fidelidade Local — Database schema (MVP)
-- Target: Supabase (Postgres, auth.users provided by Supabase Auth)
-- Applied to project: mimos-fidelidade-mvp (kyopaqxmkgqhgrngjjzm)
-- ============================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ------------------------------------------------------------
-- 1. SHOPS (lojistas) — one row per merchant account
-- ------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null unique,
  points_per_checkin int not null default 1 check (points_per_checkin > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.shops (owner_id);

comment on table public.shops is 'One row per merchant (lojista) using the loyalty program';

-- ------------------------------------------------------------
-- 2. REWARDS (mimos) — what a shop offers in exchange for points
-- ------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  title text not null,
  points_required int not null check (points_required > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index on public.rewards (shop_id);

-- ------------------------------------------------------------
-- 3. CUSTOMERS (clientes) — end customers of a shop, identified by phone
-- ------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  phone text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create index on public.customers (shop_id);

-- ------------------------------------------------------------
-- 4. POINT_TRANSACTIONS (pontos) — ledger of earns/redemptions
-- ------------------------------------------------------------
create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  points int not null,                     -- positive = earned, negative = redeemed
  reward_id uuid references public.rewards (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.point_transactions (shop_id);
create index on public.point_transactions (customer_id);

-- ------------------------------------------------------------
-- 5. Convenience view: current point balance per customer
--    (security_invoker = true so it always enforces the RLS of the
--    querying user, never the view owner's — see rls_policies.sql)
-- ------------------------------------------------------------
create view public.customer_balances
with (security_invoker = true) as
select
  c.id as customer_id,
  c.shop_id,
  c.name,
  c.phone,
  coalesce(sum(pt.points), 0) as balance
from public.customers c
left join public.point_transactions pt on pt.customer_id = c.id
group by c.id, c.shop_id, c.name, c.phone;

-- ------------------------------------------------------------
-- 6. updated_at trigger helper
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql
set search_path = public;

create trigger trg_shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 7. get_shop_public — the ONLY public read path (anon key), used by the
--    customer-facing QR check-in page to resolve a shop slug. Returns
--    just the safe, non-PII columns (no owner_id).
-- ------------------------------------------------------------
create or replace function public.get_shop_public(p_shop_slug text)
returns table (id uuid, name text, slug text, points_per_checkin int)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, slug, points_per_checkin
  from public.shops
  where slug = p_shop_slug;
$$;

-- ------------------------------------------------------------
-- 8. checkin_public — the ONLY public write path (anon key), used by the
--    customer QR page. Upserts the customer by phone and credits
--    points_per_checkin. Runs as SECURITY DEFINER so anon never needs
--    direct table privileges on customers/point_transactions.
-- ------------------------------------------------------------
create or replace function public.checkin_public(
  p_shop_slug text,
  p_phone text,
  p_name text default null
)
returns table (customer_name text, new_balance int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
  v_customer_id uuid;
  v_balance int;
begin
  select * into v_shop from public.shops where slug = p_shop_slug;
  if v_shop.id is null then
    raise exception 'Loja não encontrada';
  end if;

  insert into public.customers (shop_id, phone, name)
  values (v_shop.id, p_phone, p_name)
  on conflict (shop_id, phone)
    do update set name = coalesce(excluded.name, public.customers.name)
  returning id into v_customer_id;

  insert into public.point_transactions (shop_id, customer_id, points)
  values (v_shop.id, v_customer_id, v_shop.points_per_checkin);

  select coalesce(sum(points), 0) into v_balance
  from public.point_transactions
  where customer_id = v_customer_id;

  return query
    select coalesce(c.name, ''), v_balance
    from public.customers c where c.id = v_customer_id;
end;
$$;
