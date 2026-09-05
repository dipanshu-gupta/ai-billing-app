-- ═══════════════════════════════════════════════════════════════════════════
-- Fix *_number uniqueness to be properly tenant-scoped, across every table
-- with this same gap (found while auditing after the app_custom_fields fix)
--
-- Each of these tables' *_number column was declared UNIQUE globally, with
-- no tenant_id at all - meaning two different tenants on a shared database
-- generating the same *_number (e.g. from a same-millisecond collision,
-- now also separately hardened in generateId() itself) would fail to
-- insert. Confirmed each of these tables already reads with proper
-- tenant scoping in the application code - this migration only closes the
-- write-side uniqueness gap, it does not change any read behavior.
--
-- Same COALESCE approach as the app_custom_fields fix, for the same
-- reason: dedicated-database tenants store tenant_id as NULL (their whole
-- database is already isolated), and Postgres treats every NULL as
-- distinct in a plain unique constraint - COALESCE-ing NULL to a fixed
-- placeholder value correctly enforces per-tenant uniqueness in both the
-- shared-database and dedicated-database cases.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- Run this on the SHARED database primarily (where cross-tenant collisions
-- are actually possible) - harmless but unnecessary on a dedicated tenant's
-- own isolated database.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('customers',           'customer_number'),
      ('retail_customers',    'customer_number'),
      ('retail_products',     'product_number'),
      ('retail_activities',   'activity_number'),
      ('retail_orders',       'order_number'),
      ('retail_invoices',     'invoice_number'),
      ('quotations',          'quote_number'),
      ('workflow_rules',      'rule_number'),
      ('assignment_rules',    'rule_number'),
      ('sla_policies',        'policy_number'),
      ('approval_processes',  'process_number'),
      ('approval_requests',   'request_number')
    ) AS x(table_name, column_name)
  LOOP
    -- Only touch tables that actually exist on this database (some of
    -- these are B2B-only or B2C-only depending on which modules a given
    -- tenant has enabled).
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t.table_name)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = t.table_name AND column_name = t.column_name)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = t.table_name AND column_name = 'tenant_id')
    THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t.table_name, t.table_name || '_' || t.column_name || '_key');
        EXECUTE format('DROP INDEX IF EXISTS %I', t.table_name || '_' || t.column_name || '_key');
        EXECUTE format(
          'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (COALESCE(tenant_id, ''00000000-0000-0000-0000-000000000000''::uuid), %I)',
          t.table_name || '_tenant_' || t.column_name || '_key', t.table_name, t.column_name
        );
        RAISE NOTICE 'Fixed uniqueness scoping on %.%', t.table_name, t.column_name;
      EXCEPTION WHEN dependent_objects_still_exist THEN
        -- A child table's foreign key (e.g. a line-items table) depends on
        -- this exact unique index/constraint - e.g. quotation_line_items
        -- references quotations.quote_number. Properly fixing this would
        -- need tenant_id added to the child table too and the foreign key
        -- rebuilt as a composite (tenant_id, ...) key, referencing a real
        -- constraint rather than an expression index (foreign keys cannot
        -- reference expression-based unique indexes at all). That is a
        -- larger, deliberate schema change - not something to force
        -- through with CASCADE, which would silently drop the foreign key
        -- relationship without rebuilding it. Skipping this table leaves
        -- its original global uniqueness in place (unchanged from before
        -- this migration), rather than leaving a broken or partially-
        -- migrated state.
        RAISE NOTICE 'SKIPPED %.% — a foreign key elsewhere depends on this exact constraint (likely a line-items child table). Left unchanged; needs a dedicated fix that also updates the child table. See migration notes.', t.table_name, t.column_name;
      END;
    ELSE
      RAISE NOTICE 'Skipped % (table/column not present on this database, or no tenant_id column)', t.table_name;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select indexname, tablename from pg_indexes
--   where indexname like '%_tenant_%_key'
--   order by tablename;
-- → one row per table that had a tenant_id column (check the NOTICEs above
--   for which ones were skipped and why)
