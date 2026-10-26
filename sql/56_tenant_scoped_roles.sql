-- 56_tenant_scoped_roles.sql
-- Run ONCE on the MASTER / shared Supabase project only (etlwodoafhqflaknmyln).
-- Do NOT run on dedicated tenant databases (their roles already live in their own database).
-- Pure ASCII, idempotent (safe to run again), no CASCADE.
--
-- Problem fixed: every role (System Administrator, Sales Administrator, ...) had tenant_id = NULL and was SHARED by
-- every workspace on the shared database. Ticking or unticking a permission (for example "Manage Bookings") for a
-- role in one workspace changed it for every other workspace using that role, and the roles / role_permissions /
-- permissions tables allowed ANY signed-in user of ANY workspace to edit them.
--
-- After this script:
--   * every shared-database workspace has its OWN copy of each role it uses (same name, code and permissions);
--   * each user points at their own workspace's copy;
--   * a workspace can only see and edit its own roles, and only its administrators can change them;
--   * roles with tenant_id = NULL stay as read-only templates (used when a new workspace is provisioned).

-- 1. Who is an administrator of the caller's workspace (used by the policies below).
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.enterprise_users eu
     WHERE eu.tenant_id = public.current_tenant_id()
       AND (eu.auth_user_id = auth.uid()
            OR (eu.auth_user_id IS NULL AND lower(eu.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
       AND lower(coalesce(eu.status, 'active')) <> 'inactive'
       AND (eu.is_admin = true
            OR EXISTS (SELECT 1
                         FROM public.role_permissions rp
                         JOIN public.permissions p ON p.id = rp.permission_id
                        WHERE rp.role_id = eu.role_id
                          AND p.permission_code IN ('__admin__', 'admin_tools_view', 'admintool_security_access')))
  )
$fn$;

REVOKE ALL ON FUNCTION public.is_tenant_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO authenticated;

-- 2. Give every shared-database workspace its own copy of the roles.
--    Standard roles are copied to every shared workspace; any other (custom) global role is copied only to the
--    workspaces whose users actually use it. Users and extra-role links are then re-pointed to the copy.
DO $mig$
DECLARE
  t   record;
  r   record;
  nid uuid;
BEGIN
  FOR t IN
    SELECT id FROM public.tenants
     WHERE coalesce(plan, 'shared') NOT IN ('dedicated', 'enterprise')
  LOOP
    FOR r IN
      SELECT * FROM public.roles g
       WHERE g.tenant_id IS NULL
         AND (g.role_code IN ('SYSADMIN', 'SALES_ADMIN', 'SALES_MGR', 'SALES_REP')
              OR EXISTS (SELECT 1 FROM public.enterprise_users eu WHERE eu.tenant_id = t.id AND eu.role_id = g.id))
    LOOP
      SELECT id INTO nid FROM public.roles WHERE tenant_id = t.id AND role_code = r.role_code LIMIT 1;
      IF nid IS NULL THEN
        INSERT INTO public.roles (role_name, role_code, description, status, data_scope, tenant_id)
        VALUES (r.role_name, r.role_code, r.description, coalesce(r.status, 'Active'), coalesce(r.data_scope, 'own'), t.id)
        RETURNING id INTO nid;
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT nid, rp.permission_id FROM public.role_permissions rp WHERE rp.role_id = r.id;
      END IF;
      UPDATE public.enterprise_users SET role_id = nid WHERE tenant_id = t.id AND role_id = r.id;
      UPDATE public.user_roles ur SET role_id = nid
        FROM public.enterprise_users eu
       WHERE ur.enterprise_user_id = eu.id AND eu.tenant_id = t.id AND ur.role_id = r.id;
      UPDATE public.user_roles ur SET tenant_id = t.id
        FROM public.enterprise_users eu
       WHERE ur.enterprise_user_id = eu.id AND eu.tenant_id = t.id AND ur.tenant_id IS NULL;
      nid := NULL;
    END LOOP;
  END LOOP;
END
$mig$;

-- 3. Row level security: own workspace only; changes by workspace administrators only.
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_all ON public.roles;
DROP POLICY IF EXISTS auth_read_roles ON public.roles;
DROP POLICY IF EXISTS auth_write_roles ON public.roles;
DROP POLICY IF EXISTS roles_select_own ON public.roles;
DROP POLICY IF EXISTS roles_insert_admin ON public.roles;
DROP POLICY IF EXISTS roles_update_admin ON public.roles;
DROP POLICY IF EXISTS roles_delete_admin ON public.roles;

CREATE POLICY roles_select_own ON public.roles FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);
CREATE POLICY roles_insert_admin ON public.roles FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_tenant_admin());
CREATE POLICY roles_update_admin ON public.roles FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY roles_delete_admin ON public.roles FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_tenant_admin());

DROP POLICY IF EXISTS auth_all ON public.role_permissions;
DROP POLICY IF EXISTS auth_read_role_permissions ON public.role_permissions;
DROP POLICY IF EXISTS auth_write_role_permissions ON public.role_permissions;
DROP POLICY IF EXISTS rp_select_own ON public.role_permissions;
DROP POLICY IF EXISTS rp_insert_admin ON public.role_permissions;
DROP POLICY IF EXISTS rp_delete_admin ON public.role_permissions;

CREATE POLICY rp_select_own ON public.role_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id
                  AND (r.tenant_id = public.current_tenant_id() OR r.tenant_id IS NULL)));
CREATE POLICY rp_insert_admin ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin()
              AND EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id = public.current_tenant_id()));
CREATE POLICY rp_delete_admin ON public.role_permissions FOR DELETE TO authenticated
  USING (public.is_tenant_admin()
         AND EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id = public.current_tenant_id()));

-- The permission catalog is shared (codes like retail_orders_view mean the same everywhere): everyone may read it,
-- workspace administrators may add or rename entries (new custom objects add their own codes), nobody may delete.
DROP POLICY IF EXISTS auth_all ON public.permissions;
DROP POLICY IF EXISTS auth_read_permissions ON public.permissions;
DROP POLICY IF EXISTS auth_write_permissions ON public.permissions;
DROP POLICY IF EXISTS perm_select_all ON public.permissions;
DROP POLICY IF EXISTS perm_insert_admin ON public.permissions;
DROP POLICY IF EXISTS perm_update_admin ON public.permissions;

CREATE POLICY perm_select_all ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY perm_insert_admin ON public.permissions FOR INSERT TO authenticated WITH CHECK (public.is_tenant_admin());
CREATE POLICY perm_update_admin ON public.permissions FOR UPDATE TO authenticated USING (public.is_tenant_admin()) WITH CHECK (public.is_tenant_admin());

-- 4. Check (should list each workspace with its own roles, and zero users still on a shared NULL-tenant role).
SELECT t.slug, r.role_code, r.role_name,
       (SELECT count(*) FROM public.enterprise_users eu WHERE eu.role_id = r.id) AS users,
       (SELECT count(*) FROM public.role_permissions rp WHERE rp.role_id = r.id) AS permissions
  FROM public.roles r LEFT JOIN public.tenants t ON t.id = r.tenant_id
 ORDER BY t.slug NULLS FIRST, r.role_code;
