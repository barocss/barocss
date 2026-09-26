// #395: overlapping utility pairs on one element — does BaroCSS pick Tailwind 4.3.3's winner?
// Rerun (after `pnpm build:library`):
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> node scripts/cross-category-395/run.mjs
// For each pair (a, b) and each first-use order on the page (a first | b first), the page holds
//   #none (no class), #a, #b in first-use order, then #ab (class="a b") and #ba (class="b a").
// A surface's winner on an element = which single-class element its computed style matches on the
// conflict properties (computed props where a != none, b != none, a != b): 'a' | 'b' | 'mixed'.
// Surfaces: tw (Tailwind build), server (ServerRuntime.generateCssForHtml of the page body),
// kit (generateCss over classes in first-use order), runtime (browser runtime, document mode, default
// partitions; #a / #b appended one by one after observe(), then the combos).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { HERE, ROOT, ServerRuntime, kit, tailwindCss } from './lib.mjs';

// [family, a, b] — a is usually the shorthand / broader utility.
const PAIRS = [
  ['padding', 'p-4', 'px-2'], ['padding', 'p-4', 'pt-2'], ['padding', 'px-4', 'ps-2'], ['padding', 'p-4', 'ps-2'],
  ['padding', 'py-2', 'pb-0'], ['padding', 'px-4', 'pl-0'],
  ['margin', 'm-4', 'mx-2'], ['margin', 'm-4', 'mt-2'], ['margin', 'mx-4', 'ms-2'], ['margin', 'my-2', 'mb-0'], ['margin', 'mx-auto', 'ml-0'],
  ['inset', 'inset-0', 'top-2'], ['inset', 'inset-0', 'inset-x-2'], ['inset', 'inset-x-0', 'left-2'], ['inset', 'inset-0', 'start-2'],
  ['sizing', 'size-4', 'w-8'], ['sizing', 'size-4', 'h-8'], ['sizing', 'size-full', 'w-auto'],
  ['radius', 'rounded', 'rounded-t-lg'], ['radius', 'rounded-lg', 'rounded-tl-none'], ['radius', 'rounded-t-lg', 'rounded-tl-none'], ['radius', 'rounded-full', 'rounded-s-none'],
  ['border-width', 'border', 'border-x-0'], ['border-width', 'border', 'border-t-4'], ['border-width', 'border-2', 'border-t-0'], ['border-width', 'border-x-2', 'border-l-0'],
  ['border-color', 'border-red-500', 'border-t-blue-500'],
  ['flex', 'flex-1', 'grow-0'], ['flex', 'flex-1', 'shrink-0'], ['flex', 'flex-1', 'basis-4'], ['flex', 'flex-none', 'grow'],
  ['gap', 'gap-4', 'gap-x-2'],
  ['overflow', 'overflow-hidden', 'overflow-x-auto'], ['overflow', 'truncate', 'overflow-visible'], ['overflow', 'truncate', 'whitespace-normal'],
  ['place', 'place-items-center', 'items-start'], ['place', 'place-content-center', 'justify-start'], ['place', 'place-self-center', 'self-start'],
  ['grid', 'col-span-2', 'col-start-1'], ['grid', 'row-span-2', 'row-start-1'],
  ['typography', 'text-sm', 'leading-6'], ['typography', 'text-lg', 'leading-none'], ['typography', 'text-sm', 'tracking-wide'],
  ['scroll', 'scroll-m-4', 'scroll-mt-2'], ['scroll', 'scroll-p-4', 'scroll-px-2'],
  ['outline', 'outline-none', 'outline-2'],
  // same-property pairs (both set one property): Tailwind orders these by its candidate sort
  ['display', 'flex', 'hidden'], ['display', 'block', 'hidden'], ['display', 'flex', 'grid'], ['display', 'hidden', 'inline-flex'],
  ['same-prop', 'bg-red-500', 'bg-blue-500'], ['same-prop', 'text-left', 'text-center'], ['same-prop', 'font-bold', 'font-normal'],
  ['same-prop', 'text-sm', 'text-lg'], ['same-prop', 'shadow-sm', 'shadow-none'], ['same-prop', 'w-4', 'w-8'],
];
const IDS = ['none', 'a', 'b', 'ab', 'ba'];
// derived from the box size, not set by either utility
const CONFLICT_SKIP = /^(--|transition|animation|perspective-origin|transform-origin)/;

const pw = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage();
const UMD = path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs');
// Sentinel base (in @layer base, specificity 0,0,2: beats preflight's `*`, loses to any utility) so a zero/default-valued
// utility (pb-0, block, w-auto ...) still differs from #none and counts as setting its property.
const BASE = `@layer theme, base, components, utilities; @layer base{*,::before,::after{box-sizing:border-box;border:0 solid}
body div{width:201px;height:101px;position:relative;padding:3px;margin:3px;border-width:3px;border-color:rgb(1,2,3);border-radius:3px;
inset:3px;flex:7 7 7px;gap:3px;scroll-margin:3px;scroll-padding:3px;outline:3px dotted rgb(1,2,3);line-height:31px;font-size:13px;
letter-spacing:1px;grid-area:9/9/9/9;align-items:baseline;justify-items:end;justify-content:space-evenly;align-content:space-evenly;
align-self:baseline;justify-self:end;white-space:pre;text-overflow:ellipsis;overflow:scroll;display:table-cell;background-color:rgb(1,2,3);
font-weight:300;box-shadow:1px 1px rgb(1,2,3);text-align:justify}}`;

