-- ═══════════════════════════════════════════════════════════════════════════
-- WhatsApp customization — configurable field mapping, conditional sending,
-- document attachment intent, and business-side notifications.
--
-- Previously every template's placeholders were filled by a hardcoded
-- array built directly in React component code (e.g. [edited.customer,
-- invoiceNumber, String(edited.amount)]) - meaning changing what a
-- template sends required a code change, not an admin setting. This adds
-- param_mappings: an admin-configurable list of which field (standard or
-- custom) fills each placeholder, resolved automatically at send time.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.whatsapp_templates
  -- Which object this template's field mappings are defined against, e.g.
  -- 'retailOrders' - needed to know whether {{1}} means "the order's
  -- customer field" vs "the invoice's customer field" (usually the same
  -- name, but the object determines where the value is actually read from).
  ADD COLUMN IF NOT EXISTS object_type text,
  -- Per-placeholder field mapping: an ordered array of
  -- { field_key, field_type: 'standard'|'custom', label }, one entry per
  -- {{1}}, {{2}}, etc. When set, the send API resolves parameters directly
  -- from the record automatically instead of requiring the caller to build
  -- the array manually - the actual "customizable, not hardcoded" fix.
  ADD COLUMN IF NOT EXISTS param_mappings jsonb DEFAULT '[]'::jsonb,
  -- Document attachment intent — which generated document (if any) to
  -- attach as a media header on the WhatsApp message. Actual PDF
  -- generation and upload to Meta's media API is a separate, substantial
  -- integration not yet built; this column defines the *intent* so the
  -- admin UI and send route have something concrete to build against next.
  ADD COLUMN IF NOT EXISTS attach_document boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_source text, -- e.g. 'invoice_pdf', 'quote_pdf'
  -- Send conditions — reuses the exact same { logic, conditions: [] }
  -- format already used by Workflow Rules, Approval Processes, and SLA
  -- Policies, including line-item conditions. Lets an admin restrict a
  -- template to specific situations (e.g. only send Invoice Notice if
  -- amount > 5000) without any code change.
  ADD COLUMN IF NOT EXISTS send_conditions jsonb DEFAULT '{"logic":"AND","conditions":[]}'::jsonb;

ALTER TABLE public.whatsapp_config
  -- A phone number to notify for "to business" automated messages (e.g.
  -- "a rental is due back tomorrow" going to staff, not just the
  -- customer) - distinct from display_phone_number, which is the
  -- tenant's own outgoing WhatsApp number shown to customers, not a
  -- number that receives anything.
  ADD COLUMN IF NOT EXISTS business_notify_phone text;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'whatsapp_templates'
--   and column_name in ('object_type','param_mappings','attach_document','document_source','send_conditions');
-- → 5 rows
-- select column_name from information_schema.columns
--   where table_name = 'whatsapp_config' and column_name = 'business_notify_phone';
-- → 1 row
