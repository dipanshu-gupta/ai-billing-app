-- =============================================================================
-- WhatsApp template preview text - for readable conversation logging
--
-- The app has no way to know a Meta-approved template's actual wording -
-- that text lives in Meta Business Manager, not in this app's database.
-- Without it, the conversation log could only show "[Template: key_name]",
-- which is technically accurate but unreadable as an actual conversation.
--
-- This lets the admin enter the template's exact approved text once (with
-- {{1}}, {{2}} placeholders matching Meta's own template), so the app can
-- substitute the resolved values in and log/display the real message
-- content - purely for readability in the conversation view; it has no
-- effect on what's actually sent to Meta, which still uses the template
-- name/params directly as it always has.
--
-- Idempotent - safe to re-run on both the shared DB and dedicated tenant DBs.
-- =============================================================================

ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS preview_text text;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------
-- VERIFICATION
-- ------------------------------------------------------------------------
-- select column_name from information_schema.columns
--   where table_name = 'whatsapp_templates' and column_name = 'preview_text';
-- expect 1 row
