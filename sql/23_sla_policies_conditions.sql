-- ═══════════════════════════════════════════════════════════════════════════
-- Add conditions to sla_policies
-- Brings SLA Policies in line with Workflow Rules and Approval Processes,
-- both of which already support a full multi-condition AND/OR builder
-- (including line-item conditions). SLA Policies never got this upgrade and
-- were still limited to a single condition_field/condition_value pair.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.sla_policies
  ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT '{"logic":"AND","conditions":[]}'::jsonb;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'sla_policies' and column_name = 'conditions';
-- → 1 row