const body = (a, b, order) => {
  const prime = order === 'ab' ? [['a', a], ['b', b]] : [['b', b], ['a', a]];
  return [['none', ''], ...prime, ['ab', `${a} ${b}`], ['ba', `${b} ${a}`]]
    .map(([id, c]) => `<div id="${id}" class="${c}">x</div>`).join('');
};
const readStyles = () => page.evaluate((ids) => {
  const out = {};
  for (const id of ids) { const cs = getComputedStyle(document.getElementById(id)); const o = {}; for (const p of cs) o[p] = cs.getPropertyValue(p); out[id] = o; }
  return out;
}, IDS);
function winners(st) {
  const props = Object.keys(st.none).filter((p) => !CONFLICT_SKIP.test(p) && st.a[p] !== st.none[p] && st.b[p] !== st.none[p] && st.a[p] !== st.b[p]);
  const w = (id) => { if (!props.length) return 'n/a'; if (props.every((p) => st[id][p] === st.a[p])) return 'a'; if (props.every((p) => st[id][p] === st.b[p])) return 'b'; return 'mixed'; };
  return { props, ab: w('ab'), ba: w('ba') };
}
async function staticSurface(css, html) {
  await page.setContent(`<!doctype html><html><head><style>${css}</style><style>${BASE}</style></head><body>${html}</body></html>`);
  return winners(await readStyles());
}
async function runtimeSurface(a, b, order) {
  await page.goto('about:blank');
  await page.setContent(`<!doctype html><html><head></head><body></body></html>`);
  await page.addScriptTag({ path: UMD });
  await page.evaluate((b) => { window.__BASE = b; }, BASE);
  await page.evaluate(async (html) => {
    const t = document.createElement('template'); t.innerHTML = html;
    const els = [...t.content.children];
    const rt = BaroCSS.getRuntime({ config: {} }); rt.observe(document.body, { scan: true });
    const tick = () => new Promise((r) => setTimeout(r, 60));
    for (const el of els) { document.body.append(el); await tick(); }
    await tick();
    const st = document.createElement('style'); st.textContent = window.__BASE; document.body.append(st);
  }, body(a, b, order));
  return winners(await readStyles());
}

const rows = [];
for (const [family, a, b] of PAIRS) {
  const cat = (c) => kit.parseClassName(c).utility?.category ?? null;
  const twCss = await tailwindCss([a, b]);
  for (const order of ['ab', 'ba']) {
    const html = body(a, b, order);
    const firstUse = order === 'ab' ? `${a} ${b}` : `${b} ${a}`;
    const r = {
      family, a, b, catA: cat(a), catB: cat(b), firstUse: order,
      tw: await staticSurface(twCss, html),
      server: await staticSurface(new ServerRuntime().generateCssForHtml(html), html),
      kit: await staticSurface((() => { const ctx = kit.createContext({}); return ctx.themeToCssVars() + '\n' + kit.generateCss(firstUse, ctx); })(), html),
      runtime: await runtimeSurface(a, b, order),
    };
    rows.push(r);
  }
}
await browser.close();

// summary
const SURF = ['runtime', 'server', 'kit'];
const valid = rows.filter((r) => r.tw.props.length && r.tw.ab === r.tw.ba && r.tw.ab !== 'mixed');
const summary = { pairs: PAIRS.length, cases: rows.length, comparable: valid.length, mismatch: {}, byFamily: {} };
for (const s of SURF) {
  for (const order of ['ab', 'ba']) {
    const set = valid.filter((r) => r.firstUse === order);
    const bad = set.filter((r) => r[s].ab !== r.tw.ab || r[s].ba !== r.tw.ab);
    summary.mismatch[`${s}/firstUse=${order === 'ab' ? 'broad-first' : 'narrow-first'}`] = `${bad.length}/${set.length}`;
  }
}
for (const r of valid) {
  const f = (summary.byFamily[r.family] ??= { cases: 0, crossCategory: r.catA !== r.catB, runtime: 0, server: 0, kit: 0 });
  f.cases++;
  for (const s of SURF) if (r[s].ab !== r.tw.ab || r[s].ba !== r.tw.ab) f[s]++;
}
summary.twWinner = Object.fromEntries(PAIRS.map(([, a, b]) => { const r = rows.find((x) => x.a === a && x.b === b); return [`${a} + ${b}`, r.tw.ab === 'a' ? a : r.tw.ab === 'b' ? b : r.tw.ab]; }));
summary.excluded = rows.filter((r) => !valid.includes(r)).map((r) => `${r.a}+${r.b}/${r.firstUse}: tw ${r.tw.ab}/${r.tw.ba} props=${r.tw.props.length}`);
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ summary, rows: rows.map((r) => ({ ...r, tw: { ...r.tw, props: r.tw.props.slice(0, 6) }, server: { ab: r.server.ab, ba: r.server.ba }, kit: { ab: r.kit.ab, ba: r.kit.ba }, runtime: { ab: r.runtime.ab, ba: r.runtime.ba } })) }, null, 1));
console.log(JSON.stringify(summary.mismatch));
for (const [f, v] of Object.entries(summary.byFamily)) console.log(f.padEnd(13), JSON.stringify(v));
console.log('excluded', summary.excluded.length, summary.excluded.slice(0, 6).join(' | '));
