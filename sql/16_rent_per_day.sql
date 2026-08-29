-- ═══════════════════════════════════════════════════════════════════════════
-- Add rent_per_day to retail_products — the daily rental rate for a
-- rentable item, used to price rental order/invoice line items (rate ×
-- number of days) instead of the regular one-time sale price.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.retail_products
  ADD COLUMN IF NOT EXISTS rent_per_day numeric DEFAULT 0;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'retail_products' and column_name = 'rent_per_day';
-- → 1 row
