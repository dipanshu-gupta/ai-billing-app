-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: Page Layout Designer save/publish silently failing
--
-- Root cause: components/admin/FieldLayoutDesigner.tsx and lib/useFieldLayout.ts
-- both read/write a `page_scope` column on field_layout_config, and
-- FieldLayoutDesigner.tsx / components/admin/AppComposer.tsx both read/write
-- a `default_value` column on field_layout_config / app_custom_fields — but
-- no migration in this sql/ folder ever actually added those columns
-- (18_field_layout_customization.sql created the table without them, and
-- no later migration added them). Every "Publish" or "Save Draft" click was
-- therefore sending an UPDATE/INSERT that named a nonexistent column
-- (page_scope), which Postgres rejects outright — the save always failed,
-- the UI's error toast went unnoticed, and the next load() re-read the
-- unchanged (or, on first-ever visit to any object, still-erroring-so-empty)
-- row set, which looked like the change "reverting." The empty-looking line
-- item field list has the same cause: FieldLayoutDesigner's own load() query
-- filters `.eq('page_scope', pageScope)`, which also errors against a
-- nonexistent column and leaves the field list empty for every object, not
-- just line items.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.field_layout_config
  ADD COLUMN IF NOT EXISTS page_scope   text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS default_value text;

ALTER TABLE public.app_custom_fields
  ADD COLUMN IF NOT EXISTS default_value text;

-- The upsert in FieldLayoutDesigner.tsx targets
-- onConflict: 'tenant_id,object_type,field_key,page_scope' — the original
-- constraint (tenant_id, object_type, field_key) predates page_scope and
-- doesn't match that target, so re-saving an existing field's row (now that
-- the column exists) would insert a duplicate instead of updating it.
-- NULLS NOT DISTINCT (PG15+) makes two NULL tenant_id rows count as the
-- same key for uniqueness — required because tenant_id is null by design on
-- a dedicated per-tenant DB (every row on that DB shares tenant_id = null),
-- and a plain UNIQUE constraint would otherwise treat every such row as
-- distinct, silently allowing duplicates to pile up on every publish there.
ALTER TABLE public.field_layout_config
  DROP CONSTRAINT IF EXISTS field_layout_config_unique;
ALTER TABLE public.field_layout_config
  ADD CONSTRAINT field_layout_config_unique
  UNIQUE NULLS NOT DISTINCT (tenant_id, object_type, field_key, page_scope);

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'field_layout_config' and column_name in ('page_scope','default_value');
-- → 2 rows
-- select column_name from information_schema.columns
--   where table_name = 'app_custom_fields' and column_name = 'default_value';
-- → 1 row
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'field_layout_config_unique';
-- → UNIQUE NULLS NOT DISTINCT (tenant_id, object_type, field_key, page_scope)
