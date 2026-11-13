-- 57_product_barcodes.sql
-- Barcodes on products + extra "pack" barcodes, for scanning items into line-item grids.
-- Run on the MASTER / shared Supabase project AND on every DEDICATED tenant database.
-- Pure ASCII, idempotent (safe to run again), no CASCADE, no data is changed or deleted.
--
--   products.barcode / retail_products.barcode : the product's main barcode (one scan = quantity 1)
--   product_barcodes                           : extra barcodes per product, each with a pack quantity
--                                                (e.g. a carton barcode that adds 12)
-- A barcode is unique inside a workspace. If duplicates already exist the unique index is skipped with a NOTICE
-- (the app still blocks new duplicates); clean them up and run this script again to add the index.

-- 1. Main barcode column (retail_products already has it on most databases).
ALTER TABLE public.products        ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE public.retail_products ADD COLUMN IF NOT EXISTS barcode text;

-- 2. Extra barcodes with pack quantity.
CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid,
  product_type text NOT NULL CHECK (product_type IN ('b2b', 'b2c')),  -- b2b = products, b2c = retail_products
  product_id   text NOT NULL,                                         -- products.id / retail_products.id as text
  barcode      text NOT NULL CHECK (length(btrim(barcode)) > 0),
  pack_qty     numeric NOT NULL DEFAULT 1 CHECK (pack_qty > 0),
  label        text,                                                  -- e.g. "Carton of 12"
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_barcodes_unique_per_tenant
  ON public.product_barcodes (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), product_type, barcode);
CREATE INDEX IF NOT EXISTS product_barcodes_product_idx ON public.product_barcodes (product_type, product_id);

-- 3. Fast lookup of the main barcode.
CREATE INDEX IF NOT EXISTS products_barcode_idx        ON public.products (barcode)        WHERE barcode IS NOT NULL AND barcode <> '';
CREATE INDEX IF NOT EXISTS retail_products_barcode_idx ON public.retail_products (barcode) WHERE barcode IS NOT NULL AND barcode <> '';

-- 4. Main barcode unique per workspace (only when no duplicates exist yet).
DO $uq$
DECLARE
  has_tenant boolean;
  dups int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'tenant_id') INTO has_tenant;

  IF has_tenant THEN
    SELECT count(*) INTO dups FROM (SELECT 1 FROM public.products WHERE coalesce(barcode, '') <> '' GROUP BY tenant_id, barcode HAVING count(*) > 1) d;
  ELSE
    SELECT count(*) INTO dups FROM (SELECT 1 FROM public.products WHERE coalesce(barcode, '') <> '' GROUP BY barcode HAVING count(*) > 1) d;
  END IF;
  IF dups = 0 THEN
    IF has_tenant THEN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products (coalesce(tenant_id, ''00000000-0000-0000-0000-000000000000''::uuid), barcode) WHERE barcode IS NOT NULL AND barcode <> ''''';
    ELSE
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products (barcode) WHERE barcode IS NOT NULL AND barcode <> ''''';
    END IF;
  ELSE
    RAISE NOTICE 'products: % duplicate barcode(s) found - unique index not created', dups;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'retail_products' AND column_name = 'tenant_id') INTO has_tenant;
  IF has_tenant THEN
    SELECT count(*) INTO dups FROM (SELECT 1 FROM public.retail_products WHERE coalesce(barcode, '') <> '' GROUP BY tenant_id, barcode HAVING count(*) > 1) d;
  ELSE
    SELECT count(*) INTO dups FROM (SELECT 1 FROM public.retail_products WHERE coalesce(barcode, '') <> '' GROUP BY barcode HAVING count(*) > 1) d;
  END IF;
  IF dups = 0 THEN
    IF has_tenant THEN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS retail_products_barcode_unique ON public.retail_products (coalesce(tenant_id, ''00000000-0000-0000-0000-000000000000''::uuid), barcode) WHERE barcode IS NOT NULL AND barcode <> ''''';
    ELSE
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS retail_products_barcode_unique ON public.retail_products (barcode) WHERE barcode IS NOT NULL AND barcode <> ''''';
    END IF;
  ELSE
    RAISE NOTICE 'retail_products: % duplicate barcode(s) found - unique index not created', dups;
  END IF;
END
$uq$;

-- 5. Row level security: same isolation as the product tables.
ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.product_barcodes;
DROP POLICY IF EXISTS auth_all ON public.product_barcodes;

DO $rls$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'tenant_row_visible')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'current_tenant_id') THEN
    -- Shared / master database: a workspace sees and writes only its own rows.
    EXECUTE $p$
      CREATE POLICY tenant_isolation ON public.product_barcodes FOR ALL TO authenticated
        USING (public.tenant_row_visible(tenant_id))
        WITH CHECK ((tenant_id = public.current_tenant_id())
                    OR (tenant_id IS NULL AND public.current_tenant_id() = '00000000-0000-0000-0000-000000000001'::uuid))
    $p$;
  ELSE
    -- Dedicated database: the whole database belongs to one workspace.
    EXECUTE 'CREATE POLICY auth_all ON public.product_barcodes FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END
$rls$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_barcodes TO authenticated;

-- 6. Check
SELECT 'products.barcode' AS item, count(*) FILTER (WHERE coalesce(barcode, '') <> '') AS with_barcode FROM public.products
UNION ALL
SELECT 'retail_products.barcode', count(*) FILTER (WHERE coalesce(barcode, '') <> '') FROM public.retail_products
UNION ALL
SELECT 'product_barcodes rows', count(*) FROM public.product_barcodes;
