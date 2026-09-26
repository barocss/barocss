// #385 O7 classifier (research, throwaway). Labels every class in recorded model output against the SITE's theme,
// using BaroCSS kit resolution (createContext + generateCss): on-token | off-token | unresolved.
// Rerun (repo root, after `pnpm --filter @barocss/kit build:library`): node scripts/o7-enforce/classify.mjs
// Rules: unresolved = BaroCSS emits no CSS with the site config. off-token = an arbitrary value (unless it is only a
// var() of a site token), or a var(--color-*) / closed-namespace var the site theme does not define. Namespaces the site
// does not redefine (spacing scale, type scale, shadows, radius on #253/#255) stay open: the default scale IS the site's.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, generateCss } from '../../packages/barocss/dist/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = path.resolve(HERE, '..');
const NEUTRAL = ['white', 'black', 'transparent', 'current', 'inherit'].map((c) => 'color-' + c);
const BRAND10 = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const hexes = (o) => Object.fromEntries(Object.keys(o).map((k) => [k, '#000']));
const SHADCN_C = ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'border', 'input', 'ring'];
const SLATE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => 'color-slate-' + n); // families the site shell itself uses

export const SITES = {
  shadcn: { // #231 json-render + shadcn new-york tokens (app.css)
    extend: { colors: Object.fromEntries(SHADCN_C.map((c) => [c, `var(--${c})`])), borderRadius: { sm: 'calc(var(--radius) - 4px)', md: 'calc(var(--radius) - 2px)', lg: 'var(--radius)', xl: 'calc(var(--radius) + 4px)' } },
    allowVars: new Set([...SHADCN_C, ...NEUTRAL, 'radius']),
    closedRadius: new Set(['radius-sm', 'radius-md', 'radius-lg', 'radius-xl']),
    colorHint: 'bg-primary text-primary-foreground bg-muted text-muted-foreground bg-card border-border bg-secondary bg-accent text-destructive',
    radiusHint: 'rounded-sm rounded-md rounded-lg rounded-xl rounded-full',
    reset: '@theme { --color-*: initial; --radius-*: initial; }',
  },
  cms253: { // #253 CMS site: brand-50..950, accent-400..600, font display/sans; shell uses slate
    extend: { colors: { brand: hexes(Object.fromEntries([...BRAND10, 950].map((k) => [k, 1]))), accent: { 400: '#fbbf5a', 500: '#f59e0b', 600: '#d97706' } }, fontFamily: { display: 'Georgia, serif' } },
    allowVars: new Set([...[...BRAND10, 950].map((k) => 'color-brand-' + k), ...[400, 500, 600].map((k) => 'color-accent-' + k), ...SLATE, ...NEUTRAL]),
    colorHint: 'brand-50..950, accent-400..600, slate-*, white',
    reset: '@theme { --color-*: initial; }',
  },
  theme255: { // #255 same site with its custom tokens: brand-50..900, accent, font-display, spacing gutter, radius card
    extend: { colors: { brand: hexes(Object.fromEntries(BRAND10.map((k) => [k, 1]))), accent: '#e8590c' }, fontFamily: { display: 'Georgia, serif' }, spacing: { gutter: '1.75rem' }, borderRadius: { card: '1.25rem' } },
    allowVars: new Set([...BRAND10.map((k) => 'color-brand-' + k), 'color-accent', ...SLATE, ...NEUTRAL]),
    colorHint: 'brand-50..900, accent, slate-*, white',
    reset: '@theme { --color-*: initial; }',
  },
};
for (const s of Object.values(SITES)) s.ctx = createContext({ theme: { extend: s.extend } });

