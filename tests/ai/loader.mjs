import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
const ROOT = process.env.REPO;
const STUB = new URL('./stubs/', import.meta.url).pathname;
const stubs = { '@/lib/useObjectLabels': 'labels.ts', '@/lib/customObjects': 'co.ts' };
export async function resolve(spec, ctx, next) {
  if (stubs[spec]) return { url: pathToFileURL(STUB + stubs[spec]).href, shortCircuit: true };
  let p = null;
  if (spec.startsWith('@/')) p = ROOT + '/' + spec.slice(2);
  else if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL?.includes('/lib/')) p = new URL(spec, ctx.parentURL).pathname;
  if (p) { for (const c of [p, p + '.ts', p + '.tsx']) if (existsSync(c) && !c.endsWith('/')) return { url: pathToFileURL(c).href, shortCircuit: true, format: 'module-typescript' }; }
  return next(spec, ctx);
}
