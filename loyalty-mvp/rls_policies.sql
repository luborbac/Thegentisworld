-- ============================================================
-- Fidelidade Local ("Mimos") — Row Level Security v2
-- ============================================================

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.rewards enable row level security;
alter table public.shop_members enable row level security;
alter table public.point_transactions enable row level security;

-- ------------------------------------------------------------
-- PROFILES: cada usuário só vê/edita o próprio perfil.
-- (a criação é feita pelo trigger handle_new_user, security definer)
-- ------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ------------------------------------------------------------
-- SHOPS: owner tem acesso total à própria loja.
-- (descoberta pública é via get_shop_public/list_shops_public,
-- não por SELECT direto na tabela — protege owner_id)
-- ------------------------------------------------------------
create policy "shops_select_own" on public.shops
  for select using (auth.uid() = owner_id);
create policy "shops_insert_own" on public.shops
  for insert with check (auth.uid() = owner_id);
create policy "shops_update_own" on public.shops
  for update using (auth.uid() = owner_id);
create policy "shops_delete_own" on public.shops
  for delete using (auth.uid() = owner_id);

-- ------------------------------------------------------------
-- REWARDS: owner tem CRUD completo; qualquer usuário (mesmo anônimo)
-- pode ler mimos ativos — é a vitrine pública da loja.
-- ------------------------------------------------------------
create policy "rewards_all_own_shop" on public.rewards
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  )
  with check (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

create policy "rewards_select_active_public" on public.rewards
  for select using (active = true);

-- ------------------------------------------------------------
-- SHOP_MEMBERS: o lojista vê os membros das suas lojas;
-- o cliente vê e cria a própria associação com uma loja.
-- ------------------------------------------------------------
create policy "shop_members_owner_select" on public.shop_members
  for select using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

create policy "shop_members_customer_select" on public.shop_members
  for select using (customer_id = auth.uid());

create policy "shop_members_customer_insert" on public.shop_members
  for insert with check (customer_id = auth.uid());

-- ------------------------------------------------------------
-- POINT_TRANSACTIONS: o lojista gerencia as transações das suas lojas;
-- o cliente lê o próprio histórico.
-- ------------------------------------------------------------
create policy "transactions_all_own_shop" on public.point_transactions
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  )
  with check (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

create policy "transactions_customer_select" on public.point_transactions
  for select using (customer_id = auth.uid());

-- ------------------------------------------------------------
-- Superfície pública da API: só as funções abaixo, nunca tabelas cruas.
-- ------------------------------------------------------------
grant execute on function public.list_shops_public(text) to anon, authenticated;
grant execute on function public.get_shop_public(text) to anon, authenticated;

-- Restritas a usuários autenticados; cada função valida internamente
-- que o chamador é dono da loja (owner_id = auth.uid()) antes de agir.
grant execute on function public.scan_wallet(text) to authenticated;
grant execute on function public.add_points_via_scan(text, uuid, int) to authenticated;
grant execute on function public.redeem_reward_via_scan(text, uuid, uuid) to authenticated;
grant execute on function public.get_my_wallet() to authenticated;

-- handle_new_user/set_updated_at só rodam via trigger — nunca via RPC.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;

-- Privilégios de tabela: RLS já restringe linhas; aqui garantimos que
-- o papel `anon` não tenha qualquer acesso direto às tabelas sensíveis.
revoke all on public.profiles from anon;
revoke all on public.shop_members from anon;
revoke all on public.point_transactions from anon;
revoke all on public.customer_balances from anon;
revoke all on public.shops from anon;
grant select on public.rewards to anon, authenticated;
