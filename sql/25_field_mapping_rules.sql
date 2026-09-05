-- ═══════════════════════════════════════════════════════════════════════════
-- Field Mapping Rules ("Copy Maps")
-- Automatically copies a field's value from one place to another, for two
-- distinct scenarios:
--   1. product_to_line_item: when a product is selected in a line item
--      grid, copy one of its fields (e.g. a "Security Deposit" custom
--      field) into a field on that line item automatically.
--   2. record_conversion: when a record converts to another type (e.g.
--      Order → Invoice, Lead → Opportunity), copy a field from the source
--      record onto the newly-created target record.
-- Both custom fields (stored in a record's custom_data JSONB) and standard
-- fields can be mapped on either side.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.field_mapping_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid,
  rule_type           text NOT NULL,          -- 'product_to_line_item' | 'record_conversion'
  name                text,                   -- admin-facing label, e.g. "Copy Security Deposit to Line Item"

  source_object       text NOT NULL,          -- e.g. 'retailProducts', 'retailOrders'
  source_field        text NOT NULL,          -- api_name (custom) or field key (standard)
  source_field_type   text DEFAULT 'custom',  -- 'custom' | 'standard'

  target_object       text NOT NULL,          -- e.g. 'retail_order_line_items' (product_to_line_item) or 'retailInvoices' (conversion)
  target_field        text NOT NULL,
  target_field_type   text DEFAULT 'custom',

  -- Only used for rule_type = 'record_conversion' — identifies which
  -- specific conversion this rule applies to, e.g. 'retailOrder_to_retailInvoice',
  -- 'lead_to_opportunity'. NULL for product_to_line_item rules.
  conversion_context  text,

  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_mapping_lookup
  ON public.field_mapping_rules (tenant_id, rule_type, source_object, is_active);

ALTER TABLE public.field_mapping_rules ENABLE ROW LEVEL SECURITY;
-- Not sensitive data (field names and mapping configuration only, no
-- credentials or PII) — readable by any tenant user so mapping actually
-- applies when they use the app, matching the low-sensitivity pattern
-- already used for field_layout_config.
DROP POLICY IF EXISTS field_mapping_rules_tenant_all ON public.field_mapping_rules;
CREATE POLICY field_mapping_rules_tenant_all ON public.field_mapping_rules
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select table_name from information_schema.tables where table_name = 'field_mapping_rules';
-- → 1 row
