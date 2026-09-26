/**
 * #319 long fuzz campaign: class inputs -> kit generateCss, server generateCss, server generateCssForHtml
 * (HTML-wrapped), browser runtime rules (insertRule path + text fallback) -> GENERIC output properties
 * (see packages/barocss/tests/fuzz/harness.mjs). P1 additionally runs in headless Chromium CSSOM.
 *
 * Rerun (after `pnpm -C packages/barocss build && pnpm -C packages/barocss-server build`):
 *   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium binary> \
 *   node --import ./scripts/fuzz/kit-dist-loader.mjs scripts/fuzz/campaign.mjs --minutes 40 --seed 319 \
 *     [--inputs <n>] [--out <private dir>] [--seed-corpus <extra corpus.mjs exporting corpus(tag)>]
 * Multi-seed gate (#406): scripts/fuzz/browser-ratchet.mjs.
 *
 * Violations are printed by property x path only. Minimised examples go to --out (keep it OUTSIDE the repo).
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import * as H from '../../packages/barocss/tests/fuzz/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const MINUTES = Number(args.minutes ?? 1);
const SEED = Number(args.seed ?? 319);
const OUT = args.out;
// #406: --inputs N runs a fixed input count instead of a time budget (deterministic counts for the ratchet)
const INPUTS = args.inputs ? Number(args.inputs) : 0;

const kit = await import('@barocss/kit');
const srv = await import('../../packages/barocss-server/dist/index.es.js');
const ctx = kit.createContext({});
const rt = new srv.ServerRuntime({});

// ---- seeds for mutation ----
const root = new URL('../../', import.meta.url).pathname;
const seeds = [];
for (const f of ['corpus.ts', 'corpus-heldout.ts']) {
  const txt = readFileSync(join(root, 'packages/barocss/tests/compat', f), 'utf8');
  for (const m of txt.matchAll(/\["((?:[^"\\]|\\.)*)",\s*\d+\]/g)) seeds.push(JSON.parse(`"${m[1]}"`));
}
const coreSeedCount = seeds.length;
if (args['seed-corpus'] && existsSync(args['seed-corpus'])) {
  const mod = await import(args['seed-corpus']);
  for (const [, s] of mod.corpus('fz')) if (s.length <= 300) seeds.push(s);
}

// ---- Chromium ----
const require = createRequire(join(process.env.PW_DIR, 'node_modules/'));
const ENGINE = process.env.ENGINE || 'chromium'; // #374: ENGINE=firefox|webkit uses PW_DIR's bundled engine
const pwEngines = require('playwright-core'), chromium = pwEngines[ENGINE];
const browser = await chromium.launch({ executablePath: ENGINE === 'chromium' ? process.env.CHROME : undefined, headless: true });
const page = await browser.newPage();
// #406 decoy DOM for P2-by-matching: common classes/attributes/states, none produced by an input class.
await page.setContent('<html lang="en" dir="ltr"><body class="dark"><div id="d" class="x group peer dark" data-state="open" aria-checked="true" tabindex="0"><p><span></span></p><input type="checkbox" checked><a href="#"></a><ul><li></li><li></li></ul></div></body></html>');

// ---- bookkeeping ----
const counts = { grammar: 0, mutation: 0, sweep: 0, random: 0 };
const viol = new Map(); // key path|prop|why -> {n, examples:[input]}
const byGen = {};
let curGen = '';
const p2All = new Set(); // #406: every distinct P2 input (private store only)
const p1Sample = new Set(); // #406: sample of distinct CSSOM P1 inputs (private store only)
const note = (path, prop, why, input, gen = curGen) => {
  if (prop === 'P2' && p2All.size < 5000) p2All.add(input);
  if (prop === 'P1' && path === 'browser' && p1Sample.size < 3000) p1Sample.add(input);
  byGen[`${gen}|${prop}|${why}`] = (byGen[`${gen}|${prop}|${why}`] ?? 0) + 1;
  const k = `${path}|${prop}|${why}`;
  const e = viol.get(k) ?? { n: 0, examples: [] };
  e.n++;
  if (e.examples.length < 3) e.examples.push(input);
  viol.set(k, e);
};

function runPaths(input) {
  const res = {};
  const time = (fn) => { const t = performance.now(); let out; try { out = fn(); } catch (e) { out = { err: String(e?.name ?? 'Error') }; } return [out, performance.now() - t]; };
  res.kit = time(() => kit.generateCss(input, ctx));
  res.server = time(() => rt.generateCss(input));
  res.html = time(() => rt.generateCssForHtml(`<div class="${input}"></div>`));
  res.browser = time(() => {
    const r = kit.generateCssRules(input, ctx);
    const rules = [];
    for (const x of r) { for (const c of x.rootCssList ?? []) if (c && c.trim()) rules.push(c); for (const c of x.cssList ?? []) if (c && c.trim()) rules.push(c); }
    return rules;
  });
  return res;
}

/** In-process checks; returns [{path,prop,why}] and CSSOM jobs. */
function check(input, res) {
  const out = [];
  const jobs = [];
  const cls = H.classPredicate(input);
  for (const path of ['kit', 'server', 'html', 'browser']) {
    const [val, ms] = res[path];
    if (ms > H.TIME_MS) out.push({ path, prop: 'P4', why: 'time' });
    if (val && val.err) { out.push({ path, prop: 'P1', why: 'throws' }); continue; }
    const css = path === 'browser' ? val.join('\n') + (val.length ? '\n' : '') : val;
    const pred = path === 'html' ? H.htmlPredicate(input) : cls;
    for (const x of H.checkCss(css, input, pred)) out.push({ path, ...x });
    if (css) jobs.push({ path, css, rules: path === 'browser' ? val : null });
  }
  return { out, jobs };
}

