/** #1476 ONE bounded repeat source/emitted/file/cold qualifier. Node22 after GPU build.
 * node examples/gpu-scene/scene-finite-repeat-flow.mjs --output ABS_FRESH
 * Authored tokens and generated provenance remain distinct. No renderer or GL claim.
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
const parent = '1b58b3885b2f12acdac294215b1c73a3342212d9', pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = v => createHash('sha256').update(v).digest('hex'), parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const oldBarrel = parentFile('src/index.ts'), oldFile = ts.createSourceFile('parent-barrel.ts', oldBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = oldFile.statements.filter(n => ts.isExportDeclaration(n) && !n.isTypeOnly && n.exportClause && ts.isNamedExports(n.exportClause))
  .flatMap(n => n.exportClause.elements.filter(e => !e.isTypeOnly).map(e => e.name.text)).sort(); assert.equal(new Set(parentRuntime).size, parentRuntime.length); assert.equal(parentRuntime.length, 135);
const ordinary = resolve(output, 'ordinary-public.mjs'), bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/scene/scene-finite-repeat-source.ts'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }]; for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.ok(['compileFiniteRepeatAffineSceneSource'].sort().every(x => namespace.includes(x))); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);


const printer = ts.createPrinter({ removeComments: true });
function types(text, names) { const f = ts.createSourceFile('types.ts', text, ts.ScriptTarget.Latest, true); return Object.fromEntries(f.statements.filter(n => (ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) && names.includes(n.name.text)).map(n => [n.name.text, printer.printNode(ts.EmitHint.Unspecified, n, f)])); }
function signature(text, name) { const f = ts.createSourceFile('signature.ts', text, ts.ScriptTarget.Latest, true), fn = f.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name); assert.ok(fn); return { parameters: fn.parameters.map(n => printer.printNode(ts.EmitHint.Unspecified, n, f)), result: printer.printNode(ts.EmitHint.Unspecified, fn.type, f) }; }
for (const [leaf, names, runtime] of [['scene-parameter-source', ['SceneParameterCode', 'SceneParameterDiagnostic', 'SceneParameterDeclaration', 'ParameterizedAffineSceneAst', 'SceneParameter', 'CompiledParameterizedAffineSceneSource'], 'compileParameterizedAffineSceneSource'], ['scene-product-source', ['MultiplicativeAffineSceneAst', 'CompiledMultiplicativeAffineSceneSource'], 'compileMultiplicativeAffineSceneSource'], ['scene-arithmetic-source', ['ArithmeticAffineSceneAst', 'CompiledArithmeticAffineSceneSource'], 'compileArithmeticAffineSceneSource']]) {
  const before = parentFile('src/' + leaf + '.ts'), after = await readFile(resolve(pkg, 'dist/' + leaf + '.d.ts'), 'utf8'); assert.equal(Object.keys(types(before, names)).length, names.length); assert.deepEqual(types(after, names), types(before, names)); assert.deepEqual(signature(after, runtime), signature(before, runtime)); }
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), repeatDTS = await readFile(resolve(pkg, 'dist/scene-finite-repeat-source.d.ts'), 'utf8'), parameterDTS = await readFile(resolve(pkg, 'dist/scene-parameter-source.d.ts'), 'utf8');
const newTypes = ['SceneRepeatDeclaration', 'SceneGenerationRecord', 'FiniteRepeatAffineSceneAst', 'CompiledFiniteRepeatAffineSceneSource'];
for (const name of newTypes) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(repeatDTS + parameterDTS)); }
for (const name of ['compileSceneParameterData', 'finishSceneParameterSource', 'lowerAffineSceneAst']) { assert.ok(!namespace.includes(name)); assert.ok(!new RegExp('\\b' + name + '\\b').test(publicDTS)); }
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); } if (v === null || typeof v !== 'object') return JSON.stringify(v); return Array.isArray(v) ? '[' + v.map(signed).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(x => refs(x, out)); } return out; }
function independent(a, b) { const right = refs(b); for (const ref of refs(a)) assert.ok(!right.has(ref)); }
function keys(v, names) { assert.deepEqual(Object.keys(v).sort(), [...names].sort()); }
function range(source, start, end) { const p = source.slice(0, start); return { start, end, line: p.split('\n').length, column: start - p.lastIndexOf('\n') }; }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const header = '/* Original finite row é😀 and CRLF retained. */\r\n@scene repeated {\r\n version:2;background:#102030;@param step:length(2scene);@param gain:scalar(.5);\r\n';
const styles = '\r\n}\r\n#studs_1{radius:$step;}\r\nsphere{radius:calc($step * $gain);translate:-0 0 0;}\r\n#studs_0{translate:-2 -0 0;} #studs_2{translate:$step 0 0;}\r\n';
const original = header + ' @repeat studs:sphere(3);' + styles, appended = original.replace('sphere(3)', 'sphere(4)'), reverted = appended.replace('sphere(4)', 'sphere(3)');
const manual3 = header + ' sphere #studs_0;sphere #studs_1;sphere #studs_2;' + styles;
const manual4 = header + ' sphere #studs_0;sphere #studs_1;sphere #studs_2;sphere #studs_3;' + styles;
const interleaved = '@scene order {version:2;sphere #head;@repeat middle:box(2);sphere #tail;@repeat end:sphere(1);}';
const allShapes = '@scene shapes {version:2;' + ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'].map(type => '@repeat ' + type + ':' + type + '(1);').join('') + '}';
const shapesManual = '@scene shapes {version:2;' + ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'].map(type => type + ' #' + type + '_0;').join('') + '}';
const eight = '@scene eight {version:2;' + Array.from({ length: 8 }, (_, i) => '@repeat r' + i + ':sphere(1);').join('') + '}';
const max32 = '@scene maximum {version:2;@repeat row:sphere(32);}';
function workSource(products) { let field = 0; return '@scene work {version:2;@param extent:length(1scene);@param gain:scalar(1);@repeat row:sphere(32);}' + Array.from({ length: 128 }, () => 'sphere{' + Array.from({ length: 4 }, () => field++ < products ? 'translate:calc($extent * $gain) $extent 0;' : 'translate:$extent $extent $extent;').join('') + '}').join(''); }
// Independent frozen accounting: baseline3860 +29*(5 extra authored tokens+3 expression)=4092;30 gives4100.
const work4092 = workSource(29), work4100 = workSource(30); assert.ok(Buffer.byteLength(work4100) < 65536);
const cases = [{ name: 'repeat3_shared_parameters', source: original, manual: manual3 }, { name: 'append_count4', source: appended, manual: manual4 }, { name: 'return_count3', source: reverted, manual: manual3 },
  { name: 'explicit_interleaving', source: interleaved, manual: '@scene order {version:2;sphere #head;box #middle_0;box #middle_1;sphere #tail;sphere #end_0;}' },
  { name: 'all_six_shapes_reserved_prefixes', source: allShapes, manual: shapesManual }, { name: 'maximum_count32', source: max32, manual: '@scene maximum {version:2;' + Array.from({ length: 32 }, (_, i) => 'sphere #row_' + i + ';').join('') + '}' },
  { name: 'eight_repeat_prefixes', source: eight, manual: '@scene eight {version:2;' + Array.from({ length: 8 }, (_, i) => 'sphere #r' + i + '_0;').join('') + '}' },
  { name: 'original_plus_expansion_work4092', source: work4092, manual: '@scene work {version:2;' + Array.from({ length: 32 }, (_, i) => 'sphere #row_' + i + ';').join('') + '}sphere{translate:1 1 1;}' }];
