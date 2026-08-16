-- ═══════════════════════════════════════════════════════════════════════════
-- UMBRELLA SUITE — 04: PRODUCT IMAGE ATTACHMENTS (run AFTER 01/02/03)
-- Supports the new ProductImages gallery (B2B products + Retail retailProducts):
--   • 'product-images' Storage bucket (PUBLIC) with tenant-scoped write policies
--   • image_url column on products / retail_products
--   • is_primary / public_url columns on record_attachments (multi-image support)
--   • show_product_images toggle on retail_invoice_templates and quote/invoice
--     template tables (DocumentTemplateDesigner)
--   • PostgREST schema reload
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Storage bucket ───────────────────────────────────────────────────────
-- Public bucket: primary product images need to be readable directly (print
-- engines, quote/invoice PDFs) without generating signed URLs per view.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read (bucket is public, but an explicit SELECT policy is required
-- for the storage.objects table itself to allow anon/authenticated reads).
DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated tenant users may upload/replace product images.
DROP POLICY IF EXISTS product_images_auth_insert ON storage.objects;
CREATE POLICY product_images_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS product_images_auth_update ON storage.objects;
CREATE POLICY product_images_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

-- Authenticated tenant users may delete product images (used by the
-- gallery's delete button).
DROP POLICY IF EXISTS product_images_auth_delete ON storage.objects;
CREATE POLICY product_images_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');

-- ─── 2. record_attachments RLS — VERIFICATION ONLY ──────────────────────────
-- record_attachments is already included in the tenant_tables array in
-- 01_shared_db_tenant_isolation_rls.sql / 02_dedicated_tenant_db_upgrade.sql,
-- which creates a single `tenant_isolation` policy with `FOR ALL` (covers
-- SELECT/INSERT/UPDATE/DELETE, not just SELECT). No new policy is needed here
-- — this section exists purely to document that it was checked, per the
-- request. If record_attachments RLS is ever found to be SELECT-only on a
-- given tenant DB, re-run 01_shared_db_tenant_isolation_rls.sql (or
-- 02_dedicated_tenant_db_upgrade.sql for dedicated-plan tenants) to restore
-- the FOR ALL policy — do not create a narrower one-off policy here.

-- ─── 3. New columns on record_attachments (multi-image gallery support) ─────
ALTER TABLE public.record_attachments ADD COLUMN IF NOT EXISTS is_primary  boolean DEFAULT false;
ALTER TABLE public.record_attachments ADD COLUMN IF NOT EXISTS public_url  text;

-- ─── 4. image_url on products / retail_products ─────────────────────────────
ALTER TABLE public.products        ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.retail_products ADD COLUMN IF NOT EXISTS image_url text;

-- ─── 5. show_product_images toggle columns ──────────────────────────────────
-- Retail receipt/invoice designer (RetailInvoiceDesigner.tsx)
ALTER TABLE public.retail_invoice_templates ADD COLUMN IF NOT EXISTS show_product_images boolean DEFAULT false;

-- B2B quote/invoice designer (DocumentTemplateDesigner.tsx) — this designer
-- stores its whole layout as a `sections` JSON blob (see 'items'.settings.columns
-- in the app code), so the per-column "show image" toggle lives inside that
-- JSON rather than as a dedicated table column. No schema column needed for
-- quote_templates / invoice_templates — flagging this explicitly so it isn't
-- mistaken for an oversight.

-- ─── 6. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attach_primary ON public.record_attachments (tenant_id, record_type, record_id, is_primary);

-- ─── 7. PostgREST schema reload ──────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION QUERIES (run manually after applying) ─────────────────────
-- 1. select * from storage.buckets where id = 'product-images';         → public = true
-- 2. As an authenticated tenant user: upload a file, then
--    select * from record_attachments where record_type='products' order by uploaded_at desc limit 1;
-- 3. select column_name from information_schema.columns
--    where table_name='products' and column_name='image_url';          → 1 row
-- 4. select column_name from information_schema.columns
--    where table_name='retail_products' and column_name='image_url';   → 1 row
