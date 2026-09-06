-- ═══════════════════════════════════════════════════════════════════════════
-- WhatsApp Conversation Inbox — proper message content columns
--
-- The webhook receiver (built earlier) stored incoming message text inside
-- error_message as a shortcut ('Reply: <text>'), since at the time there
-- was no conversation-view feature that actually needed clean message
-- content - just something logged so replies weren't silently discarded.
-- Building a real inbox needs proper columns: direction (which way the
-- message went) and message_body (its actual content), not text
-- overloaded into a field meant for send failures.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.whatsapp_message_log
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound', -- 'outbound' | 'inbound'
  ADD COLUMN IF NOT EXISTS message_body text;

-- Backfill: rows already logged as inbound (via the record_type='inbound'
-- convention the webhook used) get direction set correctly, and their
-- message text extracted out of error_message into the new, proper column.
UPDATE public.whatsapp_message_log
  SET direction = 'inbound',
      message_body = regexp_replace(error_message, '^Reply: ', '')
  WHERE record_type = 'inbound' AND direction IS DISTINCT FROM 'inbound';

-- Every other existing row was necessarily an outbound send (this table
-- had no inbound-logging capability before the webhook was added) -
-- direction's DEFAULT 'outbound' already covers this for existing rows
-- with no direction set at all.

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_conversation
  ON public.whatsapp_message_log (tenant_id, recipient_phone, created_at);

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'whatsapp_message_log' and column_name in ('direction','message_body');
-- → 2 rows
-- select direction, count(*) from public.whatsapp_message_log group by direction;
-- → sanity check: inbound rows should roughly match your previous
--   record_type='inbound' row count
