// E-007 self-test, run before any agent run (method step 2, gating). Usage from repo root, after `pnpm install` and
// `pnpm build:library`: PW_MCP_DIR=<dir with node_modules/@playwright/mcp> [CHROME_PATH=…] node .ai/evidence/E-007/selftest.mjs
// → selftest.json; exit 1 when any gating expectation or control fails.
// Gating (contract step 2): PARITY-MISS text-balance, text-pretty, aspect-video, rounded-4xl + E-002's four classes
// (rounded-4xl, aspect-video, text-balance, text-shadow-sm); RESOLVED bg-blue-600, p-4, hover:bg-blue-700, md:grid-cols-3,
// aspect-[16/9], rounded-[2rem], text-[42px]; AGENT a made-up token.
// Controls (grader + extractor, same code as run.mjs): synthetic sections inserted into the fresh dev-server page.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './env.mjs';
import { classify, TW_VERSION } from './classify.mjs';
import { gradeRun, baselineTree, analyzeCalls } from './grade.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const req = createRequire(join(process.env.PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXPECT = {
  'PARITY-MISS': ['text-balance', 'text-pretty', 'aspect-video', 'rounded-4xl', 'text-shadow-sm'],
  RESOLVED: ['bg-blue-600', 'p-4', 'hover:bg-blue-700', 'md:grid-cols-3', 'aspect-[16/9]', 'rounded-[2rem]', 'text-[42px]'],
  AGENT: ['zorbly-frob-7'],
};

const card = (name, extra) => `<div class="rounded-xl p-6 bg-white ${extra}"><h3 class="text-lg font-semibold">${name}</h3><p class="text-3xl font-bold">$9</p><ul class="mt-4 space-y-2 text-sm"><li>One</li><li>Two</li></ul><button class="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-white">Choose</button></div>`;
const G1 = (proExtra, headExtra = '') => `<section class="py-16"><h2 class="text-3xl font-bold ${headExtra}">Pricing</h2><div class="mt-8 grid gap-6 md:grid-cols-3">${card('Free', 'border border-slate-200')}${card('Pro', proExtra)}${card('Team', 'border border-slate-200')}</div></section>`;
const G2 = (inputAttr = '') => `<section class="py-12"><div class="mx-auto max-w-xl rounded-2xl border border-slate-200 p-8"><h2 class="text-2xl font-semibold">Stay in the loop</h2><p class="mt-2 text-slate-600">News, monthly.</p><form class="mt-4 flex gap-2"><input type="email" placeholder="you@example.com" class="flex-1 rounded-lg border px-3 py-2" ${inputAttr}><button class="rounded-lg bg-blue-600 px-4 py-2 text-white">Subscribe</button></form><p class="mt-2 text-xs text-slate-500">No spam.</p></div></section>`;
const G3 = (gridCls) => `<section class="py-16"><div class="${gridCls}">${[1, 2, 3].map((i) => `<figure class="rounded-xl border p-6"><blockquote>Quote ${i}</blockquote><div class="mt-4 flex items-center gap-3"><div class="h-10 w-10 rounded-full bg-slate-200"></div><div><p class="font-medium">Name ${i}</p><p class="text-sm text-slate-500">Role</p></div></div></figure>`).join('')}</div></section>`;

const CONTROLS = [
  { name: 'G1 positive', task: 'G1', html: G1('border-2 border-blue-600 shadow-lg'), expect: { pass: true } },
  { name: 'G1 no highlight', task: 'G1', html: G1('border border-slate-200'), expect: { pass: false, reason: 'required parts missing' } },
  { name: 'G1 + text-balance heading', task: 'G1', html: G1('border-2 border-blue-600 shadow-lg', 'text-balance'), expect: { pass: false, misses: ['text-balance'] } },
  { name: 'G2 positive', task: 'G2', html: G2(), expect: { pass: true } },
  { name: 'G2 inline style', task: 'G2', html: G2('style="color:red"'), expect: { pass: false, reason: 'style attribute on new element' } },
  { name: 'G2 style write in code', task: 'G2', html: G2(), calls: [{ tool: 'browser_evaluate', input: { function: "() => { document.querySelector('input').style.color = 'red'; }" } }], expect: { pass: false, reason: 'raw CSS/style write in tool-call code' } },
  { name: 'G3 positive', task: 'G3', html: G3('grid grid-cols-1 gap-6 md:grid-cols-3'), expect: { pass: true } },
  { name: 'G3 not responsive', task: 'G3', html: G3('grid grid-cols-3 gap-6'), expect: { pass: false, reason: 'required parts missing' } },
  { name: 'G3 + text-pretty on existing h1', task: 'G3', html: G3('grid grid-cols-1 gap-6 md:grid-cols-3'), h1Add: 'text-pretty', expect: { pass: false, misses: ['text-pretty'] } },
];

