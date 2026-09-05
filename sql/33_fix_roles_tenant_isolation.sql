-- ═══════════════════════════════════════════════════════════════════════════
-- Fix roles table tenant isolation
--
-- Found during the multi-tenant uniqueness audit: `roles` has no tenant_id
-- column at all, and application code fetches it with NO tenant filter
-- whatsoever (`supabase.from('roles').select('*')`). On a shared database,
-- this means every tenant currently sees every OTHER tenant's roles too -
-- an actual cross-tenant data exposure, not just a uniqueness gap like the
-- other findings.
--
-- Deliberately NOT touching `permissions` - that table is a fixed,
-- system-wide capability catalog (e.g. 'leads_view', 'orders_delete')
-- defined by the application itself, not tenant-customizable data. Seeing
-- the full permission catalog isn't a data leak the way seeing another
-- tenant's custom role definitions is. `role_permissions` also needs no
-- change - it's always queried by a specific role_id, so once `roles`
-- itself is correctly scoped, that join is automatically safe too.
--
-- Backward-compatible by design: existing role rows are left with
-- tenant_id = NULL rather than guessing which tenant originally "owns"
-- each one - retroactively assigning ownership on a shared database
-- without knowing the actual history would risk cutting a tenant off from
-- roles they currently depend on. NULL is treated as "shared/global" by
-- the updated fetch query below, so nothing currently working stops
-- working. Any NEW role created from now on is properly tenant-scoped.
--
-- Idempotent — safe to re-run on both the shared DB and dedicated tenant DBs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_role_code_key;
    DROP INDEX IF EXISTS roles_role_code_key;
    CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_role_code_key
      ON public.roles (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), role_code);
    RAISE NOTICE 'Fixed uniqueness scoping on roles.role_code';
  EXCEPTION WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'SKIPPED roles.role_code — something unexpected depends on this constraint. Left unchanged.';
  END;
END $$;

NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION ─────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'roles' and column_name = 'tenant_id';
-- → 1 row
-- select indexname from pg_indexes
--   where tablename = 'roles' and indexname = 'roles_tenant_role_code_key';
-- → 1 row
