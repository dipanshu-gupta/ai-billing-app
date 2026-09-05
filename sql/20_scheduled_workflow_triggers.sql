-- ═══════════════════════════════════════════════════════════════════════════
-- Schedule-based Workflow Triggers ("before_date")
-- Adds a new workflow trigger type that fires a configurable amount of time
-- BEFORE a date field reaches the current moment — e.g. "1 day before rental
-- return date" or "1 hour before delivery date" — rather than being tied to
-- a create/update event. Works for both header-level date fields (e.g.
-- delivery_date on an order) and line-item-level date fields (e.g.
-- rental_end_date on a specific line item within an order).
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.workflow_rules
  ADD COLUMN IF NOT EXISTS schedule_date_field  text,      -- which date field to watch, e.g. 'rental_end_date', 'delivery_date'
  ADD COLUMN IF NOT EXISTS schedule_date_scope  text DEFAULT 'header',   -- 'header' | 'line_item'
  ADD COLUMN IF NOT EXISTS schedule_offset_value integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS schedule_offset_unit  text DEFAULT 'days',   -- 'hours' | 'days'
  -- For date-only fields (no time-of-day component, e.g. rental_end_date),
  -- there's no inherent "time" to count backwards from for an hour-based
  -- offset. This defines what time of day that date is treated as due —
  -- defaults to 6:00 PM, a reasonable "due by end of day" assumption.
  -- Ignored for offset_unit='days' and for fields that already store a
  -- full timestamp.
  ADD COLUMN IF NOT EXISTS schedule_due_time    text DEFAULT '18:00';

-- Records which rule has already fired for which record (and, for
-- line-item-scoped rules, which specific line item) — without this, the
-- periodic check would re-fire the same notification every time it runs
-- while the record still falls within the offset window.
CREATE TABLE IF NOT EXISTS public.workflow_rule_firings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid,
  workflow_rule_id  uuid NOT NULL,
  record_type       text NOT NULL,
  record_id         text NOT NULL,     -- the header record's own number (order_number, lead_number, etc.)
  line_item_id      text,              -- null for header-scoped triggers; the line item's own id for line-item-scoped ones
  fired_at          timestamptz DEFAULT now(),
  CONSTRAINT workflow_rule_firings_unique UNIQUE (workflow_rule_id, record_id, line_item_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_firings_lookup
  ON public.workflow_rule_firings (workflow_rule_id, record_id, line_item_id);

ALTER TABLE public.workflow_rule_firings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workflow_rule_firings_tenant_all ON public.workflow_rule_firings;
CREATE POLICY workflow_rule_firings_tenant_all ON public.workflow_rule_firings
  FOR ALL USING (true) WITH CHECK (true); -- app-layer tenant scoping applies, matching this app's existing admin-data tables; no credentials or PII stored here

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'workflow_rules' and column_name like 'schedule_%';
-- → 5 rows
-- select table_name from information_schema.tables where table_name = 'workflow_rule_firings';
-- → 1 row