const KIND = [[/(^|[;{\s])(color|background(-color)?|border(-[a-z]+)?-color|fill|stroke|outline-color|--baro-gradient|text-decoration-color|--baro-ring-color|caret-color|accent-color)\s*:/, 'colour'],
  [/border-radius|border-[a-z-]*radius/, 'radius'], [/box-shadow|--baro-shadow|--baro-ring/, 'shadow'],
  [/font-size|line-height|letter-spacing|font-weight|font-family/, 'type'],
  [/padding|margin|gap|width|height|inset|top:|left:|right:|bottom:|translate/, 'spacing/size']];
const kindOf = (css) => (KIND.find(([re]) => re.test(css)) || [0, 'other'])[1];

export function classify(cls, siteKey) {
  const s = SITES[siteKey];
  if (/^(group|peer)(\/[\w-]+)?$/.test(cls)) return { cls, label: 'on-token', kind: 'marker' }; // variant markers emit no CSS by design
  const css = generateCss(cls, s.ctx);
  if (!css.trim()) return { cls, label: 'unresolved', kind: 'unresolved' };
  // POLICY (generated content must not cover the host): resolved CSS with fixed positioning or z-index >= 50.
  const z = css.match(/z-index:\s*(-?\d+)/);
  if (/position:\s*fixed/.test(css) || (z && +z[1] >= 50)) return { cls, label: 'policy', kind: 'overlay', why: /fixed/.test(css) ? 'fixed' : 'z-index', css };
  const kind = kindOf(css);
  const vars = [...css.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1]).filter((v) => !v.startsWith('baro') && v !== 'spacing');
  const arb = cls.match(/\[([^\]]+)\]/);
  if (arb) {
    const onlySiteVar = /^var\(--[a-z0-9-]+\)$/.test(arb[1]) && vars.every((v) => s.allowVars.has(v) || s.allowVars.has(v.replace(/^color-/, '')));
    if (!onlySiteVar) return { cls, label: 'off-token', kind, why: 'arbitrary', css };
  }
  for (const v of vars) {
    if (v.startsWith('color-') && !s.allowVars.has(v) && !s.allowVars.has(v.slice(6))) return { cls, label: 'off-token', kind: 'colour', why: 'default-palette', css };
    if (s.closedRadius && v.startsWith('radius-') && !s.closedRadius.has(v)) return { cls, label: 'off-token', kind: 'radius', why: 'default-scale', css };
  }
  return { cls, label: 'on-token', kind, css };
}

// Recorded outputs: #231 (json-render specs), #253 (CMS blocks, no tokens in prompt), #255 (CMS blocks, tokens in prompt)
const walk = (o, out) => { if (o && typeof o === 'object') { if (typeof o.className === 'string') out.push(o.className); Object.values(o).forEach((v) => walk(v, out)); } return out; };
export function loadDatasets() {
  const items = [];
  const html = (dir, set, site) => { for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const els = [...t.matchAll(/class(?:Name)?="([^"]*)"/g)].map((m) => m[1]);
    items.push({ set, site, model: f.split('-')[0], id: f.slice(0, -5), text: t, elements: els, classes: els.flatMap((c) => c.split(/\s+/)).filter(Boolean) });
  } };
  const jd = path.join(S, 'json-render-probe/e2e/specs');
  for (const f of fs.readdirSync(jd).filter((f) => f.endsWith('.json')).sort()) {
    const spec = JSON.parse(fs.readFileSync(path.join(jd, f), 'utf8'));
    const els = walk(spec, []);
    items.push({ set: '#231 json-render', site: 'shadcn', model: f.split('-')[0], id: f.slice(0, -5), text: JSON.stringify(spec), elements: els, classes: els.flatMap((c) => c.split(/\s+/)).filter(Boolean) });
  }
  // #376 (6 requests x companion/json-render/native x opus/haiku; A2UI has no classes) against its shadcn theme
  const d376 = path.join(S, 'json-render-376/outputs');
  const RX = { companion: /class(?:Name)?="([^"]*)"/g, 'json-render': /"className"\s*:\s*"((?:[^"\\]|\\.)*)"/g, native: /"class"\s*:\s*"((?:[^"\\]|\\.)*)"/g };
  if (fs.existsSync(d376)) for (const f of fs.readdirSync(d376).sort()) {
    const [fmt, model] = f.split('--'); if (!RX[fmt]) continue;
    const t = fs.readFileSync(path.join(d376, f), 'utf8'); const els = [...t.matchAll(RX[fmt])].map((m) => m[1]);
    items.push({ set: `#376 ${fmt}`, site: 'shadcn', model, id: f, text: t, elements: els, classes: els.flatMap((c) => c.split(/\s+/)).filter(Boolean) });
  }
  html(path.join(S, 'cms-probe/blocks'), '#253 cms (no tokens)', 'cms253');
  html(path.join(S, 'cms-probe/theme-blocks'), '#255 cms (tokens)', 'theme255');
  return items;
}

