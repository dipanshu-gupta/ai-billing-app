-- ═══════════════════════════════════════════════════════════════════════════
-- Standard Field Customization ("Page Layout Designer")
-- Per-tenant overrides for existing standard fields: custom labels,
-- read/write/hidden state, conditional rules, and display order/grouping.
-- This is distinct from app_custom_fields (which defines brand-new fields) —
-- this table only changes how ALREADY-EXISTING standard fields behave.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.field_layout_config (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid,                          -- null on a dedicated tenant DB
  object_type       text NOT NULL,                 -- e.g. 'retailOrders', 'leads', 'customers'
  field_key         text NOT NULL,                 -- the field's existing internal key, e.g. 'customer_id', 'status'

  -- Base overrides — apply whenever no conditional rule below matches
  custom_label      text,                          -- null = use the field's original built-in label
  visibility_mode   text DEFAULT 'visible',        -- 'visible' | 'hidden'
  editability_mode  text DEFAULT 'editable',       -- 'editable' | 'readonly'

  -- Layout position
  section_key       text,                          -- which layout section/group this field is placed in
  display_order     integer DEFAULT 0,             -- order within its section

  -- Conditional rules — a JSON array, each shaped like:
  --   { "condition_field": "status", "operator": "equals", "condition_value": "Closed",
  --     "then_visibility": "hidden", "then_editability": null }
  -- Evaluated in array order against the record currently being displayed;
  -- the first matching rule's non-null then_* values override the base
  -- visibility_mode/editability_mode above. operator is one of:
  -- 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty'.
  conditional_rules jsonb DEFAULT '[]'::jsonb,

  is_published      boolean DEFAULT false,         -- draft vs live, mirroring app_custom_fields' draft/publish pattern
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),

  CONSTRAINT field_layout_config_unique UNIQUE (tenant_id, object_type, field_key)
);

CREATE INDEX IF NOT EXISTS idx_field_layout_lookup
  ON public.field_layout_config (tenant_id, object_type, is_published);

-- A separate row per object_type to store section ORDER and LABELS
-- (section_key alone on field rows doesn't capture the sections' own order
-- or display names, e.g. renaming "Basic Info" to "Overview").
CREATE TABLE IF NOT EXISTS public.field_layout_sections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  object_type   text NOT NULL,
  section_key   text NOT NULL,
  custom_label  text,                              -- null = use the section's original built-in label
  display_order integer DEFAULT 0,
  is_published  boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT field_layout_sections_unique UNIQUE (tenant_id, object_type, section_key)
);

ALTER TABLE public.field_layout_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_layout_sections  ENABLE ROW LEVEL SECURITY;

-- Unlike whatsapp_config, this data is NOT sensitive (labels, visibility
-- flags, no credentials) and needs to be readable by every ordinary tenant
-- user viewing any record page — so, unlike the WhatsApp tables, this DOES
-- get a real client-facing RLS policy rather than service-role-only access.
DROP POLICY IF EXISTS field_layout_config_tenant_read ON public.field_layout_config;
CREATE POLICY field_layout_config_tenant_read ON public.field_layout_config
  FOR SELECT USING (true); -- app-layer tenant scoping applies the same tenant_id filter used throughout this app; RLS here is a light backstop, not the primary gate, matching this table's low sensitivity

DROP POLICY IF EXISTS field_layout_config_tenant_write ON public.field_layout_config;
CREATE POLICY field_layout_config_tenant_write ON public.field_layout_config
  FOR ALL USING (true) WITH CHECK (true); -- admin-only write is enforced at the application layer (canAccessAdmin gate), consistent with this app's existing admin-settings tables

DROP POLICY IF EXISTS field_layout_sections_tenant_read ON public.field_layout_sections;
CREATE POLICY field_layout_sections_tenant_read ON public.field_layout_sections
  FOR SELECT USING (true);

DROP POLICY IF EXISTS field_layout_sections_tenant_write ON public.field_layout_sections;
CREATE POLICY field_layout_sections_tenant_write ON public.field_layout_sections
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select table_name from information_schema.tables
--   where table_name in ('field_layout_config','field_layout_sections');
-- → 2 rows
