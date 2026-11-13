import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
const ROOT = process.env.REPO;
const HERE = new URL('./', import.meta.url).pathname;
export async function resolve(spec, ctx, next) {
  if (spec === '@supabase/supabase-js') return { url: pathToFileURL(HERE + 'supabase-stub.ts').href, shortCircuit: true, format: 'module-typescript' };
  let p = null;
  if (spec.startsWith('@/')) p = ROOT + '/' + spec.slice(2);
  else if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL?.includes('/lib/')) p = new URL(spec, ctx.parentURL).pathname;
  if (p) { for (const c of [p, p + '.ts', p + '.tsx']) if (existsSync(c) && !c.endsWith('/')) return { url: pathToFileURL(c).href, shortCircuit: true, format: 'module-typescript' }; }
  return next(spec, ctx);
}
