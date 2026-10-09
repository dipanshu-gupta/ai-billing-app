-- 49: Rental blocking statuses — honour an EMPTY list, and re-sync existing bookings
-- when the setting changes. Idempotent; safe to re-run.
--
-- Before: an empty rental_blocking_statuses array was treated as "not configured" and
-- silently replaced by Draft/Pending/Completed, so a tenant that switched every status
-- off still could not book overlapping dates. Existing line items also kept their stored
-- is_blocking = true, because only an order STATUS change re-synced them.
--
-- Now: only a MISSING setting falls back to the default. [] means "nothing blocks".

CREATE OR REPLACE FUNCTION public.rental_blocking_list(p_tenant uuid)
RETURNS text[] LANGUAGE plpgsql STABLE AS $$
DECLARE v jsonb; res text[];
BEGIN
  SELECT settings->'rental_blocking_statuses' INTO v
    FROM public.app_preferences
   WHERE (p_tenant IS NULL OR tenant_id = p_tenant)
   ORDER BY updated_at DESC NULLS LAST
   LIMIT 1;
  IF v IS NULL OR jsonb_typeof(v) <> 'array' THEN
    RETURN ARRAY['Draft','Pending','Completed'];      -- never configured
  END IF;
  SELECT COALESCE(array_agg(x), ARRAY[]::text[]) INTO res FROM jsonb_array_elements_text(v) x;
  RETURN res;                                           -- may legitimately be empty
END $$;

CREATE OR REPLACE FUNCTION public.compute_rental_is_blocking()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text;
BEGIN
  IF NEW.product_id IS NULL OR NEW.rental_start_date IS NULL OR NEW.rental_end_date IS NULL THEN
    NEW.is_blocking := false; RETURN NEW;
  END IF;
  SELECT status INTO v_status FROM public.retail_orders
   WHERE order_number = NEW.order_number AND (NEW.tenant_id IS NULL OR tenant_id = NEW.tenant_id) LIMIT 1;
  IF v_status IS NULL THEN NEW.is_blocking := false; RETURN NEW; END IF;
  NEW.is_blocking := (v_status = ANY(public.rental_blocking_list(NEW.tenant_id)));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.resync_line_items_is_blocking()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_should boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_should := (NEW.status = ANY(public.rental_blocking_list(NEW.tenant_id)));
    UPDATE public.retail_order_line_items SET is_blocking = v_should
     WHERE order_number = NEW.order_number
       AND (NEW.tenant_id IS NULL OR tenant_id = NEW.tenant_id)
       AND product_id IS NOT NULL AND rental_start_date IS NOT NULL AND rental_end_date IS NOT NULL
       AND is_blocking IS DISTINCT FROM v_should;
  END IF;
  RETURN NEW;
END $$;

-- Re-sync every booking of a tenant when its blocking-status setting is saved.
CREATE OR REPLACE FUNCTION public.resync_all_is_blocking_on_pref()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.settings->'rental_blocking_statuses') IS DISTINCT FROM (OLD.settings->'rental_blocking_statuses') THEN
    UPDATE public.retail_order_line_items li
       SET is_blocking = COALESCE((o.status = ANY(public.rental_blocking_list(NEW.tenant_id))), false)
      FROM public.retail_orders o
     WHERE o.order_number = li.order_number
       AND o.tenant_id IS NOT DISTINCT FROM li.tenant_id
       AND li.tenant_id IS NOT DISTINCT FROM NEW.tenant_id
       AND li.product_id IS NOT NULL AND li.rental_start_date IS NOT NULL AND li.rental_end_date IS NOT NULL
       AND li.is_blocking IS DISTINCT FROM COALESCE((o.status = ANY(public.rental_blocking_list(NEW.tenant_id))), false);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_resync_on_pref ON public.app_preferences;
CREATE TRIGGER trg_resync_on_pref AFTER UPDATE OF settings ON public.app_preferences
  FOR EACH ROW EXECUTE FUNCTION public.resync_all_is_blocking_on_pref();

-- One-time repair for settings already saved as [] (all tenants).
UPDATE public.retail_order_line_items li
   SET is_blocking = COALESCE((o.status = ANY(public.rental_blocking_list(li.tenant_id))), false)
  FROM public.retail_orders o
 WHERE o.order_number = li.order_number
   AND o.tenant_id IS NOT DISTINCT FROM li.tenant_id
   AND li.product_id IS NOT NULL AND li.rental_start_date IS NOT NULL AND li.rental_end_date IS NOT NULL
   AND li.is_blocking IS DISTINCT FROM COALESCE((o.status = ANY(public.rental_blocking_list(li.tenant_id))), false);
