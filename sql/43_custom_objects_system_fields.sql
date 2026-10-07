-- ═══════════════════════════════════════════════════════════════════════════
-- Custom Objects — standard system fields
--
-- Every custom object (existing and new) now carries the same system
-- fields a standard object has:
--   Record ID (id) · Record Number (display_number) · Record Name (name) ·
--   Status · Owner · Created At/By · Last Updated At/By · Organization ·
--   Business Unit
-- Most already existed on custom_object_records; this adds the two that did
-- not - name and display_number - backfills them for existing records, and
-- keeps display_number sequential per object going forward.
--
-- Idempotent - safe to re-run, on the shared DB and on dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custom_object_records ADD COLUMN IF NOT EXISTS name           text;
ALTER TABLE public.custom_object_records ADD COLUMN IF NOT EXISTS display_number integer;

-- ─── Sequential display number, per custom object ─────────────────────────
CREATE OR REPLACE FUNCTION public.custom_object_record_set_display_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_number IS NULL THEN
    -- serialise concurrent inserts into the same object so two records can
    -- never be handed the same number
    PERFORM pg_advisory_xact_lock(hashtext(NEW.custom_object_id::text));
    SELECT COALESCE(MAX(display_number), 0) + 1 INTO NEW.display_number
      FROM public.custom_object_records
     WHERE custom_object_id = NEW.custom_object_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_custom_object_display_number ON public.custom_object_records;
CREATE TRIGGER trg_custom_object_display_number
  BEFORE INSERT ON public.custom_object_records
  FOR EACH ROW EXECUTE FUNCTION public.custom_object_record_set_display_number();

-- ─── Backfill display numbers for existing records (oldest = 1) ───────────
UPDATE public.custom_object_records r
   SET display_number = x.rn
  FROM (
    SELECT id, row_number() OVER (PARTITION BY custom_object_id ORDER BY created_at, id) AS rn
      FROM public.custom_object_records
     WHERE display_number IS NULL
  ) x
 WHERE r.id = x.id
   AND r.display_number IS NULL
   -- only safe when nothing is numbered yet for that object
   AND NOT EXISTS (SELECT 1 FROM public.custom_object_records o
                    WHERE o.custom_object_id = r.custom_object_id AND o.display_number IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_object_records_display_number
  ON public.custom_object_records (custom_object_id, display_number);
CREATE INDEX IF NOT EXISTS idx_custom_object_records_obj_created
  ON public.custom_object_records (custom_object_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_object_records_name
  ON public.custom_object_records (custom_object_id, name);

-- ─── Backfill record names for existing records ───────────────────────────
-- Existing records had no name column: use the object's first text field
-- (the one an admin would have treated as the title), else the old record
-- number. Dynamic SQL because the storage column differs per object.
DO $$
DECLARE o record; col text;
BEGIN
  FOR o IN SELECT id FROM public.custom_objects LOOP
    SELECT f.storage_column INTO col
      FROM public.custom_object_fields f
     WHERE f.custom_object_id = o.id AND f.scope = 'header' AND f.is_active
       AND f.field_type = 'text' AND f.storage_column ~ '^text_[0-9]+$'
     ORDER BY f.sort_order, f.created_at
     LIMIT 1;
    IF col IS NOT NULL THEN
      EXECUTE format('UPDATE public.custom_object_records SET name = NULLIF(btrim(%I), '''') WHERE custom_object_id = %L AND name IS NULL', col, o.id);
    END IF;
  END LOOP;
  UPDATE public.custom_object_records SET name = record_number WHERE name IS NULL;
END $$;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ───────────────────────────────────────────────────────────
-- select custom_object_id, count(*), count(name), count(display_number), max(display_number)
--   from custom_object_records group by 1;
--   -> count = count(name) = count(display_number)
