// R7.1: the public API inventory of @barocss/cad (its index), @barocss/cad-model (every module: it is imported by path)
// and @barocss/gpu (its entries), read with the TypeScript compiler API. For each export: its module, name and kind; a
// function's parameters, what its first one is (a document or JSON value, a class instance, …) and how it fails (it
// throws an Error subclass, returns a bracketed [CODE] string, or returns a typed result); a class's base (an Error
// subclass, or stateful) and public methods; an interface or type carrying methods (a result with methods). Writes
// api-inventory.json and api-inventory.md to the folder given (default: the system's temporary folder). An analysis
// for R7.2's conventions: not committed output, not part of check-docs. How a function fails is read from its own body
// only (a helper's throw is not followed), so it is a lower bound.
//   node scripts/api-inventory.mjs [out-folder]
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../../..');
const ts = createRequire(join(repo, 'package.json'))('typescript');
const out = resolve(process.argv[2] ?? join(tmpdir(), 'barocss-api-inventory'));

const tsFiles = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? tsFiles(p) : /\.ts$/.test(n) && !/\.d\.ts$/.test(n) ? [p] : []; });
const PACKAGES = [
  { name: '@barocss/cad', root: 'packages/barocss-cad/src', entries: ['index.ts', 'api/index.ts'] },
  { name: '@barocss/cad-model', root: 'packages/barocss-cad-model/src', entries: null },
  { name: '@barocss/gpu', root: 'packages/barocss-gpu/src', entries: ['index.ts', 'viewer/index.ts', 'api/index.ts'] },
];
for (const p of PACKAGES) p.files = (p.entries ?? tsFiles(join(repo, p.root)).map(f => relative(join(repo, p.root), f)).sort()).map(e => join(repo, p.root, e));

const program = ts.createProgram(PACKAGES.flatMap(p => p.files), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, resolveJsonModule: true,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [],
});
const checker = program.getTypeChecker();

