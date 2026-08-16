-- ═══════════════════════════════════════════════════════════════════════════
-- UMBRELLA SUITE — 06: ENTERPRISE PAGINATION INDEXES (run AFTER 05)
-- Supports the interim LIST_FETCH_LIMIT capping added to AppContext.tsx's
-- main list-fetch functions, and is forward-compatible with future
-- keyset/cursor pagination (created_at + id).
--
-- NOTE: 01_shared_db_tenant_isolation_rls.sql already created
-- `idx_{table}_tenant_created ON (tenant_id, created_at DESC)` for the main
-- list tables on the SHARED DB. This migration:
--   (a) adds the `id` tiebreaker column those indexes are missing, needed for
--       stable keyset pagination when multiple rows share a created_at value
--       (as a new index rather than dropping/recreating the existing one —
--       zero-risk, minor extra storage);
--   (b) fills a real gap on DEDICATED tenant DBs, where
--       02_dedicated_tenant_db_upgrade.sql only added `(created_at DESC)`
--       indexes for customers/orders/invoices/leads/opportunities/
--       retail_orders/retail_invoices — contacts, products, activities,
--       quotations, retail_customers, retail_products, and retail_activities
--       had no created_at index at all.
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── A. Shared DB: add (tenant_id, created_at DESC, id) tiebreaker indexes ──
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'customers','contacts','products','leads','opportunities','orders','invoices','activities',
    'quotations','retail_customers','retail_products','retail_activities','retail_orders','retail_invoices'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = t AND column_name = 'tenant_id') THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tenant_created_id ON public.%I (tenant_id, created_at DESC, id)', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── B. Dedicated tenant DBs: (created_at DESC, id) for every list table ────
-- Runs safely on the shared DB too (tenant_id column check above already
-- covers that case; this block is a no-op there since those tables DO have
-- tenant_id and are handled by part A — but IF NOT EXISTS makes re-running
-- harmless either way, and dedicated DBs have no tenant_id column at all).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'customers','contacts','products','leads','opportunities','orders','invoices','activities',
    'quotations','retail_customers','retail_products','retail_activities','retail_orders','retail_invoices'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = t AND column_name = 'tenant_id') THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_created_id ON public.%I (created_at DESC, id)', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── C. PostgREST schema reload ──────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION QUERIES (run manually after applying) ─────────────────────
-- 1. select indexname from pg_indexes where tablename='customers';
--    → should include idx_customers_tenant_created_id (shared DB) or
--      idx_customers_created_id (dedicated DB), alongside the pre-existing ones.
-- 2. explain analyze select * from customers order by created_at desc, id limit 500;
--    → should show an Index Scan, not a Seq Scan, once a tenant has enough rows.