let accepted = 0, refused = 0, getters = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const c of cases) {
    const result = gpu.compileFiniteRepeatAffineSceneSource(c.source), control = gpu.compileArithmeticAffineSceneSource(c.manual);
    keys(result, ['format', 'version', 'profile', 'source', 'ast', 'parameters', 'generation', 'scene', 'shaders']); assert.equal(result.format, 'barocss-gpu-finite-repeat-affine-scene-source'); assert.equal(result.version, 0); assert.equal(result.profile, 'source2-typed-finite-repeat-coefficients-v0'); assert.equal(result.source, c.source);
    keys(result.ast, ['schema', 'schemaVersion', 'sourceVersion', 'source', 'header', 'name', 'range', 'declarations', 'rules']); assert.equal(result.ast.schema, 'barocss-gpu-finite-repeat-affine-scene-ast'); assert.equal(result.ast.schemaVersion, 0); assert.equal(result.ast.sourceVersion, 2); assert.equal(result.ast.source, c.source); assert.deepEqual(result.ast.range, range(c.source, 0, c.source.length));
    assert.deepEqual(result.scene, control.scene); assert.deepEqual(result.shaders, control.shaders); frozen(result);
    const repeats = result.ast.declarations.filter(d => d.kind === 'repeat'), expectedGeneration = [];
    for (const d of repeats) { keys(d, ['kind', 'prefix', 'type', 'count', 'tokens', 'range']); assert.equal(d.tokens.length, 9);
      assert.deepEqual(d.tokens.map(t => t.text), ['@', 'repeat', d.prefix.text, ':', d.type.text, '(', d.count.text, ')', ';']);
      const start = c.source.indexOf('@repeat ' + d.prefix.text + ':'), end = c.source.indexOf(';', start) + 1; assert.deepEqual(d.range, range(c.source, start, end));
      for (const token of d.tokens) { assert.equal(c.source.slice(token.range.start, token.range.end), token.text); assert.deepEqual(token.range, range(c.source, token.range.start, token.range.end)); }
      assert.deepEqual(d.prefix, d.tokens[2]); assert.deepEqual(d.type, d.tokens[4]); assert.deepEqual(d.count, d.tokens[6]);
      for (let index = 0; index < Number(d.count.text); index++) expectedGeneration.push({ nodeId: d.prefix.text + '_' + index, prefix: d.prefix.text, index, declaration: d.range }); }
    assert.deepEqual(result.generation, expectedGeneration); for (const g of result.generation) { keys(g, ['nodeId', 'prefix', 'index', 'declaration']); assert.ok(result.scene.objects.some(o => o.id === g.nodeId)); }
    const explicit = result.ast.declarations.filter(d => d.kind === 'object'); assert.ok(explicit.every(d => c.source.slice(d.id.range.start, d.id.range.end) === d.id.text));
    assert.equal(result.scene.objects.length, explicit.length + result.generation.length);
    if (c.source === original || c.source === appended || c.source === reverted) { assert.equal(explicit.length, 0); assert.deepEqual(result.generation.map(g => g.nodeId), Array.from({ length: c.source === appended ? 4 : 3 }, (_, i) => 'studs_' + i)); assert.equal(result.scene.objects[1].radius, 2); assert.equal(result.scene.objects[0].radius, 1); assert.deepEqual(result.scene.objects[0].translate, [-2, 0, 0]); }
    if (c.source === interleaved) assert.deepEqual(result.scene.objects.map(o => o.id), ['head', 'middle_0', 'middle_1', 'tail', 'end_0']);
    if (c.source === allShapes) assert.deepEqual(result.scene.objects.map(o => o.type), ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus']);
    if (c.source === work4092) { assert.equal(result.parameters.reduce((sum, p) => sum + p.uses.length, 0), 1536); assert.equal(result.scene.objects.length, 32); }
    for (const earlier of retained) independent(result, earlier.result);
    const prefix = resolve(output, provider.label + '.' + c.name), sourcePath = prefix + '.source2.css', manualPath = prefix + '.manual.css', resultPath = prefix + '.result.json';
    const files = [await save(sourcePath, c.source), await save(manualPath, c.manual), await save(resultPath, signed(result) + '\n')], record = { provider: provider.label, name: c.name, sourcePath, manualPath, resultPath, files, digest: hash(signed(result)), generated: result.generation.length, objects: result.scene.objects.length };
    records.push(record); coldCases.push(record); retained.push({ result, digest: record.digest, files }); accepted++;
  }
  assert.deepEqual(retained[1].result.scene.objects.slice(0, 3), retained[0].result.scene.objects); assert.deepEqual(retained[2].result, retained[0].result); assert.notStrictEqual(retained[2].result, retained[0].result);
  for (const name of ['compileParameterizedAffineSceneSource', 'compileMultiplicativeAffineSceneSource', 'compileArithmeticAffineSceneSource']) { let error; try { gpu[name](original); } catch (e) { error = e; } assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'SYNTAX'); const start = original.indexOf('@repeat') + 1; assert.equal(error.diagnostics[0].start, start); assert.equal(error.diagnostics[0].end, start + 6); refused++; }
  const simple = (count = '3', type = 'sphere') => '@scene bad {version:2;@repeat studs:' + type + '(' + count + ');}';
  const checks = [{ name: 'unknown_shape', source: simple('3', 'triangle'), code: 'TYPE' },
    ...['0', '03', '+3', '-1', '3.5', '3e0'].map(count => ({ name: 'count_spelling_' + count.replace(/[^a-zA-Z0-9]/g, '_'), source: simple(count), code: 'SYNTAX' })),
    { name: 'count33', source: simple('33'), code: 'RANGE' }, { name: 'duplicate_prefix', source: '@scene bad {version:2;@repeat studs:sphere(1);@repeat studs:box(1);}', code: 'TYPE' },
    { name: 'generated_explicit_collision', source: '@scene bad {version:2;sphere #studs_1;@repeat studs:sphere(3);}', code: 'TYPE' },
    { name: 'explicit_duplicate_delegated', source: '@scene bad {version:2;sphere #head;sphere #head;@repeat studs:sphere(1);}', code: 'SCENE' },
    { name: 'stale_generated_selector', source: simple() + '#studs_3{radius:1;}', code: 'SCENE' },
    { name: 'parameter_after_repeat', source: '@scene bad {version:2;@repeat studs:sphere(1);@param gain:scalar(1);}', code: 'SYNTAX' },
    { name: 'repeat_in_style', source: '@scene bad {version:2;sphere #item;}sphere{@repeat studs:sphere(1);}', code: 'SCENE' },
    { name: 'ninth_repeat', source: eight.replace('}', '@repeat ninth:sphere(1);}'), code: 'BUDGET' },
    { name: 'expanded_total33', source: max32.replace('@repeat', 'sphere #extra;@repeat'), code: 'BUDGET' },
    { name: 'original_plus_expansion_work4100', source: work4100, code: 'BUDGET' },
    { name: 'source_UTF8_cap', source: '/*' + 'é'.repeat(33000) + '*/' + original, code: 'BUDGET' }];
  async function retention() { assert.equal(getters, 0); for (const item of retained) { assert.equal(hash(signed(item.result)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  for (const c of checks) { let error; try { gpu.compileFiniteRepeatAffineSceneSource(c.source); } catch (e) { error = e; } assert.ok(error instanceof gpu.SceneParameterSourceError, c.name); assert.equal(error.code, c.code, c.name); frozen(error.diagnostics);
    const d = error.diagnostics[0]; keys(d, ['code', 'message', 'start', 'end', 'line', 'column']); assert.ok(d.message.length <= 1024); assert.deepEqual({ start: d.start, end: d.end, line: d.line, column: d.column }, range(c.source, d.start, d.end));
    if (c.code === 'SCENE') assert.ok(error.cause instanceof gpu.SceneError); const path = resolve(output, provider.label + '.refused.' + c.name + '.css'); failures.push({ name: c.name, code: error.code, diagnostic: d, causeName: error.cause?.name ?? null, file: await save(path, c.source) }); refused++; await retention(); }
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('no coercion'); } });
  for (const value of [object, clone(retained[0].result.ast), null]) { let error; try { gpu.compileFiniteRepeatAffineSceneSource(value); } catch (e) { error = e; } assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'INPUT'); refused++; await retention(); }
  rows.push({ provider: provider.label, records, failures, oldProfilesRejectRepeat: true, independentWorkBoundary: { admitted: 4092, refused: 4100, referenceUses: 1536 } });
}
for (let i = 0; i < cases.length; i++) assert.equal(rows[0].records[i].digest, rows[1].records[i].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const c of cfg.cases.filter(c=>c.provider===provider.label)){for(const file of c.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(c.sourcePath,'utf8'),result=gpu.compileFiniteRepeatAffineSceneSource(source),manual=gpu.compileArithmeticAffineSceneSource(readFileSync(c.manualPath,'utf8'));assert.equal(result.source,source);assert.equal(hash(signed(result)),c.digest);assert.deepEqual(result,JSON.parse(readFileSync(c.resultPath,'utf8')));assert.deepEqual(result.scene,manual.scene);assert.deepEqual(result.shaders,manual.shaders);rows.push({provider:provider.label,name:c.name,digest:c.digest,generated:result.generation.length});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentASTAuthority:false,actualGL:false}));`;
const coldPath = resolve(output, 'cold-authored-repeats.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' }); await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, cases.length * providers.length);
const report = { issue: 1476, stage: 'SCENE2_TYPED_FINITE_REPEAT_SOURCE_CPU', parent, node: process.version, accepted, refused, getters, namespaceCount: namespace.length, namespace, parentRuntime, sourceGraph, rows, cold,
  ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), newTypes, oldPublicTypesAndSignaturesPreserved: true, oldManifestAndBarrelPrefixPreserved: true,
  independentBudget: '2version+128rules+512*4fieldnodes+8parameterwork+1536uses+10repeat+32*4generated=3860; each replaced field adds5 authored tokens+3 calc work;29 gives4092,30 gives4100.',
  actualGL: false, physicalUnitConversion: false, consumerPresentation: false, support: 'Finite count/prefix declaration relationship, stable ordered generated Source2 identities and separate original tokens/provenance, manual coefficient/cascade equivalence, counts and work refusal, frozen fresh graphs and original-source cold reconstruction. No index expression/conditions/general loop/CAD/frame/TEN/renderer/pixels/publication.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ issue: 1476, accepted, refused, getters, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
