// #272 micro-benchmark: ServerRuntime.generateCss per "request" over #253's CMS blocks (scripts/cms-probe/blocks).
// Usage (after building kit + server): node scripts/ssr-probe/bench-server.mjs [iterations=200]
// Prints cold ms (first request, fresh runtime) and median warm ms per model page (all 6 blocks' classes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { register } from 'node:module';
import { BRAND, ACCENT, FONTS } from '../cms-probe/site.mjs';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@barocss/kit' ? n(${JSON.stringify(new URL('../../packages/barocss/dist/index.js', import.meta.url).href)}, c) : n(s, c); }`));
const { ServerRuntime } = await import('../../packages/barocss-server/dist/index.es.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(HERE, '../cms-probe/blocks');
const N = Number(process.argv[2] || 200);
const config = { cssVarPrefix: 'tw', theme: { extend: { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONTS.display.split(', '), sans: FONTS.sans.split(', ') } } } };
const pages = { opus: [], haiku: [] };
for (const f of fs.readdirSync(dir).sort()) {
  const m = f.split('-')[0];
  if (!pages[m]) continue;
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  pages[m].push(...[...html.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(/\s+/).filter(Boolean)));
}
const median = (a) => a.sort((x, y) => x - y)[a.length >> 1];
for (const [name, toks] of Object.entries(pages)) {
  const classes = [...new Set(toks)].join(' ');
  const rt = new ServerRuntime(config);
  let t = performance.now();
  const first = rt.generateCss(classes);
  const cold = performance.now() - t;
  const warm = [];
  for (let i = 0; i < N; i++) {
    t = performance.now();
    const out = rt.generateCss(classes);
    warm.push(performance.now() - t);
    if (out !== first) throw new Error('non-deterministic output');
  }
  console.log(`${name}: classes=${new Set(toks).size} bytes=${first.length} cold=${cold.toFixed(2)}ms warm-median=${median(warm).toFixed(3)}ms`);
}
