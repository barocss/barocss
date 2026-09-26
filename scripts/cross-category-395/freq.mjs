// #395: how often do overlapping utilities sit on one element in the recorded AI outputs, and on how many
// would BaroCSS (first-use order, measured by run.mjs) pick a different winner than Tailwind 4.3.3?
// Rerun: node scripts/cross-category-395/freq.mjs   (after run.mjs; merges into result.json)
// Per file (= one page): class lists are pulled from class=/className= attributes and JSON "className" props.
// Two classes with the same variant prefix overlap when Tailwind's declarations for them share a physical
// longhand with different values. Tailwind winner = later rule in the Tailwind build; BaroCSS winner =
// the class used later on the page (first occurrence in document order).
import fs from 'node:fs';
import path from 'node:path';
import { HERE, ROOT, kit, tailwindCss } from './lib.mjs';

const DIRS = [
  'scripts/cms-probe/blocks', 'scripts/cms-probe/theme-blocks', 'scripts/o5-probe/blocks', 'scripts/json-render-376/outputs',
  'scripts/mcp-model-outputs/outputs', 'scripts/mcp-html-probe/sections', 'scripts/email-probe/outputs', 'scripts/playcdn-probe/outputs',
  '.ai/evidence/E-006/runs', '.ai/evidence/E-007/runs', '.ai/evidence/E-011/runs',
];
const files = DIRS.flatMap((d) => { const p = path.join(ROOT, d); return fs.existsSync(p) ? fs.readdirSync(p).filter((f) => /\.(html|txt|json|jsx)$/.test(f)).map((f) => path.join(p, f)) : []; });
const CLASS_RE = /\bclass(?:Name)?\\?"?\s*[:=]\s*\{?\s*\\?["'`]([^"'`\\]*)/g;

const SIDES = { top: 'top', right: 'right', bottom: 'bottom', left: 'left' };
const LOG = { 'inline-start': ['left'], 'inline-end': ['right'], 'block-start': ['top'], 'block-end': ['bottom'], inline: ['left', 'right'], block: ['top', 'bottom'], '': ['top', 'right', 'bottom', 'left'] };
const CORNER = { 'start-start': 'top-left', 'start-end': 'top-right', 'end-start': 'bottom-left', 'end-end': 'bottom-right' };
function expand(p) {
  let m;
  if ((m = p.match(/^(padding|margin|scroll-margin|scroll-padding)(?:-(inline|block|inline-start|inline-end|block-start|block-end|top|right|bottom|left))?$/)))
    return (SIDES[m[2]] ? [m[2]] : LOG[m[2] ?? '']).map((s) => `${m[1]}-${s}`);
  if ((m = p.match(/^inset(?:-(inline|block|inline-start|inline-end|block-start|block-end))?$/))) return LOG[m[1] ?? ''];
  if ((m = p.match(/^border(?:-(inline|block|inline-start|inline-end|block-start|block-end|top|right|bottom|left))?-(width|style|color)$/)))
    return (SIDES[m[1]] ? [m[1]] : LOG[m[1] ?? '']).map((s) => `border-${s}-${m[2]}`);
  if (p === 'border-radius') return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((c) => `r-${c}`);
  if ((m = p.match(/^border-(start-start|start-end|end-start|end-end|top-left|top-right|bottom-left|bottom-right)-radius$/))) return [`r-${CORNER[m[1]] ?? m[1]}`];
  const SH = { flex: ['flex-grow', 'flex-shrink', 'flex-basis'], gap: ['row-gap', 'column-gap'], overflow: ['overflow-x', 'overflow-y'],
    'place-items': ['align-items', 'justify-items'], 'place-content': ['align-content', 'justify-content'], 'place-self': ['align-self', 'justify-self'],
    'grid-column': ['grid-column-start', 'grid-column-end'], 'grid-row': ['grid-row-start', 'grid-row-end'], 'inline-size': ['width'], 'block-size': ['height'] };
  return SH[p] ?? [p];
}
const splitVariant = (c) => { let depth = 0, cut = -1; for (let i = 0; i < c.length; i++) { const ch = c[i]; if (ch === '[' || ch === '(') depth++; else if (ch === ']' || ch === ')') depth--; else if (ch === ':' && !depth) cut = i; } return [c.slice(0, cut + 1), c.slice(cut + 1)]; };

// pages
const pages = files.map((f) => {
  const txt = fs.readFileSync(f, 'utf8');
  const lists = [...txt.matchAll(CLASS_RE)].map((m) => m[1].split(/\s+/).filter(Boolean)).filter((l) => l.length);
  return { file: path.relative(ROOT, f), lists };
}).filter((p) => p.lists.length);

// Tailwind declarations and order per base utility
const bases = [...new Set(pages.flatMap((p) => p.lists.flat().map((c) => splitVariant(c)[1].replace(/^!|!$/g, ''))))];
const decl = new Map();
for (const b of bases) {
  const css = await tailwindCss([b]);
  const i = css.lastIndexOf('@layer utilities');
  if (i < 0) continue;
  const body = css.slice(i).split('@property')[0]; // utilities layer only, not the @property/@layer properties tail
  // only rules that style the element itself (not space-y children, ::placeholder, ...)
  const sel = body.replace(/^@layer utilities\s*\{/, '').trim().split('{')[0];
  if (/>|::|:where|:not/.test(sel)) continue;
  const props = new Map();
  for (const m of body.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) if (!m[1].startsWith('--') && !/^(syntax|inherits|initial-value)$/.test(m[1])) for (const e of expand(m[1])) props.set(e, m[2].trim());
  if (props.size) decl.set(b, { props, body: body.replace(/^@layer utilities\s*\{/, '').trim().slice(0, 400) });
}
const full = await tailwindCss([...decl.keys()]);
const twPos = new Map([...decl].map(([b, d]) => [b, full.indexOf(d.body.split('\n').slice(0, 3).join('\n'))]));

let elements = 0, elementsWithOverlap = 0, elementsAtRisk = 0, pairsSeen = 0, pairsAtRisk = 0, crossCat = 0;
const examples = new Map();
const allPairs = new Map();
for (const p of pages) {
  const first = new Map();
  let n = 0;
  for (const l of p.lists) for (const c of l) if (!first.has(c)) first.set(c, n++);
  for (const l of p.lists) {
    elements++;
    let overlap = false, risk = false;
    const uniq = [...new Set(l)];
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
      const [va, ba] = splitVariant(uniq[i]), [vb, bb] = splitVariant(uniq[j]);
      if (va !== vb || !decl.has(ba) || !decl.has(bb)) continue;
      const A = decl.get(ba).props, B = decl.get(bb).props;
      const shared = [...A.keys()].filter((k) => B.has(k) && A.get(k) !== B.get(k) && !/var\(--tw-/.test(A.get(k) + B.get(k)));
      // var(--tw-*) values compose by design (text-sm + leading-6, transition + duration-300), not a conflict
      if (!shared.length) continue;
      overlap = true; pairsSeen++;
      { const k = [ba, bb].sort().join(' + '); allPairs.set(k, (allPairs.get(k) ?? 0) + 1); }
      const catA = kit.parseClassName(ba).utility?.category, catB = kit.parseClassName(bb).utility?.category;
      if (catA !== catB) crossCat++;
      const twLater = twPos.get(ba) > twPos.get(bb) ? uniq[i] : uniq[j];
      const baroLater = first.get(uniq[i]) > first.get(uniq[j]) ? uniq[i] : uniq[j];
      if (twLater !== baroLater) {
        risk = true; pairsAtRisk++;
        const k = [ba, bb].sort().join(' + ');
        const e = examples.get(k) ?? { n: 0, tw: splitVariant(twLater)[1], cross: catA !== catB, props: shared.slice(0, 3), file: p.file };
        e.n++; examples.set(k, e);
      }
    }
    if (overlap) elementsWithOverlap++;
    if (risk) elementsAtRisk++;
  }
}
const freq = {
  files: pages.length, elements, elementsWithOverlap, elementsAtRisk, overlappingPairs: pairsSeen, crossCategoryPairs: crossCat, pairsAtRisk,
  topOverlapping: [...allPairs].sort((a, b) => b[1] - a[1]).slice(0, 20),
  topAtRisk: [...examples].sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(([k, v]) => ({ pair: k, ...v })),
};
const out = path.join(HERE, 'result.json');
const res = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
res.frequency = freq;
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ ...freq, topAtRisk: undefined, topOverlapping: undefined }));
console.log('overlapping:', freq.topOverlapping.map(([k, n]) => `${n} ${k}`).join(' | '));
for (const e of freq.topAtRisk.slice(0, 15)) console.log(e.n, e.pair, 'tw->', e.tw, e.cross ? 'X' : '', e.props.join(','), e.file);
