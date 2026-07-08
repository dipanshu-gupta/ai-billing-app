// @ts-nocheck
/**
 * Umbrella Suite ERP — Tenant Resolution Middleware
 *
 * Runs on EVERY request before any page/API handler.
 * Reads the subdomain, resolves the tenant slug, and injects it as a header
 * so server components and API routes can call getTenant() without re-parsing.
 *
 * Routing:
 *   demo.cloud.umbrellasuite.com        → slug = "demo"
 *   abc.prod.cloud.umbrellasuite.com    → slug = "abc"
 *   localhost:3000                  → slug = "demo" (dev fallback)
 *   erp.abccorp.com                 → resolved via custom_domain lookup
 */

import { NextRequest, NextResponse } from 'next/server';

/** Known non-tenant subdomains — skip resolution for these */
const RESERVED = new Set(['www', 'api', 'cdn', 'status', 'mail', 'smtp']);

/** Base domains we own — slug is the part before these */
const BASE_DOMAINS = [
  'cloud.umbrellasuite.com',
  'localhost',
  '127.0.0.1',
];

function extractSlug(host: string): string {
  // Remove port
  const hostname = host.split(':')[0];

  // localhost / dev → always "demo"
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'demo';

  // Check if host matches *.basedomain
  for (const base of BASE_DOMAINS) {
    if (hostname.endsWith('.' + base)) {
      const prefix = hostname.slice(0, hostname.length - base.length - 1);
      // Handle nested: abc.prod.cloud.umbrellasuite.com → first segment = "abc"
      const slug = prefix.split('.')[0];
      if (RESERVED.has(slug)) return 'demo';
      return slug;
    }
  }

  // Could be a custom domain — we'll set slug = "__custom__" and let
  // the server resolve it by custom_domain field in DB
  return '__custom__';
}

export function middleware(req: NextRequest) {
  const host  = req.headers.get('host') || 'localhost';
  const slug  = extractSlug(host);
  const url   = req.nextUrl.clone();

  const res = NextResponse.next();

  // Inject headers consumed by getTenant() in server components
  res.headers.set('x-tenant-slug',   slug);
  res.headers.set('x-tenant-host',   host);
  res.headers.set('x-forwarded-host', host);

  return res;
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
