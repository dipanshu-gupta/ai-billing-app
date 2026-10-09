-- ─────────────────────────────────────────────────────────────────────────
-- 47 · Page Layout Designer — explicit page-specific override marker
--
-- Page-specific rows (Create / Detail) are now stored ONLY for fields that
-- differ from the "Both Pages" layout, and flagged is_override = true.
-- Older redundant rows (written for every field) are ignored by the resolver
-- when a "Both Pages" row exists, so nothing needs migrating.
-- This is optional-but-recommended: the designer saves fine without it.
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.field_layout_config ADD COLUMN IF NOT EXISTS is_override boolean DEFAULT false;

-- Clean up legacy redundant rows: page-specific rows that only repeat defaults
-- while a "Both Pages" row exists for the same field.
DELETE FROM public.field_layout_config s
USING public.field_layout_config b
WHERE s.page_scope IN ('create','detail')
  AND b.page_scope = 'both'
  AND b.tenant_id IS NOT DISTINCT FROM s.tenant_id
  AND b.object_type = s.object_type AND b.field_key = s.field_key
  AND COALESCE(s.is_override, false) = false
  AND s.custom_label IS NULL AND s.visibility_mode = 'visible' AND s.editability_mode = 'editable'
  AND COALESCE(jsonb_array_length(s.conditional_rules), 0) = 0 AND s.default_value IS NULL;

NOTIFY pgrst, 'reload schema';