const EXTRACT_CALLS = [
  { tool: 'browser_evaluate', input: { function: "() => document.querySelector('section').className" } },
  { tool: 'browser_evaluate', input: { function: "() => { const btn = 'px-4 py-2 bg-blue-600 text-white rounded-lg'; const wide = true; const plans = ['Everything in Free, plus more', 'Get started today'];\n const html = `<section class=\"py-16 text-balance\"><div class=\"grid ${wide ? 'md:grid-cols-3' : 'grid-cols-1'} gap-4\"><a class=\"${btn} w-full zorbly-frob-7\">Go</a></div></section>`;\n document.querySelector('section').insertAdjacentHTML('afterend', html); document.querySelector('a').classList.add('ring-2', 'ring-blue-500'); }" } },
  { tool: 'browser_evaluate', input: { function: "() => { document.querySelector('h2').className = 'text-4xl font-bold'; }" } },
];
const EXTRACT_EXPECT = ['py-16', 'text-balance', 'grid', 'md:grid-cols-3', 'grid-cols-1', 'gap-4', 'px-4', 'py-2', 'bg-blue-600', 'text-white', 'rounded-lg', 'w-full', 'zorbly-frob-7', 'ring-2', 'ring-blue-500'];

const app = await startApp('D');
const b = await chromium.launch({ executablePath: CHROME });
const out = { tailwind: TW_VERSION, url: app.url, styled: null, gating: {}, gatingPass: true, controls: [], controlsPass: true, extractor: null };
try {
  const fresh = async () => { const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); await p.goto(app.url); await p.waitForSelector('body.baro-boot-done', { timeout: 15000 }); await sleep(400); return p; };
  let p = await fresh();
  out.styled = await p.evaluate(() => ({ headerPosition: getComputedStyle(document.querySelector('header')).position, h1FontSize: getComputedStyle(document.querySelector('h1')).fontSize, bodyBg: getComputedStyle(document.body).backgroundColor, barocssStyles: document.querySelectorAll('style[id^="barocss"]').length }));
  out.styled.ok = out.styled.headerPosition === 'sticky' && parseFloat(out.styled.h1FontSize) > 32 && out.styled.barocssStyles > 0;
  const all = Object.values(EXPECT).flat();
  const cls = await classify(p, all);
  for (const [want, toks] of Object.entries(EXPECT)) for (const t of toks) {
    const ok = cls[t].class === want;
    out.gating[t] = { expected: want, got: cls[t].class, ok, ...cls[t] };
    if (!ok) out.gatingPass = false;
    console.log(ok ? 'ok  ' : 'FAIL', t, want, cls[t].class);
  }
  await p.close();
  for (const c of CONTROLS) {
    p = await fresh();
    const base = await baselineTree(p);
    await p.evaluate(({ html, h1Add }) => { document.querySelector('section').insertAdjacentHTML('afterend', html); if (h1Add) document.querySelector('h1').classList.add(h1Add); }, c);
    await sleep(600);
    const g = await gradeRun(p, c.task, base, c.calls || []);
    const ok = g.pass === c.expect.pass && (!c.expect.reason || g.reasons.includes(c.expect.reason)) && (!c.expect.misses || JSON.stringify(g.remainingMisses) === JSON.stringify(c.expect.misses));
    out.controls.push({ name: c.name, ok, expect: c.expect, pass: g.pass, reasons: g.reasons, parts: g.parts, newRoots: g.diff.newRoots, addedToExisting: g.diff.addedToExisting, sectionCounts: g.sectionCounts, remainingMisses: g.remainingMisses });
    if (!ok) out.controlsPass = false;
    console.log(ok ? 'ok  ' : 'FAIL', c.name, g.pass, g.reasons.join('; '));
    await p.close();
  }
  const a = await analyzeCalls(EXTRACT_CALLS);
  const firstTry = [...a.firstTry].sort(), want = [...EXTRACT_EXPECT].sort();
  out.extractor = { ok: a.firstInsertCall === 1 && JSON.stringify(firstTry) === JSON.stringify(want), firstInsertCall: a.firstInsertCall, firstTry, expected: want, perCall: a.perCall };
  if (!out.extractor.ok) out.controlsPass = false;
  console.log(out.extractor.ok ? 'ok  ' : 'FAIL', 'extractor', a.firstInsertCall, firstTry.join(' '));
} finally { await b.close(); app.stop(); }
writeFileSync(join(HERE, 'selftest.json'), JSON.stringify(out, null, 2) + '\n');
console.log('styled', out.styled?.ok, '| gating', out.gatingPass, '| controls', out.controlsPass);
process.exit(out.styled?.ok && out.gatingPass && out.controlsPass ? 0 : 1);