// ——— reading one export
const short = (s, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const typeText = t => short(checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType).replace(/import\("[^"]*"\)\./g, ''));
const isErrorClass = type => { for (let t = type, k = 0; t && k < 12; k++) { if (t.symbol?.name === 'Error') return true; const b = checker.getBaseTypes(t); t = b?.[0]; } return false; };
const declOf = sym => sym.declarations?.[0];
/** Whether a declaration is in one of the packages' own sources (not TypeScript's lib: a string union's or a tuple's methods). */
const ownSource = d => !d.getSourceFile().isDeclarationFile && d.getSourceFile().fileName.startsWith(join(repo, 'packages'));
/** A type's members you call: declared methods (`massProperties(…)`) apart from function-valued properties (callbacks, `onX: () => …`). */
function callables(type) {
  const methods = [], callbacks = [];
  for (const p of checker.getPropertiesOfType(type)) {
    const d = declOf(p); if (!d || !ownSource(d)) continue;
    if (ts.isMethodSignature(d) || ts.isMethodDeclaration(d)) methods.push(p.name);
    else if (checker.getTypeOfSymbolAtLocation(p, d).getCallSignatures().length) callbacks.push(p.name);
  }
  return { methods, callbacks };
}
const callableProps = type => { const c = callables(type); return [...c.methods, ...c.callbacks]; };
/** What a parameter's type is: a class instance, a document or JSON value (an object type with no methods), a function, an array, a primitive, or other. */
function paramClass(type) {
  if (type.getCallSignatures().length) return 'function';
  if (checker.isArrayType?.(type) || checker.isTupleType?.(type)) return 'array';
  if (type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike)) return 'primitive';
  const target = type.isUnion() ? type.types.find(t => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))) ?? type : type;
  const d = target.symbol && declOf(target.symbol);
  if (d && ts.isClassDeclaration(d)) return 'class instance';
  if (target.flags & ts.TypeFlags.Object) return callableProps(target).length ? 'object with methods' : 'document/JSON';
  return 'other';
}
/** How a function fails, from its own body: thrown Error classes, bracketed [CODE] strings, or a typed result in its return type. */
function failure(node, returnType) {
  const text = node.getText(), out = [];
  const thrown = [...new Set([...text.matchAll(/throw new ([A-Z][A-Za-z0-9]*)/g)].map(m => m[1]))];
  if (thrown.length) out.push(`throws ${thrown.join(', ')}`);
  const codes = [...new Set([...text.matchAll(/[`'"]\[([A-Z][A-Z0-9_]{3,})\]/g)].map(m => m[1]))];
  const rt = typeText(returnType);
  if (codes.length && /string/.test(rt)) out.push(`returns [CODE] string (${codes.slice(0, 4).join(', ')}${codes.length > 4 ? ', …' : ''})`);
  else if (codes.length) out.push(`[CODE] in its messages (${codes.slice(0, 4).join(', ')}${codes.length > 4 ? ', …' : ''})`);
  if (/\berror\b\??:|\bok: (true|false)|\bisError\b|\bproblems?\b\??:/.test(rt)) out.push('typed result');
  return out.length ? out : ['none seen'];
}
function functionEntry(name, sym, decl, sigNode) {
  const type = checker.getTypeOfSymbolAtLocation(sym, decl), sig = type.getCallSignatures()[0];
  if (!sig) return null;
  const params = sig.getParameters().map(p => { const t = checker.getTypeOfSymbolAtLocation(p, sigNode ?? decl); return { name: p.name, type: typeText(t), class: paramClass(t) }; });
  const ret = sig.getReturnType();
  return { kind: 'function', params, firstParam: params[0]?.class ?? 'none', returns: typeText(ret), fails: failure(sigNode ?? decl, ret) };
}
function entryOf(name, exported) {
  const sym = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported, decl = declOf(sym);
  if (!decl) return { kind: 'unknown' };
  if (ts.isFunctionDeclaration(decl)) return functionEntry(name, sym, decl, decl) ?? { kind: 'function' };
  if (ts.isClassDeclaration(decl)) {
    const type = checker.getDeclaredTypeOfSymbol(sym), error = isErrorClass(type);
    const methods = decl.members.filter(m => (ts.isMethodDeclaration(m) || ts.isGetAccessor(m)) && !(ts.getCombinedModifierFlags(m) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) && m.name && !m.name.getText().startsWith('#')).map(m => m.name.getText());
    const fields = decl.members.filter(m => ts.isPropertyDeclaration(m) && !(ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Readonly)).length;
    return { kind: 'class', error, stateful: !error && (fields > 0 || methods.length > 0), methods };
  }
  if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)) {
    const type = checker.getDeclaredTypeOfSymbol(sym), parts = (type.isUnion() ? type.types : [type]).map(callables);
    const methods = [...new Set(parts.flatMap(c => c.methods))], callbacks = [...new Set(parts.flatMap(c => c.callbacks))];
    return { kind: ts.isInterfaceDeclaration(decl) ? 'interface' : 'type', ...(methods.length ? { resultWithMethods: methods } : {}), ...(callbacks.length ? { callbacks } : {}) };
  }
  if (ts.isEnumDeclaration(decl)) return { kind: 'enum' };
  if (ts.isVariableDeclaration(decl)) {
    const init = decl.initializer;
    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) return { ...(functionEntry(name, sym, decl, init) ?? { kind: 'function' }), const: true };
    return { kind: 'const', type: typeText(checker.getTypeOfSymbolAtLocation(sym, decl)) };
  }
  if (ts.isModuleDeclaration(decl) || ts.isSourceFile(decl)) return { kind: 'namespace' };
  return { kind: ts.SyntaxKind[decl.kind] };
}

// ——— the inventory
const inventory = [], byDeclaration = new Map();
for (const p of PACKAGES) for (const file of p.files) {
  const sf = program.getSourceFile(file), msym = sf && checker.getSymbolAtLocation(sf);
  if (!msym) continue;
  const module = p.entries ? (file.endsWith('index.ts') && relative(join(repo, p.root), file) === 'index.ts' ? p.name : `${p.name}/${relative(join(repo, p.root), file).replace(/\/index\.ts$|\.ts$/g, '')}`) : `${p.name}/${relative(join(repo, p.root), file).replace(/\.ts$/, '')}`;
  for (const e of checker.getExportsOfModule(msym)) {
    if (e.name === 'default' && !declOf(e)) continue;
    // (One entry a declaration: a re-export, from another entry or module of the package, adds its module to `alsoFrom`.)
    const target = e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e, d = declOf(target);
    const key = d ? `${p.name}|${d.getSourceFile().fileName}|${d.pos}|${e.name}` : `${p.name}|${module}|${e.name}`;
    const seen = byDeclaration.get(key);
    if (seen) { (seen.alsoFrom ??= []).push(module); continue; }
    const entry = { package: p.name, module, name: e.name, ...entryOf(e.name, e) };
    byDeclaration.set(key, entry); inventory.push(entry);
  }
}

// ——— the summaries
const VERBS = new Set(('accept add admit align analyse analyze apply approve assemble attach auto bind blend bridge build bundle '
  + 'cancel cap capture carry cast change check chain choose clamp classify clear clip close collect combine commit compare compile '
  + 'compose compute confirm connect convert copy count create crease cut decide decimate decode deduce define delete derive describe '
  + 'detect diagnose diff dispatch distribute draw drop edit emit encode ensure erode estimate evaluate expand explode export extend '
  + 'extract extrude fill filter find finish fit fix flatten flip fold format generate get grow guess hash hatch hide hollow import infer '
  + 'insert inset inspect instantiate integrate intersect invert is join keep label lay layout lift list load locate lookup lower make '
  + 'map mark match measure merge mesh mirror mix move name nest normalize offset open orient pack pad parse patch pick pin place plan '
  + 'plot pose prepare preview probe project propose prune push put query read rebase rebuild receive reconcile record reduce refine '
  + 'refuse register reject relax remap remove rename render reorder repair replace replay report resample reset resolve restore '
  + 'reverse revolve rotate round run sample save scale scan score section seed select send separate serialize serve set sew shell '
  + 'show shrink simplify size sketch slice snap solve sort split stamp start step stitch store strip subdivide subtract suggest '
  + 'summarize sweep take tessellate test thicken thread tick to toggle trace track transform translate traverse trim triangulate turn '
  + 'type undo union unique unwrap update upgrade use validate verify visit walk weld with wrap write').split(' '));
const firstWord = name => (/^[a-z]+/.exec(name) ?? [''])[0];
const patternOf = name => /Of$/.test(name) ? '…Of (a noun of its argument)' : /Problem$/.test(name) ? '…Problem (a validator returning a reason or null)' : /^(is|has|can|should)[A-Z]/.test(name) ? 'predicate' : 'noun';
const CONCEPTS = { mass: /mass|inertia/i, bounds: /bounds|bbox|box(?!ed)|extent/i, export: /^export|Export|write[A-Z]|encode/, evaluate: /^evaluate|Evaluat/, tessellate: /tessellat|mesh(?!Clearance)/i, revision: /revision|digest|sha256|hash/i, step: /step(?![a-z])|Step[A-Z]?/, stl: /stl/i, dxf: /dxf/i, validate: /^validate|Problem$|^check[A-Z]/, refusal: /Error$|refus/i };

const byPackage = {};
for (const p of PACKAGES) {
  const rows = inventory.filter(e => e.package === p.name), kinds = {};
  for (const r of rows) { const k = r.kind === 'function' && r.const ? 'function (const)' : r.kind; kinds[k] = (kinds[k] ?? 0) + 1; }
  byPackage[p.name] = {
    modules: new Set(rows.map(r => r.module)).size, exports: rows.length, kinds,
    resultsWithMethods: rows.filter(r => r.resultWithMethods).map(r => ({ module: r.module, name: r.name, methods: r.resultWithMethods })),
    withCallbacks: rows.filter(r => r.callbacks && !r.resultWithMethods).map(r => ({ module: r.module, name: r.name, callbacks: r.callbacks })),
    errorClasses: rows.filter(r => r.kind === 'class' && r.error).map(r => ({ module: r.module, name: r.name })),
    statefulClasses: rows.filter(r => r.kind === 'class' && r.stateful).map(r => ({ module: r.module, name: r.name, methods: r.methods })),
    notVerbFirst: rows.filter(r => r.kind === 'function' && !VERBS.has(firstWord(r.name))).map(r => ({ module: r.module, name: r.name, pattern: patternOf(r.name) })),
    firstParam: rows.filter(r => r.kind === 'function').reduce((m, r) => ({ ...m, [r.firstParam]: (m[r.firstParam] ?? 0) + 1 }), {}),
    fails: rows.filter(r => r.kind === 'function').reduce((m, r) => { for (const f of r.fails) { const k = f.replace(/ \(.*$/, '').replace(/^throws .*/, 'throws'); m[k] = (m[k] ?? 0) + 1; } return m; }, {}),
  };
}
const concepts = Object.fromEntries(Object.entries(CONCEPTS).map(([c, re]) => {
  const hits = inventory.filter(e => re.test(e.name) && (e.kind === 'function' || e.kind === 'class' || e.resultWithMethods));
  const pkgs = new Set(hits.map(h => h.package));
  return [c, { packages: [...pkgs], exports: hits.map(h => ({ package: h.package, module: h.module, name: h.name, kind: h.kind, ...(h.params ? { signature: `(${h.params.map(p => `${p.name}: ${p.class}`).join(', ')}) → ${short(h.returns, 80)}` } : {}), ...(h.resultWithMethods ? { methods: h.resultWithMethods } : {}) })) }];
}).filter(([, v]) => v.packages.length > 1));

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'api-inventory.json'), JSON.stringify({ generated: new Date().toISOString(), packages: byPackage, concepts, inventory }, null, 1) + '\n');

// ——— the Markdown report
const md = ['# Public API inventory (R7.1)', '', 'Generated by `apps/library-docs/scripts/api-inventory.mjs` with the TypeScript compiler API. How a function fails is read from its own body only, so throws through a helper are not counted.', ''];
md.push('## Per package', '', '| Package | Modules | Exports | function | function (const) | class | interface | type | const | other |', '|---|---|---|---|---|---|---|---|---|---|');
for (const [n, s] of Object.entries(byPackage)) { const k = s.kinds, other = Object.entries(k).filter(([x]) => !['function', 'function (const)', 'class', 'interface', 'type', 'const'].includes(x)).reduce((a, [, v]) => a + v, 0); md.push(`| ${n} | ${s.modules} | ${s.exports} | ${k.function ?? 0} | ${k['function (const)'] ?? 0} | ${k.class ?? 0} | ${k.interface ?? 0} | ${k.type ?? 0} | ${k.const ?? 0} | ${other} |`); }
md.push('', '### What a function takes first, and how it fails', '', '| Package | First parameter | How it fails |', '|---|---|---|');
for (const [n, s] of Object.entries(byPackage)) md.push(`| ${n} | ${Object.entries(s.firstParam).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')} | ${Object.entries(s.fails).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')} |`);
for (const [n, s] of Object.entries(byPackage)) {
  md.push('', `## ${n}`, '', `### Results with methods (${s.resultsWithMethods.length})`, '');
  for (const r of s.resultsWithMethods) md.push(`- \`${r.name}\` (${r.module}): ${r.methods.map(m => `\`${m}\``).join(', ')}`);
  md.push('', `### Types with callback properties, not methods (${s.withCallbacks.length})`, '', s.withCallbacks.slice(0, 40).map(r => `\`${r.name}\``).join(', ') + (s.withCallbacks.length > 40 ? `, … ${s.withCallbacks.length - 40} more` : '') || '—');
  md.push('', `### Error classes (${s.errorClasses.length})`, '', s.errorClasses.map(r => `\`${r.name}\``).join(', ') || '—');
  md.push('', `### Stateful classes (${s.statefulClasses.length})`, '');
  for (const r of s.statefulClasses) md.push(`- \`${r.name}\` (${r.module}): ${r.methods.slice(0, 12).map(m => `\`${m}\``).join(', ')}${r.methods.length > 12 ? ', …' : ''}`);
  const groups = {};
  for (const r of s.notVerbFirst) (groups[r.pattern] ??= []).push(r);
  md.push('', `### Functions not verb-first (${s.notVerbFirst.length})`, '');
  for (const [pattern, rows] of Object.entries(groups)) md.push(`- **${pattern}** (${rows.length}): ${rows.slice(0, 40).map(r => `\`${r.name}\``).join(', ')}${rows.length > 40 ? `, … ${rows.length - 40} more` : ''}`);
}
md.push('', '## Concepts across packages', '');
for (const [c, v] of Object.entries(concepts)) {
  md.push(`### ${c} (${v.packages.join(', ')})`, '');
  for (const e of v.exports.slice(0, 30)) md.push(`- \`${e.name}\` (${e.module}, ${e.kind})${e.signature ? `: \`${e.signature}\`` : ''}${e.methods ? `: methods ${e.methods.join(', ')}` : ''}`);
  if (v.exports.length > 30) md.push(`- … ${v.exports.length - 30} more`);
  md.push('');
}
writeFileSync(join(out, 'api-inventory.md'), md.join('\n') + '\n');
console.log(JSON.stringify({ out, packages: Object.fromEntries(Object.entries(byPackage).map(([n, s]) => [n, { exports: s.exports, kinds: s.kinds }])) }));
