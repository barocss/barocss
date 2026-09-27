// #426: unresolved-class rate in committed AI-generated corpora + existing-capability test.
// Rerun: node scripts/unresolved-426/run.mjs [path/to/barocss/dist/index.js] [path/to/node_modules/tailwindcss]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const KIT = process.argv[2] || path.join(ROOT, 'packages/barocss/dist/index.js');
const TWD = process.argv[3] || path.join(ROOT, 'node_modules/tailwindcss');
const { createContext, generateCss } = await import(pathToFileURL(KIT).href);
const { BRAND, ACCENT, FONTS } = await import(pathToFileURL(path.join(ROOT, 'scripts/cms-probe/site.mjs')).href);
const cmsTheme = { extend: { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONTS.display.split(', '), sans: FONTS.sans.split(', ') } } };
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
const htmlToks = (h) => [...h.matchAll(/\bclass(?:Name)?="([^"]*)"/g)].flatMap((m) => split(m[1]));
const cssClasses = (h) => new Set([...h.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  .flatMap((block) => [...block[1].matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1])));
const dynamicTokens = (h) => new Set([...h.matchAll(/\+\s*([a-zA-Z_$][\w$]*)\s*(?:\+|\r?\n)/g)].map((m) => m[1]));
const dirFiles = (d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.html'))
  .map((f) => { const h = fs.readFileSync(path.join(ROOT, d, f), 'utf8'); return [f.split('-')[0], htmlToks(h), fileConfig(h), cssClasses(h), dynamicTokens(h)]; });
// Read only literal data from the recorded Play-CDN config. Never execute model-generated HTML.
const literal = (node) => {
  if (ts.isParenthesizedExpression(node)) return literal(node.expression);
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map((p) => {
    if (!ts.isPropertyAssignment(p) || !p.name || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name)))
      throw new Error('Unsupported config property');
    return [p.name.text, literal(p.initializer)];
  }));
  throw new Error('Non-literal config value');
};
const fileConfig = (h) => {
  const m = h.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (!m) return null;
  const source = ts.createSourceFile('config.ts', `const cfg = (${m[1]});`, ts.ScriptTarget.Latest);
  if (source.parseDiagnostics.length) throw new Error('Invalid inline Tailwind config');
  return literal(source.statements[0].declarationList.declarations[0].initializer);
};
const specToks = () => { const out = []; JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/json-render-probe/specs.json'), 'utf8'), (k, v) => { if (k === 'className') out.push(...split(v)); return v; }); return [['unrecorded', out]]; };
const CORPORA = [
  { id: '#182 json-render specs', files: specToks(), theme: {} },
  { id: '#199 MCP-App (unprompted)', files: dirFiles('scripts/mcp-model-outputs/outputs'), theme: {} },
  { id: '#209 MCP-App (Tailwind-prompted)', files: dirFiles('scripts/mcp-model-outputs/outputs-tw'), theme: {} },
  { id: '#253 CMS blocks (site theme)', files: dirFiles('scripts/cms-probe/blocks').map(([m, t]) => [m, t, { theme: cmsTheme }]), theme: {} },
  { id: '#364 O5 widget blocks', files: dirFiles('scripts/o5-probe/blocks'), theme: {} },
];
// Tailwind 4.3.3 reference: fresh compiler per candidate (build() is incremental), CSS longer than empty build = known.
let twKnown = null;
{
  const twVersion = JSON.parse(fs.readFileSync(path.join(TWD, 'package.json'), 'utf8')).version;
  if (twVersion !== '4.3.3') throw new Error(`Expected Tailwind 4.3.3, got ${twVersion}`);
  const { compile } = await import(pathToFileURL(path.join(TWD, 'dist/lib.mjs')).href);
  const load = async (id) => { const p = id === 'tailwindcss' ? path.join(TWD, 'index.css') : path.join(TWD, id.replace(/^tailwindcss\//, ''));
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') }; };
  const cache = new Map();
  twKnown = async (t) => { if (!cache.has(t)) { const k = await compile('@import "tailwindcss";', { base: TWD, loadStylesheet: load }); const e = k.build([]).length; cache.set(t, k.build([t]).length > e); } return cache.get(t); };
  await twKnown('flex');
}
const V3 = /(^|:)(flex-grow(-0)?|flex-shrink(-0)?|overflow-ellipsis|decoration-(slice|clone)|shadow-outline|(bg|text|border|ring|divide|placeholder)-opacity-\d+|transform|filter|backdrop-filter|transform-gpu)$/;
const PLUGIN = /(^|:)(prose(-\w+)?|not-prose|form-(input|select|checkbox|radio|textarea))$/;
const UTIL = /^(-?(bg|text|p[xytrbl]?|m[xytrbl]?|w|h|min-w|max-w|flex|grid|gap|rounded|border|font|shadow|ring|space|inset|top|left|right|bottom|z|opacity|leading|tracking|col|row|justify|items|self|place|overflow|translate|scale|rotate|duration|ease|transition|animate|divide|outline|size|aspect|object|order|line-clamp|decoration|underline|from|via|to|fill|stroke|cursor|select|list|whitespace|break|truncate|sr|hover|focus|md|sm|lg|xl|dark)(-|:|$))/;
const classify = async (t, declared, dynamic) => {
  if (/['"`${}+?=]|^[:?]$/.test(t)) return 'extraction-artifact (JS template fragment)';
  if (await twKnown(t)) return 'valid-4.3-baro-misses';
  if (dynamic.has(t)) return 'extraction-artifact (JS template fragment)';
  if (declared.has(t)) return 'app-custom-class';
  if (V3.test(t)) return 'tailwind-v3-only';
  if (PLUGIN.test(t)) return 'plugin-utility';
  if (/\[/.test(t)) return 'invalid-arbitrary';
  if (UTIL.test(t)) return 'typo-or-invented-utility';
  return 'app-custom-class';
};
const ctxFor = (cfg) => createContext(cfg || {});
const result = { kit: path.relative(ROOT, KIT), tailwind: '4.3.3 compile()', corpora: [] };
const cats = {}, parity = new Set();
for (const C of CORPORA) {
  const byModel = {}, all = new Set(), miss = new Set(), missM = {}, declared = new Set(), dynamic = new Set(); let ownCfg = 0;
  for (const [m, toks, cfg, css, fragments] of C.files) {
    for (const name of css || []) declared.add(name);
    for (const name of fragments || []) dynamic.add(name);
    const ctx = ctxFor(cfg); if (cfg) ownCfg++; byModel[m] ??= new Set(); missM[m] ??= new Set();
    for (const t of new Set(toks)) { byModel[m].add(t); all.add(t); if (!generateCss(t, ctx).trim()) { miss.add(t); missM[m].add(t); } }
  }
  const cls = {};
  for (const t of miss) { const c = await classify(t, declared, dynamic); (cls[c] ??= []).push(t); (cats[c] ??= new Set()).add(t); if (c === 'valid-4.3-baro-misses') parity.add(t); }
  const models = Object.fromEntries(Object.entries(byModel).map(([m, s]) => [m, { unique: s.size, unresolved: missM[m].size }]));
  result.corpora.push({ id: C.id, unique: all.size, unresolved: miss.size, rate: +(miss.size / all.size).toFixed(3), filesWithOwnConfig: ownCfg, models, categories: cls });
}
result.categoryTotals = Object.fromEntries(Object.entries(cats).map(([k, s]) => [k, s.size]));
result.parityCandidates = [...parity];
// Existing-capability test: the agent-side snippet (public API only; see NOTES.md), run on #209.
const agentNoOps = (classes, ctx) => [...new Set(classes.split(/\s+/).filter(Boolean))].filter((c) => !generateCss(c, ctx).trim());
const snippet = new Set(CORPORA[2].files.flatMap(([, t, cfg]) => agentNoOps(t.join(' '), createContext(cfg || {}))));
result.snippetCheck = { corpus: CORPORA[2].id, snippetCount: snippet.size, scriptCount: result.corpora[2].unresolved, match: snippet.size === result.corpora[2].unresolved };
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
for (const c of result.corpora) console.log(c.id, `${c.unresolved}/${c.unique}`, c.rate, JSON.stringify(c.models), JSON.stringify(Object.fromEntries(Object.entries(c.categories).map(([k, v]) => [k, v.length]))));
console.log('totals', JSON.stringify(result.categoryTotals));
console.log('parity', JSON.stringify(result.parityCandidates));
console.log('snippet', JSON.stringify(result.snippetCheck));
