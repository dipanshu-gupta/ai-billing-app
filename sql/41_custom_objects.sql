-- ═══════════════════════════════════════════════════════════════════════════
-- Custom Objects — enterprise flexfield engine (Oracle-Fusion-style)
--
-- Lets a tenant define entirely new record types ("custom objects") from the
-- admin UI, with:
--   - standard + admin-defined custom fields (incl. a Lookup type pointing at
--     a standard object OR another custom object)
--   - optional child line items
--   - the same RBAC model as every standard object (auto-registered
--     permission_codes: custom_<api_name>_view/create/edit/delete/export)
--   - the same Page Layout Designer relabel/hide/readonly/default-value
--     support standard objects already have
--
-- Architecture: this does NOT run CREATE TABLE per custom object — the app is
-- shared-table, row-level multi-tenant (one schema, every table scoped by
-- tenant_id + the tenant_isolation RLS policy below), so a tenant defining a
-- new object must never trigger DDL. Instead, custom_object_records is ONE
-- real, shared, generously-columned generic storage table (the same pattern
-- Oracle Fusion/Salesforce use for custom objects/flexfields): each custom
-- field is mapped to a physical generic column ("storage slot") by
-- custom_object_fields.storage_column, and a jsonb overflow column covers
-- multi-select and anything beyond the generous slot counts below.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── custom_objects: the object definitions themselves ────────────────────
CREATE TABLE IF NOT EXISTS public.custom_objects (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid,
  api_name                  text NOT NULL,           -- slug, e.g. 'equipment' — used to build custom_<api_name>_* permission codes
  singular_label            text NOT NULL,
  plural_label              text NOT NULL,
  icon                      text DEFAULT '📦',
  module                    text NOT NULL DEFAULT 'both',   -- 'b2b' | 'b2c' | 'both'
  supports_line_items       boolean DEFAULT false,
  line_item_singular_label  text DEFAULT 'Line Item',
  line_item_plural_label    text DEFAULT 'Line Items',
  description               text,
  status                    text NOT NULL DEFAULT 'draft',   -- 'draft' | 'published'
  is_active                 boolean DEFAULT true,
  sort_order                integer DEFAULT 0,
  created_by                text,
  created_at                timestamptz DEFAULT now(),
  updated_by                text,
  updated_at                timestamptz DEFAULT now(),
  organization_id           uuid,
  business_unit_id          uuid
);

ALTER TABLE public.custom_objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.custom_objects;
CREATE POLICY tenant_isolation ON public.custom_objects
  FOR ALL TO authenticated
  USING (tenant_row_visible(tenant_id))
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR ((tenant_id IS NULL) AND (current_tenant_id() = '00000000-0000-0000-0000-000000000001'::uuid))
  );
DROP TRIGGER IF EXISTS trg_auto_tenant ON public.custom_objects;
CREATE TRIGGER trg_auto_tenant BEFORE INSERT ON public.custom_objects
  FOR EACH ROW EXECUTE FUNCTION auto_fill_tenant_id();

-- Unique per tenant so two custom objects on the same tenant can never
-- collide on the api_name their permission codes and storage keys derive from.
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_objects_tenant_apiname
  ON public.custom_objects (tenant_id, api_name);
CREATE INDEX IF NOT EXISTS idx_custom_objects_tenant ON public.custom_objects(tenant_id);

-- ─── custom_object_fields: field metadata (standard-like + admin-defined) ──
CREATE TABLE IF NOT EXISTS public.custom_object_fields (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid,
  custom_object_id     uuid NOT NULL REFERENCES public.custom_objects(id) ON DELETE CASCADE,
  scope                text NOT NULL DEFAULT 'header',  -- 'header' | 'line_item'
  api_name             text NOT NULL,
  label                text NOT NULL,
  field_type           text NOT NULL,  -- text,long_text,number,currency,date,datetime,checkbox,single_select,multi_select,url,email,lookup
  options              jsonb DEFAULT '[]'::jsonb,         -- single_select/multi_select choices
  lookup_target_type   text,              -- 'standard' | 'custom' (only when field_type = 'lookup')
  lookup_target_object text,              -- e.g. 'retailCustomers' (standard) or another custom_objects.api_name
  storage_column       text NOT NULL,     -- physical slot, e.g. 'text_3', 'number_1', or 'custom_data' for jsonb overflow
  is_standard          boolean DEFAULT false,  -- true for the small built-in set (Name, Status, Owner) vs admin-added
  required             boolean DEFAULT false,
  sort_order           integer DEFAULT 0,
  is_active            boolean DEFAULT true,
  is_published         boolean DEFAULT true,
  default_value        text,
  show_on              text DEFAULT 'both',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE public.custom_object_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.custom_object_fields;
CREATE POLICY tenant_isolation ON public.custom_object_fields
  FOR ALL TO authenticated
  USING (tenant_row_visible(tenant_id))
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR ((tenant_id IS NULL) AND (current_tenant_id() = '00000000-0000-0000-0000-000000000001'::uuid))
  );
DROP TRIGGER IF EXISTS trg_auto_tenant ON public.custom_object_fields;
CREATE TRIGGER trg_auto_tenant BEFORE INSERT ON public.custom_object_fields
  FOR EACH ROW EXECUTE FUNCTION auto_fill_tenant_id();

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_object_fields_apiname
  ON public.custom_object_fields (tenant_id, custom_object_id, scope, api_name);
CREATE INDEX IF NOT EXISTS idx_custom_object_fields_object ON public.custom_object_fields(custom_object_id);

