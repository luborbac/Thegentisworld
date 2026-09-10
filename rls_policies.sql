-- ============================================================
-- GENTIS — Row Level Security policies
-- Run AFTER schema.sql
-- Principle: genealogical data (trees/people/relationships/hypotheses)
-- is private to its owner. Regions and forum content are public read,
-- but writes require authentication and ownership.
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- ------------------------------------------------------------
-- CERTAINTY LEVELS (public reference data, read-only for all)
-- ------------------------------------------------------------
alter table public.certainty_levels enable row level security;

create policy "certainty_levels_public_read"
  on public.certainty_levels for select
  using (true);

-- ------------------------------------------------------------
-- FAMILY TREES — private to owner
-- ------------------------------------------------------------
alter table public.family_trees enable row level security;

create policy "trees_owner_all"
  on public.family_trees for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ------------------------------------------------------------
-- PEOPLE — private to the tree's owner
-- ------------------------------------------------------------
alter table public.people enable row level security;

create policy "people_owner_all"
  on public.people for all
  using (
    exists (
      select 1 from public.family_trees t
      where t.id = people.tree_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.family_trees t
      where t.id = people.tree_id and t.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- RELATIONSHIPS — private to the tree's owner
-- ------------------------------------------------------------
alter table public.relationships enable row level security;

create policy "relationships_owner_all"
  on public.relationships for all
  using (
    exists (
      select 1 from public.family_trees t
      where t.id = relationships.tree_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.family_trees t
      where t.id = relationships.tree_id and t.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- REGIONS — public read, no client writes (curated via admin/service role)
-- ------------------------------------------------------------
alter table public.regions enable row level security;

create policy "regions_public_read"
  on public.regions for select
  using (true);
-- No insert/update/delete policy => only service_role (backend admin) can write.

-- ------------------------------------------------------------
-- ANCESTRY HYPOTHESES — private to the tree's owner
-- ------------------------------------------------------------
alter table public.ancestry_hypotheses enable row level security;

create policy "hypotheses_owner_all"
  on public.ancestry_hypotheses for all
  using (
    exists (
      select 1 from public.family_trees t
      where t.id = ancestry_hypotheses.tree_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.family_trees t
      where t.id = ancestry_hypotheses.tree_id and t.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- FORUM THREADS — public read, authenticated write, author-only edit/delete
-- ------------------------------------------------------------
alter table public.forum_threads enable row level security;

create policy "threads_public_read"
  on public.forum_threads for select
  using (true);

create policy "threads_authenticated_insert"
  on public.forum_threads for insert
  with check (auth.uid() = author_id);

create policy "threads_author_update_delete"
  on public.forum_threads for update
  using (auth.uid() = author_id);

create policy "threads_author_delete"
  on public.forum_threads for delete
  using (auth.uid() = author_id);

-- ------------------------------------------------------------
-- FORUM REPLIES — same pattern as threads
-- ------------------------------------------------------------
alter table public.forum_replies enable row level security;

create policy "replies_public_read"
  on public.forum_replies for select
  using (true);

create policy "replies_authenticated_insert"
  on public.forum_replies for insert
  with check (auth.uid() = author_id);

create policy "replies_author_update"
  on public.forum_replies for update
  using (auth.uid() = author_id);

create policy "replies_author_delete"
  on public.forum_replies for delete
  using (auth.uid() = author_id);

-- ------------------------------------------------------------
-- MATCH ALERTS — private to the user who created them
-- ------------------------------------------------------------
alter table public.match_alerts enable row level security;

create policy "alerts_owner_all"
  on public.match_alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
