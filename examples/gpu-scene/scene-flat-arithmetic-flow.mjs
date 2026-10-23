/** #1470 ONE flat typed arithmetic source/API/file/cold qualifier. Node22 after GPU build.
 * node examples/gpu-scene/scene-flat-arithmetic-flow.mjs --output ABS_FRESH
 * No general expression tree, imported AST authority, runtime resources or GL.
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
const parent = 'c052fcd0714a6396e34a49b0328f6446051d9118', pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = v => createHash('sha256').update(v).digest('hex'), parentFile = n => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + n], { cwd: repo, encoding: 'utf8' });
const ordinary = resolve(output, 'ordinary-public.mjs'), bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/scene/scene-arithmetic-source.ts'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.equal(namespace.length, 132); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
assert.equal(namespace.filter(n => n !== 'compileArithmeticAffineSceneSource').length, 131); assert.ok(namespace.includes('compileArithmeticAffineSceneSource'));
for (const name of ['compileSceneParameterData', 'finishSceneParameterSource', 'lowerAffineSceneAst']) assert.ok(!namespace.includes(name));
assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentFile('src/index.ts'))); assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));
assert.equal(await readFile(resolve(pkg, 'src/scene/scene-product-source.ts'), 'utf8'), parentFile('src/scene/scene-product-source.ts'));
const printer = ts.createPrinter({ removeComments: true });
function types(text, names) { const file = ts.createSourceFile('types.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); return Object.fromEntries(file.statements
  .filter(n => (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && names.includes(n.name.text)).map(n => [n.name.text, printer.printNode(ts.EmitHint.Unspecified, n, file)])); }
function signature(text, name) { const file = ts.createSourceFile('signature.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), fn = file.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name); assert.ok(fn);
  return { name, parameters: fn.parameters.map(p => printer.printNode(ts.EmitHint.Unspecified, p, file)), result: printer.printNode(ts.EmitHint.Unspecified, fn.type, file) }; }
for (const [leaf, names, runtime] of [['scene-parameter-source', ['SceneParameterCode', 'SceneParameterDiagnostic', 'SceneParameterDeclaration', 'ParameterizedAffineSceneAst', 'SceneParameter', 'CompiledParameterizedAffineSceneSource'], 'compileParameterizedAffineSceneSource'],
  ['scene-product-source', ['MultiplicativeAffineSceneAst', 'CompiledMultiplicativeAffineSceneSource'], 'compileMultiplicativeAffineSceneSource']]) {
  const before = parentFile('src/' + leaf + '.ts'), after = await readFile(resolve(pkg, 'dist/' + leaf + '.d.ts'), 'utf8'); assert.equal(Object.keys(types(before, names)).length, names.length); assert.deepEqual(types(after, names), types(before, names)); assert.deepEqual(signature(after, runtime), signature(before, runtime));
}
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), arithmeticDTS = await readFile(resolve(pkg, 'dist/scene-arithmetic-source.d.ts'), 'utf8');
const newTypes = ['ArithmeticAffineSceneAst', 'CompiledArithmeticAffineSceneSource'];
for (const name of ['compileArithmeticAffineSceneSource', ...newTypes]) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(arithmeticDTS)); }
for (const name of ['compileSceneParameterData', 'finishSceneParameterSource']) assert.ok(!new RegExp('\\b' + name + '\\b').test(publicDTS));
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); } if (v === null || typeof v !== 'object') return JSON.stringify(v);
  return Array.isArray(v) ? '[' + v.map(signed).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(x => refs(x, out)); } return out; }
function independent(a, b) { const right = refs(b); for (const ref of refs(a)) assert.ok(!right.has(ref)); }
function keys(v, names) { assert.deepEqual(Object.keys(v).sort(), [...names].sort()); }
function range(source, start, end) { const prefix = source.slice(0, start); return { start, end, line: prefix.split('\n').length, column: start - prefix.lastIndexOf('\n') }; }
function uses(source, name) { const text = '$' + name, out = []; let cursor = 0; for (;;) { const at = source.indexOf(text, cursor); if (at < 0) return out; out.push(range(source, at, at + text.length)); cursor = at + text.length; } }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const original = '/* Original é😀 arithmetic / -0 / CRLF. */\r\n@scene arithmetic {\r\n version:2;background:#102030;\r\n @param extent:length(2scene);@param margin:length(1scene);\r\n @param gain:scalar(.5);@param bonus:scalar(.25);\r\n @param turn:angle(30deg);@param correction:angle(10deg);\r\n @param shift:length(-2scene);@param origin:length(-0scene);\r\n sphere #extent;sphere #other;\r\n}\r\nsphere{radius:calc($extent + $margin);translate:calc($extent - $margin) calc($origin + $origin) 0;scale:calc($gain + $bonus) 1 1;rotate-x:calc($turn - $correction);rotate-y:calc($gain * $turn);}\r\n#other{translate:calc($shift + $margin) 0 0;}\r\n';
const literal = '@scene arithmetic {version:2;background:#102030;sphere #extent;sphere #other;} sphere{radius:3;translate:1 0 0;scale:.75 1 1;rotate-x:20deg;rotate-y:15deg;} #other{translate:-1 0 0;}';
const edited = original.replace('margin:length(1scene)', 'margin:length(.5scene)');
const literalEdited = '@scene arithmetic {version:2;background:#102030;sphere #extent;sphere #other;} sphere{radius:2.5;translate:1.5 0 0;scale:.75 1 1;rotate-x:20deg;rotate-y:15deg;} #other{translate:-1.5 0 0;}';
const hyphen = '@scene hyphen {version:2;@param span-wide:length(2scene);@param margin-small:length(.5scene);@param gain:scalar(.5);@param turn:angle(-0deg);sphere #span-wide;} sphere{radius:calc($span-wide/* left 😀 */+/* right */$margin-small);scale:calc($gain + $gain) 1 1;rotate-z:calc($turn + $turn);}';
const compactProduct = '@scene compact {version:2;@param span-wide:length(2scene);@param half-gain:scalar(.5);sphere #item;} sphere{radius:calc($half-gain*$span-wide);}';
const useHeader = '@scene uses {version:2;@param extent:length(1scene);@param zero:length(0scene);sphere #item;}';
const useRules = Array.from({ length: 128 }, (_, i) => 'sphere{' + (i === 0 ? 'translate:calc($extent + $zero) $extent 0;' : 'translate:$extent $extent $extent;') + 'translate:$extent $extent $extent;'.repeat(3) + '}').join('');
const boundaryUses = useHeader + useRules; assert.equal(uses(boundaryUses, 'extent').length + uses(boundaryUses, 'zero').length, 1536);
const cases = [{ name: 'typed_sum_difference_and_product', source: original, literal }, { name: 'margin_only_source_edit', source: edited, literal: literalEdited },
  { name: 'hyphen_comment_separated_operator_and_same_parameter', source: hyphen, literal: '@scene hyphen {version:2;sphere #span-wide;} sphere{radius:2.5;scale:1 1 1;rotate-z:0deg;}' },
  { name: 'compact_product_still_supported', source: compactProduct, literal: '@scene compact {version:2;sphere #item;} sphere{radius:1;}' },
  { name: 'one_sum_reference_uses1536', source: boundaryUses, literal: '@scene uses {version:2;sphere #item;} sphere{translate:1 1 1;}' }];
let accepted = 0, refused = 0, getters = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const c of cases) {
    const result = gpu.compileArithmeticAffineSceneSource(c.source), control = gpu.compileAffineSceneSource(c.literal);
    keys(result, ['format', 'version', 'profile', 'source', 'ast', 'parameters', 'scene', 'shaders']); assert.equal(result.format, 'barocss-gpu-arithmetic-affine-scene-source'); assert.equal(result.version, 0); assert.equal(result.profile, 'source2-typed-flat-arithmetic-coefficients-v0'); assert.equal(result.source, c.source);
    keys(result.ast, ['schema', 'schemaVersion', 'sourceVersion', 'source', 'header', 'name', 'range', 'declarations', 'rules']); assert.equal(result.ast.schema, 'barocss-gpu-arithmetic-affine-scene-ast'); assert.equal(result.ast.schemaVersion, 0); assert.equal(result.ast.sourceVersion, 2); assert.equal(result.ast.source, c.source);
    assert.deepEqual(result.ast.range, range(c.source, 0, c.source.length)); assert.deepEqual(result.scene, control.scene); assert.deepEqual(result.shaders, control.shaders); frozen(result);
    for (const p of result.parameters) { keys(p, ['name', 'quantity', 'unit', 'value', 'definition', 'uses']); assert.deepEqual(p.uses, uses(c.source, p.name));
      const d = result.ast.declarations.find(d => d.kind === 'parameter' && d.name.text === p.name); assert.ok(d); assert.deepEqual(p.definition, d.range); for (const token of [d.name, d.quantity, d.literal]) assert.equal(c.source.slice(token.range.start, token.range.end), token.text); }
    for (const rule of result.ast.rules) for (const field of rule.declarations) for (const token of field.literals) { assert.equal(c.source.slice(token.range.start, token.range.end), token.text); assert.deepEqual(token.range, range(c.source, token.range.start, token.range.end)); }
    if (c.source === original || c.source === edited) { assert.deepEqual(result.ast.rules[0].declarations[0].literals.map(t => t.text), ['calc', '(', '$extent', '+', '$margin', ')']);
      assert.equal(result.parameters.find(p => p.name === 'margin').value, c.source === original ? 1 : .5); assert.ok(Object.is(result.parameters.find(p => p.name === 'origin').value, +0)); assert.equal(result.parameters.find(p => p.name === 'origin').uses.length, 2);
      assert.equal(result.ast.declarations.find(d => d.kind === 'parameter' && d.name.text === 'origin').literal.text, '-0scene'); }
    if (c.source === hyphen) { assert.equal(result.parameters.find(p => p.name === 'gain').uses.length, 2); assert.equal(result.parameters.find(p => p.name === 'turn').uses.length, 2); assert.ok(Object.is(result.parameters.find(p => p.name === 'turn').value, +0)); }
    if (c.source === boundaryUses) assert.equal(result.parameters.reduce((sum, p) => sum + p.uses.length, 0), 1536);
    for (const earlier of retained) independent(result, earlier.result);
    const prefix = resolve(output, provider.label + '.' + c.name), sourcePath = prefix + '.source2.css', literalPath = prefix + '.literal.css', resultPath = prefix + '.result.json';
    const files = [await save(sourcePath, c.source), await save(literalPath, c.literal), await save(resultPath, signed(result) + '\n')];
    const record = { provider: provider.label, name: c.name, sourcePath, literalPath, resultPath, digest: hash(signed(result)), files }; retained.push({ result, digest: record.digest, files }); records.push(record); coldCases.push(record); accepted++;
  }
  const changed = clone(retained[0].result.scene); changed.objects.forEach(o => o.radius = 2.5); changed.objects[0].translate = [1.5, 0, 0]; changed.objects[1].translate = [-1.5, 0, 0]; assert.deepEqual(retained[1].result.scene, changed);
  const oldLiteral = gpu.compileParameterizedAffineSceneSource(literal), oldProduct = gpu.compileMultiplicativeAffineSceneSource(literal), fresh = gpu.compileArithmeticAffineSceneSource(literal); assert.deepEqual(fresh.scene, oldLiteral.scene); assert.deepEqual(fresh.shaders, oldProduct.shaders); accepted++;
  let productRefusal; try { gpu.compileMultiplicativeAffineSceneSource(original); } catch (e) { productRefusal = e; } assert.ok(productRefusal instanceof gpu.SceneParameterSourceError); assert.equal(productRefusal.code, 'SYNTAX'); const plus = original.indexOf(' + ') + 1; assert.equal(productRefusal.diagnostics[0].start, plus); assert.equal(productRefusal.diagnostics[0].end, plus + 1); assert.equal(productRefusal.diagnostics[0].message, 'Product requires calc($NAME * $NAME)'); refused++;
  let literalRefusal; try { gpu.compileParameterizedAffineSceneSource(original); } catch (e) { literalRefusal = e; } assert.ok(literalRefusal instanceof gpu.SceneParameterSourceError); assert.equal(literalRefusal.code, 'TYPE'); const firstCalc = original.indexOf('calc($extent'); assert.equal(literalRefusal.diagnostics[0].start, firstCalc); assert.equal(literalRefusal.diagnostics[0].end, firstCalc + 'calc($extent'.length); refused++;
  const workSource = useHeader + Array.from({ length: 128 }, () => 'sphere{' + 'translate:calc($extent + $zero) $extent 0;'.repeat(4) + '}').join(''); assert.ok(Buffer.byteLength(workSource) < 65536);
  const atom = (left, op, right, field = 'radius') => '@scene bad {version:2;@param extent:length(2scene);@param margin:length(1scene);@param gain:scalar(.5);@param turn:angle(30deg);@param correction:angle(10deg);sphere #item;} sphere{' + field + ':calc(' + left + ' ' + op + ' ' + right + ');}';
  const checks = [
    { name: 'addition_quantity_mismatch', source: atom('$extent', '+', '$gain'), code: 'TYPE', token: '+' },
    { name: 'subtraction_quantity_mismatch', source: atom('$turn', '-', '$extent'), code: 'TYPE', token: '-' },
    { name: 'unknown_operand', source: atom('$extent', '+', '$missing'), code: 'TYPE', token: '$missing' },
    { name: 'slot_quantity_mismatch', source: atom('$gain', '+', '$gain'), code: 'TYPE', token: 'calc($gain + $gain)' },
    { name: 'chained_sum', source: original.replace('calc($extent + $margin)', 'calc($extent + $margin + $margin)'), code: 'SYNTAX' },
    { name: 'nested_sum', source: original.replace('calc($extent + $margin)', 'calc(calc($extent + $margin) + $margin)'), code: 'SYNTAX' },
    { name: 'literal_operand', source: original.replace('calc($extent + $margin)', 'calc($extent + 1)'), code: 'SYNTAX' },
    { name: 'unary_reference', source: original.replace('calc($extent + $margin)', 'calc(-$extent + $margin)'), code: 'SYNTAX' },
    { name: 'compact_addition', source: original.replace('calc($extent + $margin)', 'calc($extent+$margin)'), code: 'SYNTAX' },
    { name: 'compact_subtraction', source: original.replace('calc($extent + $margin)', 'calc($extent-$margin)'), code: 'SYNTAX' },
    { name: 'length_sum_range', source: atom('$extent', '+', '$margin').replace('length(2scene)', 'length(1000scene)'), code: 'RANGE', token: 'calc($extent + $margin)' },
    { name: 'angle_sum_range', source: atom('$turn', '+', '$correction', 'rotate-z').replace('angle(30deg)', 'angle(300deg)').replace('angle(10deg)', 'angle(100deg)'), code: 'RANGE', token: 'calc($turn + $correction)' },
    { name: 'native_positive_difference', source: atom('$margin', '-', '$extent'), code: 'SCENE', token: 'calc($margin - $extent)' },
    { name: 'overridden_wrong_quantity', source: original.replace('radius:calc($extent + $margin);', 'radius:calc($gain + $gain);radius:calc($extent + $margin);'), code: 'TYPE', token: 'calc($gain + $gain)' },
    { name: 'original_six_token_atom_work4096', source: workSource, code: 'BUDGET' },
    { name: 'operand_plain_reference_uses1537', source: boundaryUses.replace('calc($extent + $zero) $extent 0;', 'calc($extent + $zero) $extent $extent;'), code: 'BUDGET' },
    { name: 'source_UTF8_cap', source: '/*' + 'é'.repeat(33000) + '*/' + original, code: 'BUDGET' },
  ];
  async function retention() { assert.equal(getters, 0); for (const item of retained) { assert.equal(hash(signed(item.result)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  for (const c of checks) { let error; try { gpu.compileArithmeticAffineSceneSource(c.source); } catch (e) { error = e; } assert.ok(error instanceof gpu.SceneParameterSourceError, c.name); assert.equal(error.code, c.code, c.name); frozen(error.diagnostics);
    const d = error.diagnostics[0]; keys(d, ['code', 'message', 'start', 'end', 'line', 'column']); assert.equal(d.code, error.code); assert.ok(d.message.length <= 1024); assert.deepEqual({ start: d.start, end: d.end, line: d.line, column: d.column }, range(c.source, d.start, d.end));
    if (c.token) { const start = c.source.indexOf(c.token); assert.ok(start >= 0); assert.deepEqual({ start: d.start, end: d.end, line: d.line, column: d.column }, range(c.source, start, start + c.token.length), c.name); }
    if (c.code === 'SCENE') { assert.ok(error.cause instanceof gpu.SceneError); assert.equal(error.cause.diagnostics[0].start, d.start); assert.equal(error.cause.diagnostics[0].end, d.end); }
    const path = resolve(output, provider.label + '.refused.' + c.name + '.css'); failures.push({ name: c.name, diagnostic: d, causeName: error.cause?.name ?? null, file: await save(path, c.source) }); refused++; await retention();
  }
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('no coercion'); } });
  for (const value of [object, clone(retained[0].result.ast), null]) { let error; try { gpu.compileArithmeticAffineSceneSource(value); } catch (e) { error = e; } assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'INPUT'); assert.equal(error.diagnostics[0].start, 0); refused++; await retention(); }
  rows.push({ provider: provider.label, records, failures, oldLiteralAndProductProfilesPreserved: true });
}
for (let i = 0; i < cases.length; i++) assert.equal(rows[0].records[i].digest, rows[1].records[i].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const c of cfg.cases.filter(c=>c.provider===provider.label)){for(const file of c.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(c.sourcePath,'utf8'),result=gpu.compileArithmeticAffineSceneSource(source),control=gpu.compileAffineSceneSource(readFileSync(c.literalPath,'utf8'));assert.equal(result.source,source);assert.equal(hash(signed(result)),c.digest);assert.deepEqual(result,JSON.parse(readFileSync(c.resultPath,'utf8')));assert.deepEqual(result.scene,control.scene);assert.deepEqual(result.shaders,control.shaders);rows.push({provider:provider.label,name:c.name,digest:c.digest});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentASTAuthority:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-original-flat-arithmetic.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, cases.length * providers.length);
for (const c of coldCases) for (const file of c.files) assert.equal(hash(await readFile(file.path)), file.sha256);
const report = { issue: 1470, stage: 'SCENE2_TYPED_FLAT_ARITHMETIC_SOURCE_CPU', parent, node: process.version, accepted, refused, getters, namespaceCount: namespace.length, namespace, sourceGraph, rows, cold,
  ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), publicCompatibility: { oldRuntimeCount: 131, runtimeAddition: 'compileArithmeticAffineSceneSource', newTypes, oldLiteralAndProductPublicTypesAndSignaturesPreserved: true, productWrapperSourceUnchanged: true, oldBarrelPrefixPreserved: true, internalPipelineNotPublic: true, manifestUnchanged: true },
  actualGL: false, physicalUnitConversion: false, support: 'Exactly two original typed references and one same-quantity sum/difference or scalar quantity product; six authored token spans/metadata versus independent literal Scene2/shaders, dependent source edits, exact refusal/cause/files and genuine cold whole-source reconstruction. No general calculations, functions/generation/CAD units/editor/frame/pixels/publication.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1470, accepted, refused, getters, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