// ---- CSSOM batch ----
const cssomSeen = new Map(); // css -> result tag list (cache)
let pending = []; // {path, css, rules, expect, input}
async function flush() {
  if (!pending.length) return;
  const batch = pending;
  pending = [];
  const results = await page.evaluate((items) => {
    const count = (list) => { let c = 0; for (const r of list) { c++; if (r.cssRules && !(r instanceof CSSKeyframesRule)) c += count(r.cssRules); else if (r instanceof CSSKeyframesRule) c += r.cssRules.length; } return c; };
    const STRIP = /::?(?:before|after|placeholder|marker|backdrop|selection|file-selector-button|first-line|first-letter|hover|focus-visible|focus-within|focus|active|visited|checked|disabled|enabled|open)\b/g;
    const decoys = [document.documentElement, document.body, ...document.body.querySelectorAll('*')];
    return items.map(({ css, rules, expect }) => {
      const bad = [];
      try {
        const s = new CSSStyleSheet();
        s.replaceSync(css);
        const got = count(s.cssRules);
        if (got !== expect) bad.push(got < expect ? 'cssom-rule-dropped' : 'cssom-rule-split');
        for (const r of s.cssRules) if (r instanceof CSSImportRule) bad.push('cssom-import');
        // #406 P2 by matching: the decoy DOM carries none of the input's classes, so no style rule may match it
        // (custom-property-only host blocks excepted). User-action pseudos and pseudo-elements are stripped first;
        // an emptied compound becomes `*`, but an emptied forgiving list (`:where()`, `:is()`) stays empty (matches nothing).
        const scan = (list) => {
          for (const r of list) {
            if (r instanceof CSSStyleRule) {
              const st = r.style; let customOnly = st.length > 0;
              for (let i = 0; i < st.length; i++) if (!st[i].startsWith('--')) customOnly = false;
              if (!customOnly) {
                const q = r.selectorText.replace(STRIP, '').replace(/\s*([>+~])\s*/g, '$1').replace(/(^|[\s,>+~])(?=[\s,>+~)]|$)/g, '$1*');
                try { if (decoys.some((el) => el.matches(q))) bad.push('dom-escape'); } catch { /* unmatchable */ }
              }
            } else if (r.cssRules && !(r instanceof CSSKeyframesRule)) scan(r.cssRules);
          }
        };
        scan(s.cssRules);
      } catch { bad.push('cssom-throws'); }
      if (rules) {
        for (const rule of rules) {
          try { const s = new CSSStyleSheet(); s.insertRule(rule, 0); if (s.cssRules.length !== 1) bad.push('insertrule-count'); }
          catch { bad.push('insertrule-throws'); }
        }
      }
      return [...new Set(bad)];
    });
  }, batch.map(({ css, rules, expect }) => ({ css, rules, expect })));
  results.forEach((bad, i) => {
    const job = batch[i];
    cssomSeen.set(job.path + '\0' + job.css, bad);
    for (const why of bad) note(job.path, why === 'dom-escape' ? 'P2' : 'P1', why, job.input, job.gen);
  });
}
async function enqueue(input, jobs) {
  for (const j of jobs) {
    const key = j.path + '\0' + j.css;
    const cached = cssomSeen.get(key);
    if (cached) { for (const why of cached) note(j.path, why === 'dom-escape' ? 'P2' : 'P1', why, input); continue; }
    cssomSeen.set(key, []);
    if (cssomSeen.size > 200000) cssomSeen.clear();
    pending.push({ ...j, expect: H.countRules(j.css), input, gen: curGen });
  }
  if (pending.length >= 1500) await flush();
}

async function one(input, gen) {
  counts[gen]++;
  curGen = gen;
  const res = runPaths(input);
  const { out, jobs } = check(input, res);
  for (const v of out) {
    if (v.prop === 'P4' && v.why === 'time') {
      // confirm timing once (GC / JIT noise)
      const again = runPaths(input)[v.path][1];
      if (again <= H.TIME_MS) continue;
    }
    note(v.path, v.prop, v.why, input);
  }
  await enqueue(input, jobs);
}

