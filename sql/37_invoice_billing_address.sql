-- =============================================================================
-- Add billing_address to retail_invoices
--
-- Invoices previously had no address field at all - orders already had
-- delivery_address, but invoices had nothing equivalent. Needed for the
-- new feature auto-filling an order's delivery address or an invoice's
-- billing address from the selected customer's own address fields.
--
-- Idempotent - safe to re-run on both the shared DB and dedicated tenant DBs.
-- =============================================================================

ALTER TABLE public.retail_invoices
  ADD COLUMN IF NOT EXISTS billing_address text;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------
-- VERIFICATION
-- ------------------------------------------------------------------------
-- select column_name from information_schema.columns
--   where table_name = 'retail_invoices' and column_name = 'billing_address';
-- expect 1 row
