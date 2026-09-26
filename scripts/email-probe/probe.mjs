// #250 AI HTML email probe — classify + inline arms.
// Rerun: node scripts/email-probe/probe.mjs   (needs packages/barocss + barocss-server build:library)
// Harness code only. Arms (a) Tailwind+juice and (b) react-email/Maizzle are skipped: not installed locally.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(dir, 'outputs');
const require = createRequire(path.join(dir, '../../packages/barocss-server/package.json'));
// kit's package exports point at src/*.ts; alias '@barocss/kit' to its built CJS for plain node.
const Module = require('node:module');
const kitCjs = path.join(dir, '../../packages/barocss/dist/index.cjs');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { return req === '@barocss/kit' ? kitCjs : origResolve.call(this, req, ...a); };
const { ServerRuntime } = require('./dist/index.cjs');

const html = {};
let cost = 0;
for (const f of fs.readdirSync(out).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
  cost += j.total_cost_usd || 0;
  let t = j.result || '';
  const m = t.match(/```(?:html)?\n([\s\S]*?)```/);
  if (m) t = m[1];
  html[f.replace('.json', '')] = t;
  fs.writeFileSync(path.join(out, f.replace('.json', '.html')), t);
}

const classify = (t) => {
  const cls = [...t.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
  const util = cls.filter((c) => /^(p[xytrbl]?|m[xytrbl]?|text|bg|font|rounded|flex|grid|w|h|border|shadow|gap|items|justify)-/.test(c)).length;
  const inline = (t.match(/style="/g) || []).length;
  const block = /<style[\s>]/.test(t);
  const kinds = [util > 5 && 'utility', inline > 5 && 'inline', block && 'style-block'].filter(Boolean);
  return { kind: kinds.length > 1 ? `mixed(${kinds.join('+')})` : kinds[0] || 'none', util, inline, block };
};

const UNSAFE = { 'var(': /var\(/g, 'oklch(': /oklch\(/g, 'color-mix(': /color-mix\(/g, '@property': /@property/g, '@layer': /@layer/g, ':root': /:root/g, 'flex/grid': /display:\s*(inline-)?(flex|grid)/g };
// Short hard-coded caniemail-style list (Gmail web/app + Outlook Windows desktop).
const COMPAT = {
  'CSS variables (Gmail, Outlook)': /var\(--/,
  'oklch/color-mix (Gmail, Outlook)': /oklch\(|color-mix\(/,
  'flex/grid (Outlook Win)': /display:\s*(inline-)?(flex|grid)/,
  'gap (Gmail, Outlook)': /(^|[;\s"])gap:/,
  'box-shadow (Outlook Win, Gmail partial)': /box-shadow:/,
  'border-radius (Outlook Win)': /border-radius:/,
  'rem units (Outlook Win)': /\d(\.\d+)?rem/,
  'at-rules in body style (all)': /@property|@layer|@supports/,
};
const scan = (t) => ({
  unsafe: Object.fromEntries(Object.entries(UNSAFE).map(([k, r]) => [k, (t.match(r) || []).length]).filter(([, v]) => v)),
  compat: Object.keys(COMPAT).filter((k) => COMPAT[k].test(t)),
});

// Arm (c): BaroCSS generateCss + tiny inliner (simple .class selectors only; var() left as-is).
const rt = new ServerRuntime();
const unesc = (s) => s.replace(/\\(.)/g, '$1');
function inlineBaro(t) {
  const classes = [...new Set([...t.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean))];
  const css = classes.map((c) => { try { return rt.generateCss(c); } catch { return ''; } }).join('\n');
  const decls = {}; let unresolved = [];
  for (const m of css.matchAll(/(^|\n)\s*\.((?:\\.|[\w-])+)\s*\{([^{}]*)\}/g)) (decls[unesc(m[2])] ||= []).push(m[3].trim().replace(/\s*\n\s*/g, ' '));
  const leftover = css.replace(/(^|\n)\s*\.((?:\\.|[\w-])+)\s*\{[^{}]*\}/g, '').trim(); // :root, @property, variants...
  const res = t.replace(/class="([^"]+)"/g, (all, v) => {
    const s = v.split(/\s+/).flatMap((c) => { if (!decls[c]) { unresolved.push(c); return []; } return decls[c]; }).join(' ');
    return s ? `style="${s.replace(/"/g, "'")}"` : '';
  });
  const outHtml = leftover ? res.replace('</head>', `<style>${leftover}</style></head>`) : res;
  return { outHtml, unresolved: [...new Set(unresolved)], css };
}

const rows = [];
for (const [k, t] of Object.entries(html)) {
  const c = classify(t);
  rows.push({ id: k, bytes: Buffer.byteLength(t), ...c, ...scan(t) });
}
const arms = [];
for (const k of Object.keys(html).filter((k) => classify(html[k]).util > 5)) {
  const r = inlineBaro(html[k]);
  fs.writeFileSync(path.join(out, `${k}.baro-inlined.html`), r.outHtml);
  arms.push({ id: k, arm: 'c:barocss+mini-inliner', inBytes: Buffer.byteLength(html[k]), bytes: Buffer.byteLength(r.outHtml), ...scan(r.outHtml), unresolvedClasses: r.unresolved.length, unresolvedSample: r.unresolved.slice(0, 6) });
}
const report = { cost_usd: +cost.toFixed(3), classify: rows, arms, skipped: { 'a:tailwind4.1.13+juice': 'tailwindcss and juice not in node_modules; needs `npm i tailwindcss@4.1.13 juice`', 'b:react-email/maizzle': 'not present; needs `npm i @react-email/components @react-email/render` or `@maizzle/framework`' } };
fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cost: report.cost_usd, classify: rows.map((r) => `${r.id}:${r.kind} ${r.bytes}B compat=${r.compat.length}`), arms }, null, 1));
