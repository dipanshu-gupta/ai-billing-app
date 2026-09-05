-- ═══════════════════════════════════════════════════════════════════════════
-- Add related_order_number to retail_activities
-- Links an activity back to the order it was created from, via the new
-- rental-mode-only "Create Activity" button on Order detail pages. Used to
-- show a clickable cross-reference between the two records.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.retail_activities
  ADD COLUMN IF NOT EXISTS related_order_number text;

CREATE INDEX IF NOT EXISTS idx_retail_activities_related_order
  ON public.retail_activities (related_order_number);

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'retail_activities' and column_name = 'related_order_number';
-- → 1 row
