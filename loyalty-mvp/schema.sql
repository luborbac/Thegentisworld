-- ============================================================
-- Fidelidade Local ("Mimos") — Database schema v2
-- Target: Supabase (Postgres, auth.users provided by Supabase Auth)
-- Applied to project: mimos-fidelidade-mvp (kyopaqxmkgqhgrngjjzm)
--
-- v2 substitui o check-in por telefone por uma carteira digital:
-- cada cliente tem uma conta (papel "cliente") com um wallet_code
-- único, exibido como QR Code pessoal. O lojista (papel "lojista")
-- escaneia esse QR no balcão para creditar pontos ou resgatar mimos.
-- ============================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid(), gen_random_bytes()

-- ------------------------------------------------------------
-- 1. PROFILES — estende auth.users com papel, nome, telefone e
--    o wallet_code (conteúdo do QR pessoal do cliente).
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('lojista','cliente')),
  name text,
  phone text,
  wallet_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Um perfil por usuário autenticado: lojista ou cliente';

-- ------------------------------------------------------------
-- 2. SHOPS (lojistas) — inclui localização para o mapa do cliente
-- ------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  address text,
  lat double precision,
  lng double precision,
  points_per_checkin int not null default 1 check (points_per_checkin > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.shops (owner_id);

-- ------------------------------------------------------------
-- 3. REWARDS (mimos) — o que a loja oferece em troca de pontos
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
-- 4. SHOP_MEMBERS — vincula um cliente (profile) a uma loja
--    (criado automaticamente no primeiro scan/ponto)
-- ------------------------------------------------------------
create table public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shop_id, customer_id)
);

create index on public.shop_members (shop_id);
create index on public.shop_members (customer_id);

-- ------------------------------------------------------------
-- 5. POINT_TRANSACTIONS (pontos) — ledger de ganhos/resgates
-- ------------------------------------------------------------
create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  points int not null,                     -- positivo = ganho, negativo = resgate
  reward_id uuid references public.rewards (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.point_transactions (shop_id);
create index on public.point_transactions (customer_id);

-- ------------------------------------------------------------
-- 6. Saldo de pontos por cliente/loja (respeita RLS de quem consulta)
-- ------------------------------------------------------------
create view public.customer_balances
with (security_invoker = true) as
select
  sm.shop_id,
  p.id as customer_id,
  p.name,
  p.phone,
  p.wallet_code,
  coalesce(sum(pt.points), 0) as balance
from public.shop_members sm
join public.profiles p on p.id = sm.customer_id
left join public.point_transactions pt on pt.customer_id = sm.customer_id and pt.shop_id = sm.shop_id
group by sm.shop_id, p.id, p.name, p.phone, p.wallet_code;

-- ------------------------------------------------------------
-- 7. Triggers auxiliares
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- cria o profile automaticamente no cadastro, lendo role/name/phone
-- enviados pelo app em auth.signUp({ options: { data: {...} } })
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'cliente'),
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 8. Funções públicas — descoberta de lojas (app do cliente:
--    busca por nome + mapa)
-- ------------------------------------------------------------
create or replace function public.list_shops_public(p_query text default null)
returns table (id uuid, name text, slug text, description text, address text, lat double precision, lng double precision, points_per_checkin int)
language sql stable security definer set search_path = public as $$
  select id, name, slug, description, address, lat, lng, points_per_checkin
  from public.shops
  where p_query is null or name ilike '%' || p_query || '%'
  order by name;
$$;

create or replace function public.get_shop_public(p_shop_slug text)
returns table (id uuid, name text, slug text, description text, address text, lat double precision, lng double precision, points_per_checkin int)
language sql stable security definer set search_path = public as $$
  select id, name, slug, description, address, lat, lng, points_per_checkin
  from public.shops where slug = p_shop_slug;
$$;

-- ------------------------------------------------------------
-- 9. Funções restritas a lojistas autenticados — mecanismo de
--    "escanear a carteira do cliente" (ler QR do cliente no balcão)
-- ------------------------------------------------------------
create or replace function public.scan_wallet(p_wallet_code text)
returns table (customer_id uuid, name text, phone text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.shops where owner_id = auth.uid()) then
    raise exception 'Apenas lojistas podem escanear carteiras';
  end if;
  return query select p.id, p.name, p.phone from public.profiles p where p.wallet_code = p_wallet_code;
end;
$$;

create or replace function public.add_points_via_scan(p_wallet_code text, p_shop_id uuid, p_points int default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_shop public.shops%rowtype;
  v_customer_id uuid;
  v_points int;
begin
  select * into v_shop from public.shops where id = p_shop_id and owner_id = auth.uid();
  if v_shop.id is null then raise exception 'Loja não encontrada ou não pertence a você'; end if;

  select id into v_customer_id from public.profiles where wallet_code = p_wallet_code;
  if v_customer_id is null then raise exception 'Cliente não encontrado'; end if;

  v_points := coalesce(p_points, v_shop.points_per_checkin);

  insert into public.shop_members (shop_id, customer_id) values (v_shop.id, v_customer_id)
    on conflict (shop_id, customer_id) do nothing;

  insert into public.point_transactions (shop_id, customer_id, points)
  values (v_shop.id, v_customer_id, v_points);

  return v_points;
end;
$$;

create or replace function public.redeem_reward_via_scan(p_wallet_code text, p_shop_id uuid, p_reward_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_shop public.shops%rowtype;
  v_reward public.rewards%rowtype;
  v_customer_id uuid;
  v_balance int;
begin
  select * into v_shop from public.shops where id = p_shop_id and owner_id = auth.uid();
  if v_shop.id is null then raise exception 'Loja não encontrada ou não pertence a você'; end if;

  select * into v_reward from public.rewards where id = p_reward_id and shop_id = p_shop_id and active;
  if v_reward.id is null then raise exception 'Mimo não encontrado'; end if;

  select id into v_customer_id from public.profiles where wallet_code = p_wallet_code;
  if v_customer_id is null then raise exception 'Cliente não encontrado'; end if;

  select coalesce(sum(points), 0) into v_balance from public.point_transactions
    where shop_id = p_shop_id and customer_id = v_customer_id;

  if v_balance < v_reward.points_required then
    raise exception 'Pontos insuficientes (saldo: %, necessário: %)', v_balance, v_reward.points_required;
  end if;

  insert into public.point_transactions (shop_id, customer_id, points, reward_id)
  values (p_shop_id, v_customer_id, -v_reward.points_required, p_reward_id);

  return v_balance - v_reward.points_required;
end;
$$;

-- ------------------------------------------------------------
-- 10. get_my_wallet — o próprio cliente busca seu wallet_code (QR pessoal)
-- ------------------------------------------------------------
create or replace function public.get_my_wallet()
returns table (wallet_code text, name text)
language sql stable security definer set search_path = public as $$
  select wallet_code, name from public.profiles where id = auth.uid();
$$;
