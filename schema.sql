-- ============================================================
-- GENTIS — Database schema (MVP)
-- Target: Supabase (Postgres 15+, auth.users provided by Supabase Auth)
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ------------------------------------------------------------
-- 1. PROFILES (extends Supabase auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  preferred_language text default 'pt' check (preferred_language in ('pt','es','en','de','fr','zh','it')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per registered user, extends auth.users';

-- ------------------------------------------------------------
-- 2. CERTAINTY LEVELS (fixed lookup table — "honesty rule")
-- ------------------------------------------------------------
create table public.certainty_levels (
  code text primary key check (code in ('likely','possible','compatible')),
  label text not null,
  color_hex text not null,
  description text not null
);

insert into public.certainty_levels (code, label, color_hex, description) values
  ('likely',     'Likely',         '#3d8b3d', 'Multiple records or strong oral tradition agree.'),
  ('possible',   'Possible',       '#c9a227', 'One credible source, or a coherent oral account.'),
  ('compatible', 'Compatible with','#3d6ba8', 'The evidence fits, but sources diverge.');

-- ------------------------------------------------------------
-- 3. FAMILY TREES (one owner, can invite collaborators later)
-- ------------------------------------------------------------
create table public.family_trees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'My family',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. PEOPLE (nodes in the tree — including "unknown ancestor" placeholders)
-- ------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  full_name text,                          -- null allowed: "open invitation" placeholder
  is_placeholder boolean not null default false,
  gender text check (gender in ('female','male','unknown','other')),
  birth_year int,
  birth_year_approx boolean default false,
  death_year int,
  death_year_approx boolean default false,
  notes text,                              -- free text: songs, memories, oral history
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.people (tree_id);

-- ------------------------------------------------------------
-- 5. RELATIONSHIPS (edges between people)
-- ------------------------------------------------------------
create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  person_a_id uuid not null references public.people (id) on delete cascade,
  person_b_id uuid not null references public.people (id) on delete cascade,
  relationship_type text not null check (relationship_type in ('parent_of','spouse_of')),
  created_at timestamptz not null default now(),
  constraint no_self_relationship check (person_a_id <> person_b_id)
);

create index on public.relationships (tree_id);
create index on public.relationships (person_a_id);
create index on public.relationships (person_b_id);

-- ------------------------------------------------------------
-- 6. REGIONS (master/reference data — curated content, not user-owned)
-- ------------------------------------------------------------
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- e.g. "Costa do Mina"
  local_name text,                          -- e.g. "ìpìnlẹ̀"
  local_name_meaning text,                  -- e.g. "the land you are from"
  biome text,
  summary text,
  timeline jsonb,                           -- [{decade, event}, ...]
  peoples_kingdoms jsonb,                   -- [{name, description}, ...]
  food jsonb,                               -- [{name, description}, ...]
  festivals jsonb,                          -- [{name, description}, ...]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. ANCESTRY HYPOTHESES (links a tree/person to a region, with certainty)
-- ------------------------------------------------------------
create table public.ancestry_hypotheses (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  person_id uuid references public.people (id) on delete cascade,
  region_id uuid not null references public.regions (id) on delete cascade,
  certainty_code text not null references public.certainty_levels (code),
  evidence_note text,                       -- why this certainty level was assigned
  created_at timestamptz not null default now()
);

create index on public.ancestry_hypotheses (tree_id);
create index on public.ancestry_hypotheses (region_id);

-- ------------------------------------------------------------
-- 8. REUNIONS — forum threads by region
-- ------------------------------------------------------------
create table public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  region_id uuid references public.regions (id) on delete set null,
  title text not null,
  body text not null,
  surname_tag text,                         -- for surname+place matching
  place_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.forum_threads (region_id);
create index on public.forum_threads (surname_tag);
create index on public.forum_threads (place_tag);

create table public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index on public.forum_replies (thread_id);

-- ------------------------------------------------------------
-- 9. MATCH ALERTS (opt-in notifications on surname + place)
-- ------------------------------------------------------------
create table public.match_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  surname_tag text,
  place_tag text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index on public.match_alerts (surname_tag);
create index on public.match_alerts (place_tag);

-- ------------------------------------------------------------
-- 10. updated_at trigger helper
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_trees_updated_at before update on public.family_trees
  for each row execute function public.set_updated_at();
create trigger trg_people_updated_at before update on public.people
  for each row execute function public.set_updated_at();
create trigger trg_regions_updated_at before update on public.regions
  for each row execute function public.set_updated_at();
create trigger trg_threads_updated_at before update on public.forum_threads
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 11. Auto-create profile row on signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
