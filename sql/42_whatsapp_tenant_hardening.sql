-- ═══════════════════════════════════════════════════════════════════════════
-- WhatsApp — multi-tenant hardening
--
-- Fixes found in the WhatsApp tenancy audit:
--
--  1. whatsapp_message_log had a SELECT policy "whatsapp_message_log_tenant_read"
--     granted TO public with USING (true). Despite its name it did no tenant
--     filtering at all: anyone holding the (public) anon key could read EVERY
--     tenant's WhatsApp messages - customer phone numbers and message text.
--     Migration 17 deliberately created no policies; this one was added later
--     by hand, evidently so the browser-side inbox could read the table.
--     Replaced with the standard tenant_isolation policy (read-only for
--     signed-in users; all writes go through the service-role API routes).
--
--  2. Inbound customer messages could not be attributed to a tenant (the
--     webhook found two tenants configured with the same phone_number_id) and
--     were stored with tenant_id NULL. Rows whose sender has only ever been
--     messaged by ONE tenant are attributed to it here; anything ambiguous is
--     deliberately left NULL (visible only to the platform workspace) rather
--     than guessed.
--
--  3. Meta retries webhook deliveries; the same inbound message id was stored
--     more than once. De-duplicates existing inbound rows, then makes
--     meta_message_id unique so it cannot recur.
--
--  4. A phone_number_id must belong to exactly ONE workspace, because Meta's
--     webhook identifies the receiving number and nothing else. Enforced with
--     a unique index - but only if no duplicates exist yet. If they do, this
--     script says so (NOTICE) instead of failing; fix the duplicate in Admin
--     Tools -> WhatsApp (or by clearing one config row), then re-run it.
--
-- Idempotent - safe to re-run on the shared DB and on dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Replace the open read policy with tenant isolation ────────────────
DROP POLICY IF EXISTS whatsapp_message_log_tenant_read ON public.whatsapp_message_log;
DROP POLICY IF EXISTS tenant_isolation ON public.whatsapp_message_log;
CREATE POLICY tenant_isolation ON public.whatsapp_message_log
  FOR SELECT
  TO authenticated
  USING (tenant_row_visible(tenant_id));

-- The anonymous role has no business touching any WhatsApp table.
REVOKE ALL ON public.whatsapp_message_log FROM anon;
REVOKE ALL ON public.whatsapp_config      FROM anon;
REVOKE ALL ON public.whatsapp_templates   FROM anon;

-- ─── 3a. De-duplicate inbound rows that Meta delivered more than once ─────
DELETE FROM public.whatsapp_message_log a
 USING public.whatsapp_message_log b
 WHERE a.direction = 'inbound' AND b.direction = 'inbound'
   AND a.meta_message_id IS NOT NULL
   AND a.meta_message_id = b.meta_message_id
   AND (a.created_at, a.id) > (b.created_at, b.id);

-- ─── 2. Attribute orphaned inbound messages where it is unambiguous ───────
UPDATE public.whatsapp_message_log i
   SET tenant_id = m.tid
  FROM (
    SELECT regexp_replace(recipient_phone, '\D', '', 'g') AS ph,
           min(tenant_id::text)::uuid                    AS tid
      FROM public.whatsapp_message_log
     WHERE direction = 'outbound' AND tenant_id IS NOT NULL
     GROUP BY 1
    HAVING count(DISTINCT tenant_id) = 1
  ) m
 WHERE i.tenant_id IS NULL
   AND i.direction = 'inbound'
   AND regexp_replace(i.recipient_phone, '\D', '', 'g') = m.ph;

-- ─── 3b. A Meta message id can only ever be stored once ───────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_log_meta_message_id
  ON public.whatsapp_message_log (meta_message_id)
  WHERE meta_message_id IS NOT NULL;

-- ─── 4. One WhatsApp number -> one workspace ──────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_config
     WHERE phone_number_id IS NOT NULL
     GROUP BY phone_number_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'whatsapp_config has the same phone_number_id on more than one tenant - unique index NOT created. Find them with: select tenant_id, phone_number_id from whatsapp_config where phone_number_id in (select phone_number_id from whatsapp_config group by 1 having count(*) > 1); clear or change one, then re-run this script.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_config_phone_number_id
      ON public.whatsapp_config (phone_number_id)
      WHERE phone_number_id IS NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ───────────────────────────────────────────────────────────
-- select policyname, roles, cmd, qual from pg_policies where tablename = 'whatsapp_message_log';
--   -> exactly one row: tenant_isolation, {authenticated}, SELECT, tenant_row_visible(tenant_id)
-- select count(*) from whatsapp_message_log where tenant_id is null;
--   -> only the inbound rows that could not be attributed unambiguously
-- select count(*) from (select meta_message_id from whatsapp_message_log
--   where meta_message_id is not null group by 1 having count(*) > 1) d;
--   -> 0
