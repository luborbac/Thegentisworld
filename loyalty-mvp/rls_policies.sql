-- ============================================================
-- Fidelidade Local — Row Level Security
-- ============================================================

alter table public.shops enable row level security;
alter table public.rewards enable row level security;
alter table public.customers enable row level security;
alter table public.point_transactions enable row level security;

-- ------------------------------------------------------------
-- SHOPS: owner has full access to their own shop only
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
-- REWARDS: owner manages rewards belonging to their shop(s)
-- ------------------------------------------------------------
create policy "rewards_all_own_shop" on public.rewards
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  )
  with check (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- CUSTOMERS: owner reads/manages customers of their shop(s).
-- Public inserts happen ONLY through the checkin_public() RPC
-- (SECURITY DEFINER, bypasses RLS deliberately) — see schema.sql.
-- ------------------------------------------------------------
create policy "customers_all_own_shop" on public.customers
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  )
  with check (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- POINT_TRANSACTIONS: owner reads/manages transactions of their shop(s).
-- Public inserts happen ONLY through checkin_public() — see schema.sql.
-- ------------------------------------------------------------
create policy "transactions_all_own_shop" on public.point_transactions
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  )
  with check (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- Public API surface: only two SECURITY DEFINER functions are exposed
-- to anon/authenticated. No table or view is granted directly to anon.
-- ------------------------------------------------------------
grant execute on function public.get_shop_public(text) to anon, authenticated;
grant execute on function public.checkin_public(text, text, text) to anon, authenticated;

revoke all on public.shops from anon;
revoke all on public.rewards from anon;
revoke all on public.customers from anon;
revoke all on public.point_transactions from anon;
revoke all on public.customer_balances from anon;
