/* global BaroCSS */ /* eslint-disable no-console */
// #384: full-corpus Shadow DOM parity. Renders every class of both parity corpora (the #179 corpus, 338 classes,
// and the #243 held-out corpus, 567 classes) once with the document runtime and once inside a shadow root
// (BrowserRuntime({ root })), then diffs the full computed style of every element (and its ::before/::after).
// A var-only class (ring-*, from-*, shadow colours, ...) is rendered with its composition partner, as the parity
// tests judge it (parity-compare.ts partnerOf). Exit code 1 when any computed value differs.
//
//   pnpm build:library   # needs packages/barocss-browser/dist/cdn/barocss.umd.cjs
//   PW_DIR=<dir whose node_modules has playwright-core> [CHROME=<chromium binary>] [ENGINE=chromium|firefox|webkit] \
//     [BARO_UMD=<other build>] node scripts/shadow-parity/run.mjs
//
// Writes scripts/shadow-parity/result.<engine>.json. CI has no browser for this, so it is a documented command.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = process.env.ENGINE || 'chromium';
const UMD = process.env.BARO_UMD || path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs');
const pw = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');

// The corpora are plain TS data modules: read the [token, uses] pairs without a TS loader.
const readCorpus = (file) => [...fs.readFileSync(path.join(ROOT, 'packages/barocss/tests/compat', file), 'utf8')
  .matchAll(/^\s*\["((?:[^"\\]|\\.)*)",\s*\d+\]/gm)].map((m) => JSON.parse(`"${m[1]}"`));
// Same as parity-compare.ts partnerOf.
function partnerOf(token) {
  const cut = token.lastIndexOf(':');
  const prefix = cut < 0 ? '' : token.slice(0, cut + 1);
  const base = cut < 0 ? token : token.slice(cut + 1);
  if (/^inset-ring-/.test(base)) return `${prefix}inset-ring-2`;
  if (/^ring-/.test(base)) return `${prefix}ring-2`;
  if (/^(from|via|to)-/.test(base)) return `${prefix}bg-linear-to-r`;
  if (/^inset-shadow-/.test(base)) return `${prefix}inset-shadow-sm`;
  if (/^shadow-/.test(base)) return `${prefix}shadow-md`;
  return undefined;
}
const corpora = { corpus: readCorpus('corpus.ts'), heldout: readCorpus('corpus-heldout.ts') };

const browser = await pw[ENGINE].launch({ executablePath: ENGINE === 'chromium' ? process.env.CHROME : undefined });
async function measure(mode, tokens) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"><div id="host"></div></body></html>');
  await page.addScriptTag({ path: UMD });
  const out = await page.evaluate(async ({ mode, items }) => {
    const html = items.map(([t, cls], i) => `<div class="w"><div data-i="${i}" class="${cls.replace(/"/g, '&quot;')}">${t.includes('content') ? '' : 'x'}<span>y</span></div></div>`).join('');
    const host = document.getElementById('host');
    let scope;
    if (mode === 'document') {
      host.innerHTML = html; scope = host;
      // One partition: with the default 50-rule partitions, a rule that overflows into a later <style> beats an
      // equal-specificity rule of an earlier one (shadow-[…] shadow-md on one element), a document-mode ordering
      // quirk unrelated to root mode; the shadow sheet is one sorted list, like a single partition.
      BaroCSS.getRuntime({ maxRulesPerPartition: 100000 }).observe(host, { scan: true });
    } else {
      // 'fallback': the document refuses the <style> (as in an environment without document access), so the
      // runtime has to use the :host initial values inside the root.
      if (mode === 'fallback') document.head.appendChild = () => { throw new Error('no document access'); };
      const sr = host.attachShadow({ mode: 'open' }); sr.innerHTML = html; scope = sr;
      new BaroCSS.BrowserRuntime({ root: sr, config: {} });
    }
    await new Promise((r) => setTimeout(r, 500));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Freeze animations (animate-spin, animate-pulse, ...) at t=0 so both modes are sampled at the same frame.
    for (const el of scope.querySelectorAll('[data-i]')) for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = 0; }
    const res = [];
    for (const el of scope.querySelectorAll('[data-i]')) {
      const snap = {};
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        for (let k = 0; k < cs.length; k++) { const p = cs[k]; if (p.startsWith('--')) continue; snap[`${pseudo || ''}${p}`] = cs.getPropertyValue(p); }
      }
      res.push(snap);
    }
    const docText = [...document.styleSheets, ...document.adoptedStyleSheets].flatMap((s) => [...s.cssRules].map((r) => r.cssText));
    return { res, documentRules: docText.length, documentNonProperty: mode !== 'document' ? docText.filter((t) => !/^@property\s/.test(t)).length : null };
  }, { mode, items: tokens.map((t) => [t, [t, partnerOf(t)].filter(Boolean).join(' ')]) });
  await page.close();
  return out;
}

const result = { engine: ENGINE, build: path.relative(ROOT, UMD), corpora: {} };
let failed = 0;
for (const [name, tokens] of Object.entries(corpora)) {
  const doc = await measure('document', tokens);
  result.corpora[name] = { classes: tokens.length };
  for (const mode of ['shadow', 'fallback']) {
    const sh = await measure(mode, tokens);
    const diffs = [];
    tokens.forEach((t, i) => {
      const a = doc.res[i], b = sh.res[i];
      const props = Object.keys(a).filter((p) => a[p] !== b[p]);
      if (props.length) diffs.push({ token: t, props: props.slice(0, 6).map((p) => `${p}: ${b[p]} ≠ ${a[p]}`) });
    });
    failed += diffs.length + (sh.documentNonProperty ? 1 : 0);
    result.corpora[name][mode] = { differing: diffs.length, documentRules: sh.documentRules, documentNonPropertyRules: sh.documentNonProperty, diffs: diffs.slice(0, 40) };
    console.log(`${ENGINE} ${name} ${mode}: ${tokens.length} classes, ${diffs.length} differ from document mode; the document holds ${sh.documentRules} rules (${sh.documentNonProperty} non-@property)`);
    for (const d of diffs.slice(0, 8)) console.log(`  ${d.token}: ${d.props.slice(0, 2).join('; ')}`);
  }
}
await browser.close();
fs.writeFileSync(path.join(ROOT, `scripts/shadow-parity/result.${ENGINE}.json`), `${JSON.stringify(result, null, 2)}\n`);
process.exit(failed ? 1 : 0);
