-- ═══════════════════════════════════════════════════════════════════════════
-- Add header_discount_pct / header_discount_amount to retail_orders and
-- retail_invoices — an overall, order-level discount applied on top of any
-- per-line-item discounts, rather than requiring every discount to be
-- entered line by line. Applied to the final grand total (after tax),
-- not the taxable base — a simple "amount off the bill" rather than a
-- tax-affecting discount.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.retail_orders
  ADD COLUMN IF NOT EXISTS header_discount_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS header_discount_amount numeric DEFAULT 0;

ALTER TABLE public.retail_invoices
  ADD COLUMN IF NOT EXISTS header_discount_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS header_discount_amount numeric DEFAULT 0;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select table_name, column_name from information_schema.columns
--   where table_name in ('retail_orders','retail_invoices')
--   and column_name like 'header_discount%';
-- → 4 rows
