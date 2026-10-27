/** #1467 ONE opt-in quantity product source/API/file/cold qualifier. Node22 after GPU build.
 * node examples/gpu-scene/scene-quantity-product-flow.mjs --output ABS_FRESH
 * Complete original source only. No AST input, renderer, CAD unit conversion or GL.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
const parent = '82344b023c9cea3e4857b454170c78682ef047b6', pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = v => createHash('sha256').update(v).digest('hex'), parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const ordinary = resolve(output, 'ordinary-public.mjs'), bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/scene/scene-product-source.ts'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
assert.ok(namespace.includes('compileMultiplicativeAffineSceneSource'));
for (const name of ['compileSceneParameterData', 'finishSceneParameterSource', 'lowerAffineSceneAst']) assert.ok(!namespace.includes(name));

const printer = ts.createPrinter({ removeComments: true });
function shape(text, names) { const file = ts.createSourceFile('types.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return Object.fromEntries(file.statements.filter(n => (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && names.includes(n.name.text)).map(n => [n.name.text, printer.printNode(ts.EmitHint.Unspecified, n, file)])); }
const oldTypes = ['SceneParameterCode', 'SceneParameterDiagnostic', 'SceneParameterDeclaration', 'ParameterizedAffineSceneAst', 'SceneParameter', 'CompiledParameterizedAffineSceneSource'];
const parameterDTS = await readFile(resolve(pkg, 'dist/scene/scene-parameter-source.d.ts'), 'utf8');
const beforeTypes = shape(parentFile('src/scene-parameter-source.ts'), oldTypes); assert.equal(Object.keys(beforeTypes).length, 6); assert.deepEqual(shape(parameterDTS, oldTypes), beforeTypes);
function literalSignature(text) { const file = ts.createSourceFile('literal-signature.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), fn = file.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'compileParameterizedAffineSceneSource');
  assert.ok(fn); return { name: fn.name.text, parameters: fn.parameters.map(p => printer.printNode(ts.EmitHint.Unspecified, p, file)), result: printer.printNode(ts.EmitHint.Unspecified, fn.type, file) }; }
assert.deepEqual(literalSignature(parameterDTS), literalSignature(parentFile('src/scene-parameter-source.ts')));
const indexDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), productDTS = await readFile(resolve(pkg, 'dist/scene/scene-product-source.d.ts'), 'utf8');
const newTypes = ['MultiplicativeAffineSceneAst', 'CompiledMultiplicativeAffineSceneSource'];
for (const name of ['compileMultiplicativeAffineSceneSource', ...newTypes]) { assert.ok(new RegExp('\\b' + name + '\\b').test(indexDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(productDTS)); }
for (const name of ['compileSceneParameterData', 'finishSceneParameterSource']) assert.ok(!new RegExp('\\b' + name + '\\b').test(indexDTS));
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); } if (v === null || typeof v !== 'object') return JSON.stringify(v);
  return Array.isArray(v) ? '[' + v.map(signed).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(x => refs(x, out)); } return out; }
function independent(a, b) { const right = refs(b); for (const ref of refs(a)) assert.ok(!right.has(ref)); }
function keys(v, names) { assert.deepEqual(Object.keys(v).sort(), [...names].sort()); }
function range(source, start, end) { const prefix = source.slice(0, start); return { start, end, line: prefix.split('\n').length, column: start - prefix.lastIndexOf('\n') }; }
function uses(source, name) { const text = '$' + name, result = []; let cursor = 0; for (;;) { const at = source.indexOf(text, cursor); if (at < 0) return result; result.push(range(source, at, at + text.length)); cursor = at + text.length; } }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const original = '/* Original é😀 CRLF and -0 retained. */\r\n@scene products {\r\n version:2; background:#102030;\r\n @param extent:length(2scene);\r\n @param gain:scalar(.5);\r\n @param turn:angle(30deg);\r\n @param shift:length(-2scene);\r\n @param origin:length(-0scene);\r\n sphere #extent; sphere #other;\r\n}\r\nsphere{radius:calc($extent * $gain);scale:calc($gain * $gain) .5 1;rotate-x:calc($turn * $gain);rotate-z:calc($gain * $turn);translate:calc($shift * $gain) calc($gain * $origin) 0;}\r\n#other{translate:calc($gain * $extent) 0 0;}\r\n';
const literal = '@scene products {version:2;background:#102030;sphere #extent;sphere #other;} sphere{radius:1;scale:.25 .5 1;rotate-x:15deg;rotate-z:15deg;translate:-1 0 0;} #other{translate:1 0 0;}';
const edited = original.replace('scalar(.5)', 'scalar(.75)');
const literalEdited = '@scene products {version:2;background:#102030;sphere #extent;sphere #other;} sphere{radius:1.5;scale:.5625 .5 1;rotate-x:22.5deg;rotate-z:22.5deg;translate:-1.5 0 0;} #other{translate:1.5 0 0;}';
const compact = '@scene compact {version:2;@param span-wide:length(2scene);@param gain-half:scalar(.5);sphere #span-wide;} sphere{radius:calc($gain-half*$span-wide);}';
const repeatedAngle = '@scene angle {version:2;@param turn:angle(-30deg);@param gain:scalar(.5);sphere #item;} sphere{rotate-y:calc($turn /* original 😀 annotation */ * $gain);}';
const useHeader = '@scene uses {version:2;@param extent:length(1scene);@param gain:scalar(1);sphere #item;}';
const useRules = Array.from({ length: 128 }, (_, i) => 'sphere{' + (i === 0 ? 'translate:calc($extent * $gain) $extent 0;' : 'translate:$extent $extent $extent;') + 'translate:$extent $extent $extent;'.repeat(3) + '}').join('');
const boundaryUses = useHeader + useRules; assert.equal(uses(boundaryUses, 'extent').length + uses(boundaryUses, 'gain').length, 1536);
const cases = [
  { name: 'main_all_quantity_products', source: original, literal }, { name: 'gain_only_source_edit', source: edited, literal: literalEdited },
  { name: 'compact_hyphen_operand_order', source: compact, literal: '@scene compact {version:2;sphere #span-wide;} sphere{radius:1;}' },
  { name: 'angle_annotation_original_ranges', source: repeatedAngle, literal: '@scene angle {version:2;sphere #item;} sphere{rotate-y:-15deg;}' },
  { name: 'one_product_reference_uses1536', source: boundaryUses, literal: '@scene uses {version:2;sphere #item;} sphere{translate:1 1 1;}' },
];
let accepted = 0, refused = 0, getters = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const c of cases) {
    const result = gpu.compileMultiplicativeAffineSceneSource(c.source), control = gpu.compileAffineSceneSource(c.literal);
    keys(result, ['format', 'version', 'profile', 'source', 'ast', 'parameters', 'scene', 'shaders']); assert.equal(result.format, 'barocss-gpu-multiplicative-affine-scene-source');
    assert.equal(result.version, 0); assert.equal(result.profile, 'source2-typed-product-coefficients-v0'); assert.equal(result.source, c.source);
    keys(result.ast, ['schema', 'schemaVersion', 'sourceVersion', 'source', 'header', 'name', 'range', 'declarations', 'rules']);
    assert.equal(result.ast.schema, 'barocss-gpu-multiplicative-affine-scene-ast'); assert.equal(result.ast.schemaVersion, 0); assert.equal(result.ast.sourceVersion, 2); assert.equal(result.ast.source, c.source);
    assert.deepEqual(result.ast.range, range(c.source, 0, c.source.length)); assert.deepEqual(result.scene, control.scene); assert.deepEqual(result.shaders, control.shaders); frozen(result);
    for (const p of result.parameters) { keys(p, ['name', 'quantity', 'unit', 'value', 'definition', 'uses']); assert.deepEqual(p.uses, uses(c.source, p.name));
      const declaration = result.ast.declarations.find(d => d.kind === 'parameter' && d.name.text === p.name); assert.ok(declaration); assert.deepEqual(p.definition, declaration.range);
      for (const token of [declaration.name, declaration.quantity, declaration.literal]) assert.equal(c.source.slice(token.range.start, token.range.end), token.text); }
    for (const rule of result.ast.rules) for (const field of rule.declarations) for (const token of field.literals) {
      assert.equal(c.source.slice(token.range.start, token.range.end), token.text); assert.deepEqual(token.range, range(c.source, token.range.start, token.range.end));
    }
    if (c.source === original || c.source === edited) {
      assert.deepEqual(result.ast.rules[0].declarations[0].literals.map(t => t.text), ['calc', '(', '$extent', '*', '$gain', ')']);
      assert.deepEqual(result.parameters.map(p => [p.name, p.quantity, p.unit, p.value]), [['extent', 'length', 'scene', 2], ['gain', 'scalar', 'dimensionless', c.source === original ? .5 : .75], ['turn', 'angle', 'deg', 30], ['shift', 'length', 'scene', -2], ['origin', 'length', 'scene', 0]]);
      assert.equal(result.parameters.find(p => p.name === 'gain').uses.length, 8); assert.ok(Object.is(result.parameters.find(p => p.name === 'origin').value, +0));
      assert.equal(result.ast.declarations.find(d => d.kind === 'parameter' && d.name.text === 'origin').literal.text, '-0scene');
    }
    if (c.source === boundaryUses) assert.equal(result.parameters.reduce((sum, p) => sum + p.uses.length, 0), 1536);
    for (const earlier of retained) independent(result, earlier.result);
    const prefix = resolve(output, provider.label + '.' + c.name), sourcePath = prefix + '.source2.css', literalPath = prefix + '.literal.css', resultPath = prefix + '.result.json';
    const files = [await save(sourcePath, c.source), await save(literalPath, c.literal), await save(resultPath, signed(result) + '\n')];
    const record = { provider: provider.label, name: c.name, sourcePath, literalPath, resultPath, digest: hash(signed(result)), files, uses: result.parameters.reduce((sum, p) => sum + p.uses.length, 0) };
    retained.push({ result, digest: record.digest, files }); records.push(record); coldCases.push(record); accepted++;
  }
  const changed = clone(retained[0].result.scene); for (const o of changed.objects) { o.radius = 1.5; o.scaleXYZ = [.5625, .5, 1]; o.rotation = [22.5, 0, 22.5]; }
  changed.objects[0].translate = [-1.5, 0, 0]; changed.objects[1].translate = [1.5, 0, 0]; assert.deepEqual(retained[1].result.scene, changed);
  const old = gpu.compileParameterizedAffineSceneSource(literal), fresh = gpu.compileMultiplicativeAffineSceneSource(literal); assert.deepEqual(fresh.scene, old.scene); assert.deepEqual(fresh.shaders, old.shaders); assert.equal(fresh.parameters.length, 0); accepted++;
  let oldRefusal; try { gpu.compileParameterizedAffineSceneSource(original); } catch (e) { oldRefusal = e; } assert.ok(oldRefusal instanceof gpu.SceneParameterSourceError); assert.equal(oldRefusal.code, 'TYPE');
  const firstCalc = original.indexOf('calc($extent'); assert.equal(oldRefusal.diagnostics[0].start, firstCalc); assert.equal(oldRefusal.diagnostics[0].end, firstCalc + 'calc($extent'.length); refused++;
  const workSource = useHeader + Array.from({ length: 128 }, () => 'sphere{' + 'translate:calc($extent * $gain) $extent 0;'.repeat(4) + '}').join('');
  assert.equal(uses(workSource, 'extent').length + uses(workSource, 'gain').length, 1536); assert.ok(Buffer.byteLength(workSource) < 65536);
  const atomSource = (a, b, field = 'radius') => '@scene bad {version:2;@param extent:length(2scene);@param gain:scalar(.5);@param turn:angle(30deg);sphere #item;} sphere{' + field + ':calc(' + a + ' * ' + b + ');}';
  const checks = [
    { name: 'no_scalar_length_length', source: atomSource('$extent', '$extent'), code: 'TYPE', token: '*' },
    { name: 'no_scalar_length_angle', source: atomSource('$extent', '$turn'), code: 'TYPE', token: '*' },
    { name: 'unknown_operand', source: atomSource('$extent', '$missing'), code: 'TYPE', token: '$missing' },
    { name: 'slot_quantity_mismatch', source: atomSource('$gain', '$gain'), code: 'TYPE', token: 'calc($gain * $gain)' },
    { name: 'literal_operand', source: original.replace('calc($extent * $gain)', 'calc($extent * 2)'), code: 'SYNTAX' },
    { name: 'nested_atom', source: original.replace('calc($extent * $gain)', 'calc(calc($extent * $gain) * $gain)'), code: 'SYNTAX' },
    { name: 'extra_multiplication', source: original.replace('calc($extent * $gain)', 'calc($extent * $gain * $gain)'), code: 'SYNTAX' },
    { name: 'negative_reference_sign', source: original.replace('calc($extent * $gain)', 'calc(-$extent * $gain)'), code: 'SYNTAX' },
    { name: 'length_product_range', source: original.replace('length(2scene)', 'length(1000scene)').replace('scalar(.5)', 'scalar(2)'), code: 'RANGE', token: 'calc($extent * $gain)' },
    { name: 'angle_product_range', source: atomSource('$turn', '$gain', 'rotate-x').replace('angle(30deg)', 'angle(240deg)').replace('scalar(.5)', 'scalar(2)'), code: 'RANGE', token: 'calc($turn * $gain)' },
    { name: 'native_positive_product', source: original.replace('scalar(.5)', 'scalar(-.5)'), code: 'SCENE', token: 'calc($extent * $gain)' },
    { name: 'overridden_bad_product', source: original.replace('radius:calc($extent * $gain);', 'radius:calc($turn * $gain);radius:calc($extent * $gain);'), code: 'TYPE', token: 'calc($turn * $gain)' },
    { name: 'cumulative_original_tokens_product_work', source: workSource, code: 'BUDGET' },
    { name: 'operand_reference_uses1537', source: boundaryUses.replace('calc($extent * $gain) $extent 0;', 'calc($extent * $gain) $extent $extent;'), code: 'BUDGET' },
    { name: 'UTF8_source_budget', source: '/*' + 'é'.repeat(33000) + '*/' + original, code: 'BUDGET' },
  ];
  async function retention() { assert.equal(getters, 0); for (const item of retained) { assert.equal(hash(signed(item.result)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  for (const c of checks) { let error; try { gpu.compileMultiplicativeAffineSceneSource(c.source); } catch (e) { error = e; }
    assert.ok(error instanceof gpu.SceneParameterSourceError, c.name); assert.equal(error.code, c.code, c.name); frozen(error.diagnostics); const d = error.diagnostics[0];
    keys(d, ['code', 'message', 'start', 'end', 'line', 'column']); assert.equal(d.code, error.code); assert.ok(d.message.length <= 1024); assert.deepEqual({ start: d.start, end: d.end, line: d.line, column: d.column }, range(c.source, d.start, d.end));
    if (c.token) { const start = c.source.indexOf(c.token); assert.ok(start >= 0); assert.deepEqual({ start: d.start, end: d.end, line: d.line, column: d.column }, range(c.source, start, start + c.token.length), c.name); }
    if (c.code === 'SCENE') { assert.ok(error.cause instanceof gpu.SceneError); assert.equal(error.cause.diagnostics[0].start, d.start); assert.equal(error.cause.diagnostics[0].end, d.end); }
    const path = resolve(output, provider.label + '.refused.' + c.name + '.css'); failures.push({ name: c.name, code: error.code, diagnostic: d, causeName: error.cause?.name ?? null, file: await save(path, c.source) }); refused++; await retention();
  }
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('no coercion'); } });
  for (const value of [object, clone(retained[0].result.ast), null]) { let error; try { gpu.compileMultiplicativeAffineSceneSource(value); } catch (e) { error = e; }
    assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'INPUT'); assert.equal(error.diagnostics[0].start, 0); refused++; await retention(); }
  rows.push({ provider: provider.label, records, failures, oldLiteralAPIStillRejectsProduct: true });
}
for (let i = 0; i < cases.length; i++) assert.equal(rows[0].records[i].digest, rows[1].records[i].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const c of cfg.cases.filter(c=>c.provider===provider.label)){for(const file of c.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(c.sourcePath,'utf8'),result=gpu.compileMultiplicativeAffineSceneSource(source),control=gpu.compileAffineSceneSource(readFileSync(c.literalPath,'utf8'));assert.equal(result.source,source);assert.equal(hash(signed(result)),c.digest);assert.deepEqual(result,JSON.parse(readFileSync(c.resultPath,'utf8')));assert.deepEqual(result.scene,control.scene);assert.deepEqual(result.shaders,control.shaders);rows.push({provider:provider.label,name:c.name,digest:c.digest,uses:result.parameters.reduce((sum,p)=>sum+p.uses.length,0)});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentASTAuthority:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-original-products.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout);
assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, cases.length * providers.length);
for (const c of coldCases) for (const file of c.files) assert.equal(hash(await readFile(file.path)), file.sha256);
const report = { issue: 1467, stage: 'SCENE2_TYPED_QUANTITY_PRODUCT_SOURCE_CPU', parent, node: process.version, accepted, refused, getters,
  namespaceCount: namespace.length, namespace, sourceGraph, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), rows, cold,
  publicCompatibility: { parentRuntimeCount: 130, runtimeAddition: 'compileMultiplicativeAffineSceneSource', newTypes, oldParameterTypeDeclarationsPreserved: true, oldBarrelPrefixPreserved: true, internalPipelineNotPublic: true, manifestUnchanged: true },
  unforcedNonfiniteProduct: true, actualGL: false, physicalUnitConversion: false,
  support: 'Bounded two-reference scalar/quantity products in complete original Scene2 text, raw calc/operator/ref AST spans and operand metadata, independent literal scene/shaders, dependent source edits, exact refusal/cause/file retention and genuine full-source cold reconstruction. No general arithmetic, functions, generation, CAD units, renderer/pixels or publication.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1467, accepted, refused, getters, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
