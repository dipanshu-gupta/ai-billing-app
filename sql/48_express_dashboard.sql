-- 48_express_dashboard.sql — Express Dashboard layouts (multi-tenant, idempotent)
-- One row = one dashboard layout. config jsonb = { tabs:[{ id,label,metric:{…},widgets:[…] }] }.
--   scope 'user'   -> a personal layout (owner_email = the user)
--   scope 'tenant' -> the shared/default layout an admin publishes for the whole tenant
-- Dynamic by design: widgets reference objects/fields by key, so new custom fields/objects work with no schema change.

create table if not exists public.express_dashboards (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid,
  name          text not null default 'My Dashboard',
  scope         text not null default 'user' check (scope in ('user','tenant')),
  owner_email   text,
  audience      text not null default 'all',      -- reserved: 'all' | 'admin' | role code, for role-based layouts
  config        jsonb not null default '{}'::jsonb,
  version       integer not null default 1,
  created_by    text,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_express_dash_tenant       on public.express_dashboards (tenant_id);
create index if not exists idx_express_dash_tenant_owner on public.express_dashboards (tenant_id, scope, owner_email);

alter table public.express_dashboards enable row level security;

drop policy if exists tenant_isolation on public.express_dashboards;
create policy tenant_isolation on public.express_dashboards
  for all
  using (tenant_row_visible(tenant_id))
  with check ((tenant_id = current_tenant_id()) or ((tenant_id is null) and (current_tenant_id() = '00000000-0000-0000-0000-000000000001'::uuid)));

drop trigger if exists trg_auto_tenant on public.express_dashboards;
create trigger trg_auto_tenant before insert on public.express_dashboards
  for each row execute function auto_fill_tenant_id();
