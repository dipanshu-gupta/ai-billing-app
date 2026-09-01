-- ═══════════════════════════════════════════════════════════════════════════
-- WhatsApp Business API integration — per-tenant configuration, approved
-- template mapping, and a message log for both audit trail and automated-
-- reminder deduplication.
--
-- SECURITY MODEL: these tables are NOT meant to be queried directly by the
-- ordinary tenant-scoped Supabase client the rest of the app uses. All reads
-- and writes go through server-side API routes (/api/whatsapp/*) using the
-- service role key. RLS below is a defense-in-depth backstop, not the
-- primary access control — the access_token column is too sensitive to rely
-- on RLS alone given how central this app's client-side Supabase usage is.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid,                          -- null on a dedicated tenant DB (single-row table there)
  is_active           boolean DEFAULT false,          -- master on/off switch for API-based sending
  phone_number_id     text,                           -- Meta Cloud API phone number ID
  business_account_id text,                           -- WhatsApp Business Account ID (WABA)
  access_token        text,                           -- Meta permanent access token — sensitive, server-side only
  display_phone_number text,                          -- e.g. "+91 98765 43210", for display purposes only
  webhook_verify_token text,                          -- for future inbound-message/delivery-status webhook support
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT whatsapp_config_tenant_unique UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid,
  template_key      text NOT NULL,                    -- internal key, e.g. 'rental_return_reminder', 'invoice_notice', 'booking_confirmation'
  meta_template_name text,                             -- EXACT template name as approved in Meta Business Manager
  language_code     text DEFAULT 'en_US',
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  CONSTRAINT whatsapp_templates_tenant_key_unique UNIQUE (tenant_id, template_key)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid,
  record_type     text,                               -- e.g. 'retailOrders', 'retailInvoices'
  record_id       text,                               -- the record's display/order number, for lookup and dedup
  recipient_phone text,
  recipient_type  text,                               -- 'customer' | 'owner'
  send_mode       text,                               -- 'manual' | 'automatic'
  template_key    text,                               -- null for free-form/manual sends
  status          text DEFAULT 'pending',             -- 'sent' | 'failed' | 'pending'
  error_message   text,
  meta_message_id text,                                -- Meta's message ID, for future delivery-status tracking
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_dedup
  ON public.whatsapp_message_log (tenant_id, record_type, record_id, template_key, created_at);

ALTER TABLE public.whatsapp_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_log   ENABLE ROW LEVEL SECURITY;

-- No permissive policies are created here deliberately — with RLS enabled
-- and no policy granting access, the anon/authenticated roles get zero rows
-- by default. Only the service role (which bypasses RLS entirely) can read
-- or write these tables, which is exactly the API routes' access pattern.

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select table_name from information_schema.tables
--   where table_name in ('whatsapp_config','whatsapp_templates','whatsapp_message_log');
-- → 3 rows
