-- 52_marketing_cloud.sql
-- Marketing Cloud (Orbit) integration for Umbrella Suite. Pure ASCII. Safe to re-run.
--
-- RUN ON: the MASTER Supabase project (etlwodoafhqflaknmyln) - whole file.
-- ALSO RUN ON: every DEDICATED tenant database - PART B only.
--
-- PART A (master only): idempotency log for CRM events coming from Orbit.
-- PART B (master + each dedicated DB): link columns on leads/retail_customers.
-- PART C (master only): turn Marketing Cloud on for a tenant (edit the slug).

-- ===================== PART A: master only =====================
CREATE TABLE IF NOT EXISTS public.marketing_sync_events (
  tenant_id   uuid NOT NULL,
  event_id    text NOT NULL,
  lead_id     text,
  record_type text,
  record_id   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_sync_events_pkey PRIMARY KEY (tenant_id, event_id)
);
CREATE INDEX IF NOT EXISTS marketing_sync_events_time ON public.marketing_sync_events (created_at);
-- Server-only table: RLS on, no policies -> anon/authenticated see nothing;
-- only the service role used by /api/marketing/* can read or write it.
ALTER TABLE public.marketing_sync_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_sync_events FROM anon, authenticated;


-- Single-use log for Orbit -> ERP single sign-on tokens (jti). Server-only table.
CREATE TABLE IF NOT EXISTS public.orbit_sso_nonces (
  jti        text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orbit_sso_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orbit_sso_nonces FROM anon, authenticated;

-- ===================== PART B: master AND each dedicated DB =====================
ALTER TABLE public.leads            ADD COLUMN IF NOT EXISTS orbit_lead_id text;
ALTER TABLE public.retail_customers ADD COLUMN IF NOT EXISTS orbit_lead_id text;
ALTER TABLE public.retail_customers ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.leads            ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;

-- One CRM record per Orbit lead per tenant. The shared DB has tenant_id;
-- dedicated DBs do not, so the index shape depends on the column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'tenant_id') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS leads_orbit_lead_uq ON public.leads (tenant_id, orbit_lead_id) WHERE orbit_lead_id IS NOT NULL';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS leads_orbit_lead_uq ON public.leads (orbit_lead_id) WHERE orbit_lead_id IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'retail_customers' AND column_name = 'tenant_id') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS retail_customers_orbit_lead_uq ON public.retail_customers (tenant_id, orbit_lead_id) WHERE orbit_lead_id IS NOT NULL';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS retail_customers_orbit_lead_uq ON public.retail_customers (orbit_lead_id) WHERE orbit_lead_id IS NOT NULL';
  END IF;
END
$$;

-- ===================== PART C: master only - enable per tenant =====================
-- tenants.modules is a jsonb array. Replace <slug> with the tenant slug (do not run until edited).
-- Run once per tenant that has bought Marketing Cloud.
UPDATE public.tenants
   SET modules = COALESCE(modules, '[]'::jsonb) || '["marketing"]'::jsonb
 WHERE slug = '<slug>'
   AND NOT (COALESCE(modules, '[]'::jsonb) ? 'marketing');

-- To turn it off again:
-- UPDATE public.tenants SET modules = modules - 'marketing' WHERE slug = '<slug>';
