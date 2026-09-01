-- ═══════════════════════════════════════════════════════════════════════════
-- Add param_count to whatsapp_templates — lets each tenant declare how many
-- {{n}} placeholders their actual approved template has (0 for a plain
-- static message, up to the full set of available values for a fully
-- personalized one). The send logic then sends exactly that many values,
-- in order, instead of assuming every template needs the full set.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS param_count integer DEFAULT 3;

-- Existing rows default to 3 (the prior hardcoded assumption for
-- invoice_notice) so nothing already configured silently changes behavior;
-- tenants with a simpler template can lower this to match what they
-- actually approved.

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'whatsapp_templates' and column_name = 'param_count';
-- → 1 row