-- ─── custom_object_records: ONE shared generic storage table for every ────
-- custom object's header records (no DDL ever runs when a tenant adds an
-- object or field — only new custom_object_fields rows mapping to slots
-- that already exist here).
--
-- Generous slot counts, per the locked-in sizing decision:
--   20 text, 10 number, 10 date, 5 boolean, 10 single-select, 3 long_text
-- plus a jsonb overflow column for multi-select and anything beyond that.
CREATE TABLE IF NOT EXISTS public.custom_object_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid,
  custom_object_id  uuid NOT NULL REFERENCES public.custom_objects(id) ON DELETE CASCADE,
  record_number     text,                      -- display id, e.g. CUSTEQ-00001
  status            text DEFAULT 'Active',
  owner             text,
  owner_id          uuid,
  owner_name        text,
  organization_id   uuid,
  business_unit_id  uuid,
  custom_data       jsonb DEFAULT '{}'::jsonb,  -- overflow: multi_select values + anything past the slot counts
  created_by        text,
  created_at        timestamptz DEFAULT now(),
  updated_by        text,
  updated_at        timestamptz DEFAULT now()
);

DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..20 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_records ADD COLUMN IF NOT EXISTS text_%s text', i);
  END LOOP;
  FOR i IN 1..10 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_records ADD COLUMN IF NOT EXISTS number_%s numeric', i);
  END LOOP;
  FOR i IN 1..10 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_records ADD COLUMN IF NOT EXISTS date_%s date', i);
  END LOOP;
  FOR i IN 1..5 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_records ADD COLUMN IF NOT EXISTS boolean_%s boolean', i);
  END LOOP;
  FOR i IN 1..10 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_records ADD COLUMN IF NOT EXISTS select_%s text', i);
  END LOOP;
  FOR i IN 1..3 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_records ADD COLUMN IF NOT EXISTS long_text_%s text', i);
  END LOOP;
END $$;

ALTER TABLE public.custom_object_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.custom_object_records;
CREATE POLICY tenant_isolation ON public.custom_object_records
  FOR ALL TO authenticated
  USING (tenant_row_visible(tenant_id))
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR ((tenant_id IS NULL) AND (current_tenant_id() = '00000000-0000-0000-0000-000000000001'::uuid))
  );
DROP TRIGGER IF EXISTS trg_auto_tenant ON public.custom_object_records;
CREATE TRIGGER trg_auto_tenant BEFORE INSERT ON public.custom_object_records
  FOR EACH ROW EXECUTE FUNCTION auto_fill_tenant_id();

CREATE INDEX IF NOT EXISTS idx_custom_object_records_object ON public.custom_object_records(custom_object_id);
CREATE INDEX IF NOT EXISTS idx_custom_object_records_tenant ON public.custom_object_records(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_object_records_number
  ON public.custom_object_records (tenant_id, custom_object_id, record_number);

-- ─── custom_object_line_items: generic child-record storage ───────────────
-- Only used by custom objects with supports_line_items = true. A smaller
-- slot count than the header table — line items are narrower records.
CREATE TABLE IF NOT EXISTS public.custom_object_line_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid,
  parent_record_id   uuid NOT NULL REFERENCES public.custom_object_records(id) ON DELETE CASCADE,
  custom_object_id   uuid NOT NULL REFERENCES public.custom_objects(id) ON DELETE CASCADE,
  sort_order         integer DEFAULT 0,
  custom_data        jsonb DEFAULT '{}'::jsonb,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..10 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_line_items ADD COLUMN IF NOT EXISTS text_%s text', i);
  END LOOP;
  FOR i IN 1..5 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_line_items ADD COLUMN IF NOT EXISTS number_%s numeric', i);
  END LOOP;
  FOR i IN 1..5 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_line_items ADD COLUMN IF NOT EXISTS date_%s date', i);
  END LOOP;
  FOR i IN 1..3 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_line_items ADD COLUMN IF NOT EXISTS boolean_%s boolean', i);
  END LOOP;
  FOR i IN 1..5 LOOP
    EXECUTE format('ALTER TABLE public.custom_object_line_items ADD COLUMN IF NOT EXISTS select_%s text', i);
  END LOOP;
END $$;

ALTER TABLE public.custom_object_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.custom_object_line_items;
CREATE POLICY tenant_isolation ON public.custom_object_line_items
  FOR ALL TO authenticated
  USING (tenant_row_visible(tenant_id))
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR ((tenant_id IS NULL) AND (current_tenant_id() = '00000000-0000-0000-0000-000000000001'::uuid))
  );
DROP TRIGGER IF EXISTS trg_auto_tenant ON public.custom_object_line_items;
CREATE TRIGGER trg_auto_tenant BEFORE INSERT ON public.custom_object_line_items
  FOR EACH ROW EXECUTE FUNCTION auto_fill_tenant_id();

CREATE INDEX IF NOT EXISTS idx_custom_object_line_items_parent ON public.custom_object_line_items(parent_record_id);
CREATE INDEX IF NOT EXISTS idx_custom_object_line_items_tenant ON public.custom_object_line_items(tenant_id);

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ───────────────────────────────────────────────────────────
-- select table_name from information_schema.tables
--   where table_name in ('custom_objects','custom_object_fields','custom_object_records','custom_object_line_items');
--   → 4 rows
-- select policyname, tablename from pg_policies where tablename like 'custom_object%';
--   → tenant_isolation on all 4
-- select count(*) from information_schema.columns where table_name = 'custom_object_records' and column_name like 'text_%';
--   → 20
