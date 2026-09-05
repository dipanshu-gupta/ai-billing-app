-- ═══════════════════════════════════════════════════════════════════════════
-- Document Designer overhaul — Terms & Conditions, custom fields, section
-- ordering, and exposing template controls for features the print engine
-- (buildRetailPrintHTML) already supports but the designer never exposed:
-- the overall/header discount row and rental date display were always-on
-- in the actual printed invoice, with no toggle or preview in the designer
-- itself.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.retail_invoice_templates
  -- Terms & Conditions — rich text (HTML), with its own show/hide toggle
  -- and a tenant-wide default so it doesn't need re-entering per template.
  ADD COLUMN IF NOT EXISTS terms_and_conditions text DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_terms boolean DEFAULT false,
  -- Previously always shown with no way to turn it off or preview it in
  -- the designer, even though the print engine has supported it since the
  -- header-discount feature was added.
  ADD COLUMN IF NOT EXISTS show_header_discount boolean DEFAULT true,
  -- Previously always shown for any rental line with no toggle at all.
  ADD COLUMN IF NOT EXISTS show_rental_dates boolean DEFAULT true,
  -- Which custom fields (by api_name) to include on the printed document,
  -- in the order they should appear - the "add custom fields" capability.
  ADD COLUMN IF NOT EXISTS custom_field_keys jsonb DEFAULT '[]'::jsonb,
  -- Which major sections appear and in what order - the "adjust layout
  -- and sequence" capability. Defaults to the existing, current order so
  -- no template's layout changes until an admin deliberately reorders it.
  ADD COLUMN IF NOT EXISTS section_order jsonb DEFAULT
    '["header","customer","items","totals","terms","payment","signature","footer"]'::jsonb;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'retail_invoice_templates'
--   and column_name in ('terms_and_conditions','show_terms','show_header_discount','show_rental_dates','custom_field_keys','section_order');
-- → 6 rows
