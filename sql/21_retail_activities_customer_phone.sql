-- ═══════════════════════════════════════════════════════════════════════════
-- Add customer_phone to retail_activities — auto-populated from the
-- selected customer's phone on file when a customer is chosen (the generic
-- retailCustomer field auto-populate logic already does this for every
-- object that has this field type), remains independently editable per
-- activity afterward, and stays blank if that customer has no phone on file.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.retail_activities
  ADD COLUMN IF NOT EXISTS customer_phone text;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'retail_activities' and column_name = 'customer_phone';
-- → 1 row
