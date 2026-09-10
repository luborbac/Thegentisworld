-- ============================================================
-- GENTIS — Seed data (run with service_role, after schema + RLS)
-- Example region matching what's shown on the current landing page.
-- Replace/expand with real curated historical content before launch.
-- ============================================================

insert into public.regions (name, local_name, local_name_meaning, biome, summary, timeline, peoples_kingdoms, food, festivals)
values (
  'Costa do Mina',
  'ìpìnlẹ̀',
  'the land you are from',
  'West African coastal / savanna',
  'A stretch of the West African coast historically tied to trade and forced migration routes.',
  '[{"decade": "1600s", "event": "Placeholder — replace with sourced timeline entries"}]'::jsonb,
  '[{"name": "Placeholder kingdom", "description": "Replace with sourced content"}]'::jsonb,
  '[{"name": "Placeholder dish", "description": "Replace with sourced content"}]'::jsonb,
  '[{"name": "Placeholder festival", "description": "Replace with sourced content"}]'::jsonb
);
