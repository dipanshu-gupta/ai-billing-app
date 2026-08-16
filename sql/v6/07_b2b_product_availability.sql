-- ═══════════════════════════════════════════════════════════════════════════
-- UMBRELLA SUITE — 07: B2B PRODUCT AVAILABILITY (run AFTER 06)
-- B2B `products` had NO stock/inventory tracking at all (only retail_products
-- did) — this is why the quotation builder couldn't show product availability.
-- Adds the same stock-tracking columns retail_products already has, plus a
-- track_inventory opt-out flag for services/non-stocked line items (a B2B
-- catalog typically mixes physical goods with services that shouldn't show
-- "out of stock" warnings).
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity  numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reorder_level   numeric DEFAULT 10;
-- Services / non-stocked items can opt out of availability checks entirely.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_inventory boolean DEFAULT true;

-- Index to speed up low-stock lookups on the products list/dashboard, mirroring
-- the retail_products convention.
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products (tenant_id, stock_quantity) WHERE track_inventory = true;

-- ─── PostgREST schema reload ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION QUERIES (run manually after applying) ─────────────────────
-- 1. select column_name from information_schema.columns
--    where table_name='products' and column_name in ('stock_quantity','reorder_level','track_inventory');
--    → 3 rows
-- 2. select id, name, stock_quantity, reorder_level, track_inventory from products limit 5;
--    → stock_quantity=0, reorder_level=10, track_inventory=true for existing rows (defaults applied)
