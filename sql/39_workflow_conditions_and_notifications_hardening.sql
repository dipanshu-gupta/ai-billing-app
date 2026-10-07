-- ═══════════════════════════════════════════════════════════════════════════
-- Part A — Fix: workflow_rules.conditions column may not exist
--
-- saveWorkflowRule() (context/AppContext.tsx) has sent `{...form, conditions}`
-- straight into .insert()/.update() on workflow_rules for a while now (the
-- multi-condition AND/OR builder), but the base schema
-- (schema_complete_client.sql) never added a `conditions` column to
-- workflow_rules — conditions were originally meant to live in the separate
-- normalized `workflow_conditions` table, which the application code no
-- longer reads or writes at all. On any DB where this column was never
-- added out-of-band, every save of a rule that uses the multi-condition
-- builder fails outright with a "column not found" error. Matches the same
-- class of bug already fixed for field_layout_config in
-- 38_field_layout_page_scope_and_defaults.sql. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.workflow_rules
  ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT '{"logic": "AND", "conditions": []}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════════
-- Part B — Notifications: real row-level security + realtime + indexing
--
-- Audit finding: public.notifications had NO row-level security policies at
-- all. Every access control decision (only fetch/mark-read MY OWN
-- notifications) lived entirely in application code
-- (fetchNotifications/markNotificationRead/markAllNotificationsRead in
-- context/AppContext.tsx), which means anyone with the project's anon key —
-- not just this app's own UI — could read or mark-read ANY user's
-- notifications on the shared multi-tenant DB, across tenants, simply by
-- querying the table directly. This closes that gap at the database layer,
-- which is the layer that actually matters for "enterprise grade":
--   - SELECT/UPDATE are restricted to rows whose recipient_email belongs to
--     the currently authenticated user (auth.uid() -> enterprise_users.email),
--     which incidentally also closes the narrower "two tenants share an
--     email" leak noted in the same audit, since it's keyed off the
--     authenticated identity, not the raw email string.
--   - INSERT is restricted to a recipient_email that actually resolves to a
--     real user — notifications are always created by app logic on behalf
--     of OTHER users (workflow/assignment rules, SLA escalation, approvals),
--     so it can't be scoped to "recipient = me" the way select/update are.
--   - No DELETE policy is defined at all, which under RLS means delete is
--     denied outright — notifications are marked read, never deleted, from
--     the client.
-- This assumes real Supabase Auth (auth.uid()) mapped to
-- enterprise_users.auth_user_id, confirmed in context/AppContext.tsx's
-- login flow (supabase.auth.signInWithPassword + auth_user_id backfill).
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT
  USING (
    recipient_email IN (SELECT email FROM public.enterprise_users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE
  USING (
    recipient_email IN (SELECT email FROM public.enterprise_users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    recipient_email IN (SELECT email FROM public.enterprise_users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS notifications_insert_valid_recipient ON public.notifications;
CREATE POLICY notifications_insert_valid_recipient ON public.notifications
  FOR INSERT
  WITH CHECK (
    recipient_email IN (SELECT email FROM public.enterprise_users)
  );

-- Composite index for the bell's actual query shape (recipient + unread +
-- recency ordering) — previously unindexed beyond the tenant_id/email
-- composite added in 22_notifications_tenant_id.sql, so both the 30s poll
-- and the unread-count derivation were doing a fuller scan than necessary
-- as the table grows.
CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON public.notifications (recipient_email, is_read, created_at DESC);

-- Enable Supabase Realtime on notifications so the bell can subscribe to
-- live inserts/updates instead of relying solely on a 30s poll (see
-- components/layout/Header.tsx — the client-side subscription is added in
-- the matching code fix, this just turns the table on at the DB level).
-- Guarded because ALTER PUBLICATION ... ADD TABLE errors if the table is
-- already a member, and this migration must stay safely re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'workflow_rules' and column_name = 'conditions';
-- → 1 row
-- select policyname, cmd from pg_policies where tablename = 'notifications';
-- → notifications_select_own (SELECT), notifications_update_own (UPDATE),
--   notifications_insert_valid_recipient (INSERT)
-- select relrowsecurity from pg_class where relname = 'notifications';
-- → t
-- select * from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications';
-- → 1 row
