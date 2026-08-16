-- ═══════════════════════════════════════════════════════════════════════════
-- UMBRELLA SUITE — 05: B2B BALANCE ORDER (PARTIAL FULFILLMENT) (run AFTER 04)
-- Supports converting a single quotation into MULTIPLE orders over time, and
-- a single order into MULTIPLE partial invoices, with running balances.
--
-- Data model: a simple running-total column per line item table (no new
-- linking table). `ordered_qty` on quotation_line_items and `invoiced_qty` on
-- order_line_items track how much of each line has been converted so far;
-- "remaining" is computed on the fly as quantity - ordered_qty / invoiced_qty.
-- This keeps the change minimal and compatible with the existing LI_MAP /
-- CPQRecordDetail line-item patterns — no joins needed to compute balance.
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Running-total columns ────────────────────────────────────────────────
ALTER TABLE public.quotation_line_items ADD COLUMN IF NOT EXISTS ordered_qty  numeric DEFAULT 0;
ALTER TABLE public.order_line_items     ADD COLUMN IF NOT EXISTS invoiced_qty numeric DEFAULT 0;

-- Backfill: any line item created before this migration has no orders/invoices
-- against it, so ordered_qty / invoiced_qty default to 0 automatically via the
-- column default — no backfill UPDATE needed.

-- ─── 2. Status vocabulary ─────────────────────────────────────────────────────
-- 'Partially Ordered' (quotations) and 'Partially Invoiced' (orders) are new
-- status values used by the app (lib/utils.ts getStatusOptions). These are
-- free-text status columns (no CHECK constraint / enum in this schema), so no
-- DDL is required to allow the new values — this section documents that the
-- new statuses were considered, not skipped.

-- ─── 3. Indexes ────────────────────────────────────────────────────────────────
-- Speeds up "remaining balance" lookups when opening a quotation/order detail
-- panel or list, and the partial-fulfillment modal's per-line balance check.
CREATE INDEX IF NOT EXISTS idx_qli_quote_balance ON public.quotation_line_items (tenant_id, quote_number, ordered_qty);
CREATE INDEX IF NOT EXISTS idx_oli_order_balance ON public.order_line_items    (tenant_id, order_number, invoiced_qty);

-- ─── 4. PostgREST schema reload ──────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION QUERIES (run manually after applying) ─────────────────────
-- 1. select column_name from information_schema.columns
--    where table_name='quotation_line_items' and column_name='ordered_qty';   → 1 row
-- 2. select column_name from information_schema.columns
--    where table_name='order_line_items' and column_name='invoiced_qty';      → 1 row
-- 3. Convert part of a quote to an order, then:
--    select quantity, ordered_qty from quotation_line_items where quote_number = '<QUO-xxxxx>';
--    → ordered_qty should be less than quantity for a partial conversion.
-- 4. Invoice part of that order, then:
--    select quantity, invoiced_qty from order_line_items where order_number = '<ORD-xxxxx>';
--    → invoiced_qty should be less than quantity for a partial invoice.