// Element-level overlay shape: one element whose classes combine fixed positioning with full-viewport coverage
// (inset-0 or screen-sized) or a z-index >= 50. Generic shape only.
export function overlayElement(classStr, siteKey) {
  const cs = classStr.split(/\s+/).filter(Boolean); const css = generateCss(cs.join(' '), SITES[siteKey].ctx);
  const z = [...css.matchAll(/z-index:\s*(-?\d+)/g)].some((m) => +m[1] >= 50);
  const cover = /inset:\s*0|100v[wh]|100dv[wh]/.test(css) || cs.some((c) => /^(inset-0|[wh]-screen|size-screen)$/.test(c.split(':').pop()));
  return /position:\s*fixed/.test(css) && (cover || z);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = loadDatasets();
  const { checkToken } = await import('../json-render-376/native.mjs'); // #376's native-sketch token check, for comparison
  const agg = {}, kinds = {}, examples = {}, cmp = {};
  for (const it of items) {
    const key = `${it.set} | ${it.model}`;
    const a = (agg[key] ||= { blocks: 0, classes: 0, 'on-token': 0, 'off-token': 0, unresolved: 0, policy: 0, overlayElements: 0 });
    a.blocks++; a.overlayElements += (it.elements || []).filter((e) => overlayElement(e, it.site)).length;
    if (it.site === 'shadcn') for (const c of it.classes) { const k = `${classify(c, it.site).label} vs 376:${checkToken(c) || 'ok'}`; cmp[k] = (cmp[k] || 0) + 1; }
    for (const c of it.classes) { const r = classify(c, it.site); a.classes++; a[r.label]++;
      if (r.label !== 'on-token') { const k = `${it.set} | ${r.label}:${r.why || r.kind}:${r.kind}`; kinds[k] = (kinds[k] || 0) + 1; (examples[k] ||= new Set()).size < 4 && examples[k].add(c); } }
  }
  console.log('set | model | blocks | class uses | on% | off% | unresolved% | policy uses | overlay els');
  for (const [k, a] of Object.entries(agg)) console.log(`${k} | ${a.blocks} | ${a.classes} | ${(100 * a['on-token'] / a.classes).toFixed(1)} | ${(100 * a['off-token'] / a.classes).toFixed(1)} | ${(100 * a.unresolved / a.classes).toFixed(1)} | ${a.policy} | ${a.overlayElements}`);
  console.log('\nshadcn-site class uses, this classifier vs #376 checkToken:', JSON.stringify(cmp));
  console.log('\noff/unresolved kinds (class uses, examples):');
  for (const [k, n] of Object.entries(kinds).sort()) console.log(`${k} = ${n}  e.g. ${[...examples[k]].join(' ')}`);
  const out = path.join(HERE, 'result.json');
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  prev.l2 = { byset: agg, kinds, vs376checkToken: cmp, examples: Object.fromEntries(Object.entries(examples).map(([k, v]) => [k, [...v]])) };
  fs.writeFileSync(out, JSON.stringify(prev, null, 1));
}
