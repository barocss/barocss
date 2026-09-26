// #385 L3 feedback run (K13 / E-011 style). For #253 CMS blocks with off-token classes, the model that wrote the block
// gets feedback and revises (max 2 turns): arm A = BaroCSS classifier report (class -> off-token + nearest site token),
// arm B = Tailwind reset + lint feedback (the site @theme + classes that produce no CSS in the reset build + arbitrary
// values), arm C = no feedback ("Revise the block."). Measures on-token share, turns, and fidelity to the original block
// (rendered in Chromium with the site's Tailwind build: text kept, element count, block height).
// Rerun (repo root): PW_DIR=<dir with node_modules/playwright-core> CHROME=<chromium> node scripts/o7-enforce/run.mjs
// Raw model replies are cached in scripts/o7-enforce/raw/ (a rerun reuses them; delete to re-query).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { classify, overlayElement } from './classify.mjs';
import { baselineFlag, SITE_TW } from './baseline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const RAW = path.join(HERE, 'raw'); fs.mkdirSync(RAW, { recursive: true });
const MODELS = ['opus', 'haiku'], KINDS = ['hero', 'feature-grid', 'cta+overlay'], ARMS = ['A', 'B', 'C'];
const SITE = 'cms253';
const classesOf = (h) => [...h.matchAll(/class(?:Name)?="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
const fence = (t) => ((t.match(/```(?:html)?\s*\n([\s\S]*?)```/) || [0, t])[1]).trim();
const MAP = { gray: 'slate', zinc: 'slate', neutral: 'slate', stone: 'slate', blue: 'brand', indigo: 'brand', sky: 'brand', violet: 'brand', purple: 'brand', cyan: 'brand', yellow: 'accent', amber: 'accent', orange: 'accent', green: 'brand', emerald: 'brand', red: 'accent', rose: 'accent', pink: 'accent' };
const nearest = (fam, n) => { const opts = fam === 'accent' ? [400, 500, 600] : fam === 'brand' ? [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] : [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]; return opts.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a)); };
function suggest(cls) {
  const m = cls.match(/^(.*?)([a-z]+)-(\d+)(\/\d+)?$/);
  if (!m || !MAP[m[2]]) return 'a brand-*, accent-*, slate-* or white class';
  return `${m[1]}${MAP[m[2]]}-${nearest(MAP[m[2]], +m[3])}${m[4] || ''}`;
}
const reportA = (bad) => `Design-system report from our site's CSS engine. Site theme: colors brand-50..950, accent-400..600, slate-*, white/black; font-display. Every other class resolved on-token.\n` +
  bad.map((r) => r.label === 'policy' ? `- ${r.cls}: policy (overlay: ${r.why}; generated content may not cover the page) -> remove it` : r.label === 'unresolved' ? `- ${r.cls}: unresolved (produces no CSS)` : `- ${r.cls}: off-token (${r.kind}, ${r.why === 'arbitrary' ? 'arbitrary value' : "default palette colour the site theme doesn't define"}) -> use ${suggest(r.cls)}`).join('\n');
const reportB = (dropped, arb) => `Our build resets Tailwind's default theme and keeps only the site theme below; a lint rule rejects arbitrary values.\n\`\`\`css\n${SITE_TW[SITE]}\n\`\`\`\n` +
  (dropped.length ? `These classes produce no CSS in that build: ${dropped.join(' ')}\n` : '') + (arb.length ? `Lint (no arbitrary values): ${arb.join(' ')}\n` : '');

