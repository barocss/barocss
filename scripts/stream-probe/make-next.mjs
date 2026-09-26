// #290: writes the streamed-SSR probe pages into a create-next-app (App Router, Tailwind 4) project.
//   node scripts/stream-probe/make-next.mjs <app dir>
// See run-stream.mjs for the full rerun steps.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHELL, SITE_CSS, BRAND, ACCENT, FONTS } from '../cms-probe/site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const APP = path.resolve(process.argv[2]);
const w = (p, s) => { fs.mkdirSync(path.dirname(path.join(APP, p)), { recursive: true }); fs.writeFileSync(path.join(APP, p), s); };
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean));

// 3 boundaries, 2 opus blocks each; chunk 0 adds lg:* alone, chunk 2 adds sm:+lg: on one element (the cross-sheet order trap).
const BL = ['hero', 'feature-grid', 'callout', 'comparison-table', 'testimonial', 'cta'];
const read = (b) => fs.readFileSync(path.join(ROOT, 'scripts/cms-probe/blocks', `opus-${b}.html`), 'utf8');
const CHUNKS = [
  { delay: 300, html: read(BL[0]) + read(BL[1]) + '<p class="lg:px-8 text-emerald-700">lg only</p>' },
  { delay: 550, html: read(BL[2]) + read(BL[3]) },
  { delay: 800, html: read(BL[4]) + read(BL[5]) + '<div class="grid sm:grid-cols-5 lg:grid-cols-3 sm:px-7 lg:px-8 bg-emerald-100"><p>a</p><p>b</p><p>c</p></div>' },
];
const CONFIG = { cssVarPrefix: 'tw', theme: { extend: { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONTS.display.split(', '), sans: FONTS.sans.split(', ') } } } };