// ---- #406 self-test: the matching check must flag an unscoped rule and must not flag a scoped one ----
{
  const probes = [['st-unscoped', 'div{color:red}\n', true], ['st-action', ':hover>p{color:red}\n', true], ['st-scoped', '.st-only:hover{color:red}\n', false], ['st-host', ':root{--st:1}\n', false]];
  for (const [path, css] of probes) pending.push({ path, css, rules: null, expect: 1, input: '', gen: 'selftest' });
  await flush();
  for (const [path, css, want] of probes) {
    if ((cssomSeen.get(path + '\0' + css) ?? []).includes('dom-escape') !== want) throw new Error(`P2 matching self-test failed: ${path}`);
    cssomSeen.delete(path + '\0' + css);
  }
  for (const k of [...viol.keys()]) if (k.startsWith('st-')) viol.delete(k);
  for (const k of Object.keys(byGen)) if (k.startsWith('selftest|')) delete byGen[k];
  p2All.clear();
  p1Sample.clear();
}

// ---- main loop ----
const r = H.rng(SEED);
const deadline = Date.now() + MINUTES * 60_000;
const t0 = Date.now();
let sweepSeed = 0, sweepIt = null;
let total = 0;
while (INPUTS ? total < INPUTS : Date.now() < deadline) {
  for (let k = 0; k < 500 && (!INPUTS || total < INPUTS); k++) {
    const g = total % 4;
    if (g === 0) await one(H.genGrammar(r), 'grammar');
    else if (g === 1) await one(H.mutate(r, r.next() < 0.5 ? r.pick(seeds) : H.genGrammar(r)), 'mutation');
    else if (g === 2) {
      let x = sweepIt?.next();
      while (!x || x.done) { sweepIt = H.sweep(seeds[sweepSeed++ % seeds.length]); x = sweepIt.next(); }
      await one(x.value, 'sweep');
    } else await one(H.genRandom(r), 'random');
    total++;
  }
  if (!INPUTS && total % 50000 === 0) console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${total} inputs, ${[...viol.values()].reduce((a, e) => a + e.n, 0)} violations`);
}
await flush();

// ---- minimise + private store ----
async function stillViolates(key, input) {
  const [path, prop, why] = key.split('|');
  const res = runPaths(input);
  const { out, jobs } = check(input, res);
  if (out.some((v) => v.path === path && v.prop === prop && v.why === why)) return true;
  if (prop !== 'P1' || !why.startsWith('cssom') && !why.startsWith('insertrule')) return false;
  const j = jobs.find((x) => x.path === path);
  if (!j) return false;
  const [bad] = await page.evaluate(({ css, rules, expect }) => {
    const count = (list) => { let c = 0; for (const r of list) { c++; if (r.cssRules && !(r instanceof CSSKeyframesRule)) c += count(r.cssRules); else if (r instanceof CSSKeyframesRule) c += r.cssRules.length; } return c; };
    const b = [];
    try { const s = new CSSStyleSheet(); s.replaceSync(css); const g = count(s.cssRules); if (g !== expect) b.push(g < expect ? 'cssom-rule-dropped' : 'cssom-rule-split'); } catch { b.push('cssom-throws'); }
    if (rules) for (const rule of rules) { try { const s = new CSSStyleSheet(); s.insertRule(rule, 0); if (s.cssRules.length !== 1) b.push('insertrule-count'); } catch { b.push('insertrule-throws'); } }
    return [b];
  }, { css: j.css, rules: j.rules, expect: H.countRules(j.css) });
  return bad.includes(why);
}
async function minimiseAsync(key, input, budget = 300) {
  let cur = input, chunk = Math.max(1, cur.length >> 1);
  while (chunk >= 1 && budget > 0) {
    let changed = false;
    for (let i = 0; i < cur.length && budget > 0;) {
      const cand = cur.slice(0, i) + cur.slice(i + chunk);
      budget--;
      if (cand && (await stillViolates(key, cand))) { cur = cand; changed = true; } else i += chunk;
    }
    if (!changed) chunk >>= 1;
  }
  return cur;
}

const summary = {};
const privateRecords = [];
for (const [key, e] of viol) {
  summary[key] = e.n;
  if (OUT) {
    const mins = [];
    for (const ex of e.examples) mins.push(await minimiseAsync(key, ex));
    const [path, prop, why] = key.split('|');
    privateRecords.push({ path, prop, why, count: e.n, minimised: [...new Set(mins)] });
  }
}
console.log(JSON.stringify({ seed: SEED, minutes: MINUTES, seeds: { core: coreSeedCount, extra: seeds.length - coreSeedCount }, counts, total, cssomUnique: cssomSeen.size, violations: summary, byGenerator: byGen }, null, 1));
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `violations-seed${SEED}.json`), JSON.stringify(privateRecords, null, 1));
  writeFileSync(join(OUT, `p2-all-seed${SEED}.json`), JSON.stringify([...p2All]));
  writeFileSync(join(OUT, `p1-sample-seed${SEED}.json`), JSON.stringify([...p1Sample]));
  console.log(`private records: ${privateRecords.length} -> ${OUT}`);
}
await browser.close();