async function feedback(arm, html) {
  const cs = [...new Set(classesOf(html))];
  if (arm === 'A') { const bad = cs.map((c) => classify(c, SITE)).filter((r) => r.label !== 'on-token'); return bad.length ? reportA(bad) : null; }
  if (arm === 'B') { const dropped = [], arb = []; for (const c of cs) { const b = await baselineFlag(SITE, c); if (b.lint) arb.push(c); else if (b.droppedByReset || b.unknown) dropped.push(c); } return dropped.length || arb.length ? reportB(dropped, arb) : null; }
  return 'Revise the block.';
}
let cost = 0;
function ask(key, prompt, model) {
  const f = path.join(RAW, key + '.json');
  if (!fs.existsSync(f)) fs.writeFileSync(f, execFileSync('claude', ['-p', prompt, '--model', model, '--tools', '', '--output-format', 'json'], { cwd: '/private/tmp/claude-501', env: { ...process.env, CLAUDECODE: '' }, maxBuffer: 1 << 26 }));
  const d = JSON.parse(fs.readFileSync(f, 'utf8')); cost += d.total_cost_usd || 0; return fence(d.result || '');
}
const onShare = (h) => { const cs = classesOf(h); const r = cs.map((c) => classify(c, SITE).label); return { uses: cs.length, on: +(r.filter((l) => l === 'on-token').length / cs.length).toFixed(3), off: r.filter((l) => l === 'off-token').length, unresolved: r.filter((l) => l === 'unresolved').length, policy: r.filter((l) => l === 'policy').length, overlayEls: [...h.matchAll(/class="([^"]*)"/g)].filter((m) => overlayElement(m[1], SITE)).length }; };
// 'cta+overlay': the recorded CTA block wrapped in a GENERIC overlay shape (fixed + inset-0 + z-50), since no recorded
// output contained one unprompted; tests whether each arm's feedback removes it.
const SEED = (h) => `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">\n${h}\n</div>`;

// Chromium render with the site's normal Tailwind build (no reset), so fidelity compares like with like.
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const load = async (id, base) => { const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, '')); const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, '')); return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') }; };
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
async function render(html) {
  const c = await compile(`@import "tailwindcss";\n${SITE_TW[SITE]}`, { base: twDir, loadStylesheet: load });
  await pg.setContent(`<!doctype html><html><head><style>${c.build(classesOf(html))}</style></head><body><div id="b">${html}</div></body></html>`);
  return pg.evaluate(() => { const b = document.getElementById('b'); return { h: b.getBoundingClientRect().height, els: b.querySelectorAll('*').length, words: b.innerText.toLowerCase().split(/\W+/).filter(Boolean) }; });
}
const jacc = (a, b) => { const A = new Set(a), B = new Set(b); return +([...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size).toFixed(3); };

const runs = [];
for (const m of MODELS) for (const k of KINDS) {
  const src = k.replace('+overlay', '');
  let orig = fs.readFileSync(path.join(ROOT, 'scripts/cms-probe/blocks', `${m}-${src}.html`), 'utf8').trim();
  if (k.endsWith('+overlay')) orig = SEED(orig);
  const base = `You are the AI assistant in our CMS. The site uses Tailwind CSS. Write the ${src.replace('-', ' ')} block as an HTML fragment with Tailwind utility classes.`;
  const r0 = await render(orig);
  for (const arm of ARMS) {
    let html = orig, turns = 0;
    for (let t = 1; t <= (arm === 'C' ? 1 : 2); t++) {
      const fb = await feedback(arm, html); if (!fb) break;
      html = ask(`${m}-${k}-${arm}-t${t}`, `${base}\n\nHere is the block you wrote:\n\`\`\`html\n${html}\n\`\`\`\n\n${fb}\n\nReply with only the revised HTML fragment in one html code fence.`, m); turns = t;
    }
    const r1 = await render(html);
    runs.push({ model: m, kind: k, arm, turns, before: onShare(orig), after: onShare(html), fidelity: { textJaccard: jacc(r0.words, r1.words), elRatio: +(r1.els / r0.els).toFixed(2), heightRatio: +(r1.h / r0.h).toFixed(2) } });
    console.log(JSON.stringify(runs.at(-1)));
  }
}
await browser.close();
const summ = {};
for (const r of runs) { const s = (summ[`${r.arm}|${r.model}`] ||= { n: 0, before: 0, after: 0, allOn: 0, turns: 0, text: 0, height: 0 }); s.n++; s.before += r.before.on; s.after += r.after.on; s.allOn += r.after.on === 1 ? 1 : 0; s.turns += r.turns; s.text += r.fidelity.textJaccard; if (Number.isFinite(r.fidelity.heightRatio)) { s.height += r.fidelity.heightRatio; s.hn = (s.hn || 0) + 1; } }
for (const s of Object.values(summ)) { for (const k of ["before", "after", "turns", "text"]) s[k] = +(s[k] / s.n).toFixed(3); s.height = +(s.height / s.hn).toFixed(3); delete s.hn; }
console.log('arm|model', JSON.stringify(summ, null, 0), 'cost_usd', cost.toFixed(4));
const out = path.join(HERE, 'result.json');
const prev = JSON.parse(fs.readFileSync(out, 'utf8'));
prev.l3 = { site: '#253 cms', models: MODELS, kinds: KINDS, summary: summ, runs, costUsd: +cost.toFixed(4) };
fs.writeFileSync(out, JSON.stringify(prev, null, 1));
