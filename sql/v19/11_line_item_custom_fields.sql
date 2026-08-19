-- ═══════════════════════════════════════════════════════════════════════════
-- UMBRELLA SUITE — 11: LINE ITEM CUSTOM FIELDS (run AFTER 10)
-- Enables custom fields on line-item grids (quotations, orders, invoices —
-- both B2B and Retail), not just on the parent record. Every other
-- customizable object already has a custom_data JSONB column; line-item
-- tables never got one, which is why App Composer couldn't offer them.
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.quotation_line_items       ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.order_line_items           ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.invoice_line_items         ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.retail_order_line_items    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.retail_invoice_line_items  ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;

-- app_custom_fields itself needs no schema change — object_type is a plain
-- text column, so the new line-item object types ('quotationLineItems',
-- 'orderLineItems', 'invoiceLineItems', 'retailOrderLineItems',
-- 'retailInvoiceLineItems') work with the existing table as-is.

-- ─── PostgREST schema reload ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION QUERIES (run manually after applying) ─────────────────────
-- 1. select table_name, column_name from information_schema.columns
--    where column_name = 'custom_data'
--    and table_name in ('quotation_line_items','order_line_items','invoice_line_items',
--                        'retail_order_line_items','retail_invoice_line_items');
--    → 5 rows
-- 2. Create a custom field for "Quotation Line Items" in App Composer, add it
--    to a quote's line item, save, then:
--    select product_name, custom_data from quotation_line_items order by created_at desc limit 3;
--    → custom_data should contain your field's value
