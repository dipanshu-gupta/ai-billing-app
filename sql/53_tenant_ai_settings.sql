-- 53: per-tenant AI provider settings (run on the SHARED / master database only).
-- Server-only: accessed with the service role from API routes. The API key is
-- stored AES-256-GCM encrypted; plaintext is never stored or returned.
create table if not exists public.tenant_ai_settings (
  tenant_id      uuid primary key references public.tenants(id) on delete cascade,
  provider       text not null,
  model          text not null,
  base_url       text null,
  key_ciphertext text not null,
  key_last4      text not null,
  updated_by     uuid null,
  updated_at     timestamptz not null default now()
);

alter table public.tenant_ai_settings enable row level security;
-- No policies on purpose: anon / authenticated can never read or write this table.
revoke all on public.tenant_ai_settings from anon, authenticated;