w('probe-data.json', JSON.stringify({ SHELL, CHUNKS, CONFIG }));
w('app/globals.css', `@import "tailwindcss";\n@source not "../probe-data.json";\n@source not "../public";\n@source inline("${[...new Set(toks(SHELL))].join(' ')} prose");\n${SITE_CSS}\n`);
w('app/layout.tsx', `import './globals.css';\nexport default function L({ children }: { children: React.ReactNode }) { return <html lang="en"><head><meta name="viewport" content="width=1280" /></head><body>{children}</body></html>; }\n`);
w('public/baro.js', fs.readFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs')));
w('public/probe.js', fs.readFileSync(path.join(HERE, 'probe.js')));
w('app/ChunkStyle.tsx', `'use client';
import { useServerInsertedHTML } from 'next/navigation';
import { useRef } from 'react';
export default function ChunkStyle({ css, id }: { css: string; id: string }) {
  const done = useRef(false);
  useServerInsertedHTML(() => { if (done.current || !css) return null; done.current = true;
    return <style data-barocss-ssr="" data-chunk-sheet={id} dangerouslySetInnerHTML={{ __html: css }} />; });
  return null;
}
`);
w('lib/baro.ts', `import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import { ServerRuntime } from '@barocss/server';
import data from '../probe-data.json';
export const { SHELL, CHUNKS, CONFIG } = data as any;
const rt = new ServerRuntime(CONFIG);
let build: string | null = null;
function buildCss() { // the Tailwind build CSS the page links (next build output)
  if (build != null) return build;
  const dir = path.join(process.cwd(), '.next/static');
  const out: string[] = [];
  const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.css')) out.push(fs.readFileSync(p, 'utf8')); } };
  walk(dir); return (build = out.join('\\n'));
}
// per request: the sheets already sent in this response (React cache() is request-scoped in RSC)
const sent = cache(() => ({ css: [] as string[] }));
export function chunkCss(html: string) {
  const s = sent();
  const css = rt.generateCssForHtml(html, { skip: buildCss() + '\\n' + s.css.join('\\n') });
  s.css.push(css); return css;
}
export function fullCss(html: string) { return rt.generateCssForHtml(html, { skip: buildCss() }); }
`);
w('app/s/[arm]/page.tsx', `import { Suspense } from 'react';
import ChunkStyle from '../../ChunkStyle';
import { SHELL, CHUNKS, CONFIG, chunkCss, fullCss } from '../../../lib/baro';
export const dynamic = 'force-dynamic';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BOOT = \`var rt = BaroCSS.getRuntime({ skipExisting: true, config: \${JSON.stringify(CONFIG)} }); rt.observe(document.body, { scan: true });\`;
// app-side shim (the gap under test): hand late per-chunk sheets to #268 adoption (head-only, startup-only today).
const ADOPT = \`new MutationObserver(function () { var n = 0;
  document.querySelectorAll('style[data-chunk-sheet],style[data-precedence="baro"]').forEach(function (s) {
    if (s.hasAttribute('data-barocss-adopted') || s.media === 'not all' || s.closest('[hidden]')) return;
    s.setAttribute('data-barocss-ssr', ''); if (s.parentNode !== document.head) document.head.appendChild(s); n++; });
  if (n) rt.adoptSsrSheets(); }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['media'] });\`;
async function Chunk({ i, arm }: { i: number; arm: string }) {
  const c = CHUNKS[i];
  await sleep(c.delay);
  const css = arm.startsWith('sih') || arm.startsWith('prec') ? (arm.endsWith('full') ? fullCss(c.html) : chunkCss(c.html)) : '';
  return <>
    {arm.startsWith('sih') && <ChunkStyle css={css} id={String(i)} />}
    {arm.startsWith('prec') && css && <style href={'baro-chunk-' + i} precedence="baro" data-barocss-ssr="">{css}</style>}
    <section data-chunk={i} dangerouslySetInnerHTML={{ __html: c.html }} />
  </>;
}
export default async function Page({ params }: { params: Promise<{ arm: string }> }) {
  const { arm } = await params;
  const client = arm === 'client' || arm.endsWith('client') || arm.endsWith('adopt');
  const all = CHUNKS.map((c: any) => c.html).join('');
  return <>
    <script src="/probe.js" />
    {arm === 'ref' && <style data-barocss-ssr="" dangerouslySetInnerHTML={{ __html: fullCss(all) }} />}
    {arm.startsWith('shell') && <ChunkStyle css={fullCss(SHELL)} id="shell" />}
    <div dangerouslySetInnerHTML={{ __html: SHELL }} />
    {client && <><script src="/baro.js" /><script dangerouslySetInnerHTML={{ __html: BOOT + (arm.endsWith('adopt') ? ADOPT : '') }} /></>}
    {arm === 'ref'
      ? CHUNKS.map((c: any, i: number) => <section key={i} data-chunk={i} dangerouslySetInnerHTML={{ __html: c.html }} />)
      : CHUNKS.map((_: any, i: number) => <Suspense key={i} fallback={<p>loading {i}</p>}><Chunk i={i} arm={arm} /></Suspense>)}
  </>;
}
`);
// SSG arms (/g/client, /g/inline): all 6 blocks prerendered at build; inline = build-time generateCssForHtml per page
// (skip = the shell classes the Tailwind build already covers), timed into ssg-gen-ms.txt.
w('app/g/[arm]/page.tsx', `import fs from 'node:fs';
import { ServerRuntime } from '@barocss/server';
import data from '../../../probe-data.json';
const { SHELL, CHUNKS, CONFIG } = data as any;
export const dynamic = 'force-static';
export function generateStaticParams() { return [{ arm: 'client' }, { arm: 'inline' }]; }
const BOOT = \`var rt = BaroCSS.getRuntime({ skipExisting: true, config: \${JSON.stringify(CONFIG)} }); rt.observe(document.body, { scan: true });\`;
const shellClasses = [...SHELL.matchAll(/class="([^"]*)"/g)].flatMap((m: any) => m[1].split(/\\s+/)).filter(Boolean);
export default async function Page({ params }: { params: Promise<{ arm: string }> }) {
  const { arm } = await params;
  const all = CHUNKS.map((c: any) => c.html).join('');
  let css = '';
  if (arm === 'inline') { const t0 = performance.now(); css = new ServerRuntime(CONFIG).generateCssForHtml(all, { skip: shellClasses });
    fs.appendFileSync('ssg-gen-ms.txt', (performance.now() - t0).toFixed(1) + '\\n'); }
  return <>
    <script src="/probe.js" />
    {css && <style data-barocss-ssr="" dangerouslySetInnerHTML={{ __html: css }} />}
    <div dangerouslySetInnerHTML={{ __html: SHELL }} />
    {CHUNKS.map((c: any, i: number) => <section key={i} data-chunk={i} dangerouslySetInnerHTML={{ __html: c.html }} />)}
    {arm === 'client' && <><script src="/baro.js" /><script dangerouslySetInnerHTML={{ __html: BOOT }} /></>}
  </>;
}
`);
console.log('wrote', APP);
