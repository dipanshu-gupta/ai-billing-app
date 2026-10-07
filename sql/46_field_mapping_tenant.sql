-- ─────────────────────────────────────────────────────────────────────────
-- 46 · Copy Maps (field_mapping_rules) — proper multi-tenant isolation
--
-- Before: the table had an open `USING (true)` policy, so any tenant on a
-- shared database could read (and edit) every other tenant's copy maps, and
-- rows could be saved with tenant_id = NULL.
--
-- After: same pattern as every other per-tenant table —
--   * `tenant_isolation` RLS policy (tenant_row_visible / current_tenant_id)
--   * auto_fill_tenant_id() BEFORE INSERT trigger
--   * rule_type now also allows 'record_conversion_line' (line-item copy maps)
--
-- Existing rows with a NULL tenant_id stay visible only to the default
-- (demo) tenant, exactly like every other table. If you want an existing
-- NULL-tenant rule to belong to a specific tenant, update it by hand:
--   update field_mapping_rules set tenant_id = '<tenant uuid>' where tenant_id is null;
--
-- Dedicated-DB tenants run this file in their own project too.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.field_mapping_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid,
  rule_type           text NOT NULL,
  name                text,
  source_object       text NOT NULL,
  source_field        text NOT NULL,
  source_field_type   text DEFAULT 'custom',
  target_object       text NOT NULL,
  target_field        text NOT NULL,
  target_field_type   text DEFAULT 'custom',
  conversion_context  text,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Rule type is free text; drop any old CHECK that would block the new line-level type.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.field_mapping_rules'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%rule_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.field_mapping_rules DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.field_mapping_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS field_mapping_rules_tenant_all ON public.field_mapping_rules;
DROP POLICY IF EXISTS tenant_isolation ON public.field_mapping_rules;
CREATE POLICY tenant_isolation ON public.field_mapping_rules
  FOR ALL
  TO authenticated
  USING (tenant_row_visible(tenant_id))
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR ((tenant_id IS NULL) AND (current_tenant_id() = '00000000-0000-0000-0000-000000000001'::uuid))
  );

DROP TRIGGER IF EXISTS trg_auto_tenant ON public.field_mapping_rules;
CREATE TRIGGER trg_auto_tenant
  BEFORE INSERT ON public.field_mapping_rules
  FOR EACH ROW EXECUTE FUNCTION auto_fill_tenant_id();

CREATE INDEX IF NOT EXISTS idx_field_mapping_ctx
  ON public.field_mapping_rules (tenant_id, rule_type, conversion_context, is_active);

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ───────────────────────────────────────────────────────────
-- select policyname, qual from pg_policies where tablename = 'field_mapping_rules';  -- tenant_isolation only
-- select count(*) from field_mapping_rules where tenant_id is null;                  -- rules not yet owned by a tenant
