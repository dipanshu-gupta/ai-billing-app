-- ═══════════════════════════════════════════════════════════════════════════
-- UMBRELLA SUITE — 10: TYPOGRAPHY SIZE/WEIGHT (run AFTER 09)
-- "Typography changes (font, size, weight) under Appearance don't apply
-- anywhere" — font FAMILY was already working; size and weight controls
-- simply didn't exist in the UI or schema at all. This adds the columns the
-- new Font Size / Font Weight pickers in AppearancePanel.tsx now save.
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.appearance ADD COLUMN IF NOT EXISTS font_size   text DEFAULT 'md';
ALTER TABLE public.appearance ADD COLUMN IF NOT EXISTS font_weight text DEFAULT 'normal';

-- ─── PostgREST schema reload ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION QUERIES (run manually after applying) ─────────────────────
-- 1. select column_name from information_schema.columns
--    where table_name='appearance' and column_name in ('font_size','font_weight');
--    → 2 rows
-- 2. Change font size/weight under Admin Tools → Appearance, save, reload the
--    page — the change should persist and visibly apply (base text size/weight
--    changes; headings/buttons keep their own explicit weight).
