-- ═══════════════════════════════════════════════════════════════════════════
-- Add tenant_id to notifications (if not already present)
--
-- Fixes a real, confirmed bug: createNotification never set tenant_id on
-- insert, while fetchNotifications filtered strictly by it for any
-- non-demo tenant (.eq('tenant_id', tid), no null fallback). That meant
-- every notification created for a real tenant became permanently
-- invisible to its own fetch — notifications were being created
-- successfully but never shown to anyone except the special demo tenant.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_recipient
  ON public.notifications (tenant_id, recipient_email);

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'notifications' and column_name = 'tenant_id';
-- → 1 row
