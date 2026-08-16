-- ═══════════════════════════════════════════════════════════════════════════
-- UMBRELLA SUITE — 09: FAST REPORTS SCHEMA COMPLETENESS (run AFTER 08)
-- Defensive fix: ensures the `reports` table actually has every column
-- FastReportsPage.tsx / AppContext.tsx's saveReport/fetchReports read and
-- write. A missing column here would make every save/fetch fail — and
-- fetchReports previously swallowed errors silently (fixed in app code),
-- so this was invisible. Running this rules out "missing column" as a cause
-- regardless of what state the table was left in on any given database.
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  name          text NOT NULL,
  object_type   text NOT NULL,
  columns       jsonb DEFAULT '[]'::jsonb,
  filters       jsonb DEFAULT '{}'::jsonb,
  config        jsonb DEFAULT '{}'::jsonb,
  grouping      text,
  chart_type    text,
  chart_field   text,
  is_public     boolean DEFAULT false,
  created_by    text NOT NULL,
  organization_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- In case the table already existed with a different/partial shape, add
-- whatever's missing without touching existing data.
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS tenant_id       uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS columns         jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS filters         jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS config          jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS grouping        text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS chart_type      text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS chart_field     text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_public       boolean DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_reports_lookup ON public.reports (tenant_id, created_by, object_type);

-- ─── RLS — same shared-DB-vs-dedicated-DB detection as 08_list_view_prefs.sql ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'tenant_row_visible'
  ) THEN
    EXECUTE 'ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS reports_tenant_isolation ON public.reports';
    EXECUTE 'CREATE POLICY reports_tenant_isolation ON public.reports
      FOR ALL TO authenticated
      USING (public.tenant_row_visible(tenant_id))
      WITH CHECK (public.tenant_row_visible(tenant_id) OR tenant_id IS NULL)';
  END IF;
END $$;

-- Auto-stamp tenant_id on insert (exists on both shared and dedicated DBs).
DROP TRIGGER IF EXISTS trg_auto_tenant ON public.reports;
CREATE TRIGGER trg_auto_tenant BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_tenant_id();

-- ─── PostgREST schema reload ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION QUERIES (run manually after applying) ─────────────────────
-- 1. select column_name from information_schema.columns where table_name='reports'
--    order by column_name;
--    → should include: chart_field, chart_type, columns, config, created_at,
--      created_by, filters, grouping, id, is_public, name, object_type,
--      organization_id, tenant_id, updated_at
-- 2. Save a report from Fast Reports in the app, then:
--    select id, name, created_by, tenant_id, is_public from public.reports
--    order by created_at desc limit 5;
--    → the report you just saved should appear, with tenant_id populated
--      (not null, unless this is the demo tenant on the shared DB).
