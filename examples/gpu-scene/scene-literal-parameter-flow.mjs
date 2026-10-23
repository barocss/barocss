/** #1462 ONE complete authored Scene2 parameter/source/file/cold qualifier.
 * Node22 after GPU build: node examples/gpu-scene/scene-literal-parameter-flow.mjs --output ABS_FRESH
 * No imported AST authority, renderer, GL, CAD unit conversion or publication claim.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.equal(process.argv.length, 4);
assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
const parent = '8c451be321d5a4da6fd1adf853f89b78d9fb6351', pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = v => createHash('sha256').update(v).digest('hex'), parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const ordinary = resolve(output, 'ordinary-public.mjs'), built = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(built.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/scene/scene-parameter-source.ts')));
assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
const additions = ['compileParameterizedAffineSceneSource', 'SceneParameterSourceError'];
 assert.ok(additions.every(name => namespace.includes(name)));
assert.ok(!namespace.includes('lowerAffineSceneAst'));

// Exact unchanged old leaf source types, plus declaration-shape preservation of the affine public types.

const printer = ts.createPrinter({ removeComments: true });
function declarationShape(text, names) { const file = ts.createSourceFile('public-types.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return Object.fromEntries(file.statements.filter(node => (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && names.includes(node.name.text))
    .map(node => [node.name.text, printer.printNode(ts.EmitHint.Unspecified, node, file)])); }
for (const [leaf, names] of [['scene-front', ['SourceRange', 'SceneToken', 'SceneAst', 'AffineSceneAst']],
  ['affine-scene-source', ['AffineSceneObject2', 'AffineScene2', 'CompiledAffineSceneSource']]]) {
  const before = declarationShape(parentFile('src/' + leaf + '.ts'), names), after = declarationShape(await readFile(resolve(pkg, 'dist/' + leaf + '.d.ts'), 'utf8'), names);
  assert.equal(Object.keys(before).length, names.length); assert.deepEqual(after, before);
}
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), parameterDTS = await readFile(resolve(pkg, 'dist/scene-parameter-source.d.ts'), 'utf8');
const sixTypes = ['SceneParameterCode', 'SceneParameterDiagnostic', 'SceneParameterDeclaration', 'ParameterizedAffineSceneAst', 'SceneParameter', 'CompiledParameterizedAffineSceneSource'];
for (const name of [...additions, ...sixTypes]) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(parameterDTS)); }
assert.ok(!/\blowerAffineSceneAst\b/.test(publicDTS));
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); } if (v === null || typeof v !== 'object') return JSON.stringify(v);
  return Array.isArray(v) ? '[' + v.map(signed).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(x => refs(x, out)); } return out; }
function independent(a, b) { const right = refs(b); for (const ref of refs(a)) assert.ok(!right.has(ref)); }
function keys(v, names) { assert.deepEqual(Object.keys(v).sort(), [...names].sort()); }
function range(source, start, end) { const before = source.slice(0, start), lastLF = before.lastIndexOf('\n'); return { start, end, line: before.split('\n').length, column: start - lastLF }; }
function occurrences(source, text) { const result = []; let cursor = 0; for (;;) { const at = source.indexOf(text, cursor); if (at < 0) return result; result.push(range(source, at, at + text.length)); cursor = at + text.length; } }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const original = '/* Original é😀 / -0 / CRLF retained. */\r\n@scene parameters {\r\n version:2; background:#102030;\r\n @param extent:length(2scene);\r\n @param zoom:scalar(.5);\r\n @param turn:angle(30deg);\r\n sphere #extent; sphere #other;\r\n}\r\nsphere { radius:$extent; scale:$zoom $zoom $zoom; rotate-z:$turn; translate:-0 0 0; }\r\n#other { translate:6 0 0; }\r\n';
const literal = '/* Independent original literal control. */\r\n@scene parameters { version:2; background:#102030; sphere #extent; sphere #other; }\r\nsphere { radius:2; scale:.5 .5 .5; rotate-z:30deg; translate:-0 0 0; }\r\n#other { translate:6 0 0; }\r\n';
const edited = original.replace('length(2scene)', 'length(3scene)'), literalEdited = literal.replace('radius:2;', 'radius:3;');
const zeroNegative = '@scene signed { version:2; @param shift:length(-2scene); @param origin:length(-0scene); sphere #shift; } sphere { translate:$shift $origin 0; radius:1; }';
const unused16 = '@scene unused { version:2; ' + Array.from({ length: 16 }, (_, i) => '@param p' + i + ':scalar(' + i + ');').join(' ') + ' sphere #item; }';
const name32 = 'n'.repeat(32), named32 = '@scene named { version:2; @param ' + name32 + ':length(1scene); sphere #item; } sphere {radius:$' + name32 + ';}';
const hyphenName = '@scene hyphen {version:2;@param span-wide:length(2scene);sphere #span-wide;} sphere{radius:$span-wide;}';
const thirtyTwo = '@scene limit { version:2; @param extent:length(1scene); ' + Array.from({ length: 32 }, (_, i) => 'sphere #item' + i + ';').join(' ') + ' } sphere {radius:$extent;}';
// One bounded six-object control exercises the new quantity reference slots, not old geometry campaigns.
const allSlots = '@scene slots {version:2;@param extent:length(2scene);@param minor:length(.25scene);@param shift:length(-1scene);@param zoom:scalar(.5);@param turn:angle(30deg);sphere #orb;box #brick;cylinder #column;capsule #link;rounded-box #rounded;torus #ring;} sphere{radius:$extent;translate:$shift 0 0;rotate-x:$turn;rotate-y:$turn;rotate-z:$turn;scale:$zoom $zoom $zoom;} box{size:$extent $extent $extent;} cylinder{height:$extent;radius:$minor;} capsule{start:$shift 0 0;end:$extent 0 0;radius:$minor;} rounded-box{size:$extent $extent $extent;radius:$minor;} torus{major-radius:$extent;minor-radius:$minor;}';
const allSlotsLiteral = '@scene slots {version:2;sphere #orb;box #brick;cylinder #column;capsule #link;rounded-box #rounded;torus #ring;} sphere{radius:2;translate:-1 0 0;rotate-x:30deg;rotate-y:30deg;rotate-z:30deg;scale:.5 .5 .5;} box{size:2 2 2;} cylinder{height:2;radius:.25;} capsule{start:-1 0 0;end:2 0 0;radius:.25;} rounded-box{size:2 2 2;radius:.25;} torus{major-radius:2;minor-radius:.25;}';
const cases = [{ name: 'original_three_quantities', source: original, control: literal }, { name: 'shared_extent_source_edit', source: edited, control: literalEdited },
  { name: 'negative_length_and_original_zero', source: zeroNegative, control: '@scene signed {version:2;sphere #shift;} sphere {translate:-2 0 0;radius:1;}' },
  { name: 'sixteen_unused_declarations', source: unused16 }, { name: 'name32', source: named32 }, { name: 'objects32', source: thirtyTwo },
  { name: 'hyphen_name_distinct_object_namespace', source: hyphenName, control: '@scene hyphen {version:2;sphere #span-wide;} sphere{radius:2;}' },
  { name: 'quantity_reference_property_slots', source: allSlots, control: allSlotsLiteral }];
let accepted = 0, refused = 0, getters = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const c of cases) {
    const result = gpu.compileParameterizedAffineSceneSource(c.source); keys(result, ['format', 'version', 'profile', 'source', 'ast', 'parameters', 'scene', 'shaders']);
    assert.equal(result.format, 'barocss-gpu-parameterized-affine-scene-source'); assert.equal(result.version, 0); assert.equal(result.profile, 'source2-typed-literal-parameters-v0'); assert.equal(result.source, c.source);
    keys(result.ast, ['schema', 'schemaVersion', 'sourceVersion', 'source', 'header', 'name', 'range', 'declarations', 'rules']);
    assert.equal(result.ast.schema, 'barocss-gpu-parameterized-affine-scene-ast'); assert.equal(result.ast.schemaVersion, 0); assert.equal(result.ast.sourceVersion, 2); assert.equal(result.ast.source, c.source);
    assert.deepEqual(result.ast.range, range(c.source, 0, c.source.length)); frozen(result);
    if (c.control) { const existing = gpu.compileAffineSceneSource(c.control); assert.deepEqual(result.scene, existing.scene); assert.deepEqual(result.shaders, existing.shaders); }
    for (const parameter of result.parameters) { keys(parameter, ['name', 'quantity', 'unit', 'value', 'definition', 'uses']); const declarations = result.ast.declarations.filter(d => d.kind === 'parameter' && d.name.text === parameter.name); assert.equal(declarations.length, 1);
      const d = declarations[0]; keys(d, ['kind', 'name', 'quantity', 'literal', 'range']); assert.equal(parameter.quantity, d.quantity.text); assert.deepEqual(parameter.definition, d.range);
      const start = c.source.indexOf('@param ' + parameter.name + ':'), end = c.source.indexOf(';', start) + 1; assert.deepEqual(d.range, range(c.source, start, end));
      assert.equal(c.source.slice(d.name.range.start, d.name.range.end), d.name.text); assert.equal(c.source.slice(d.quantity.range.start, d.quantity.range.end), d.quantity.text);
      assert.equal(c.source.slice(d.literal.range.start, d.literal.range.end), d.literal.text); assert.deepEqual(parameter.uses, occurrences(c.source, '$' + parameter.name)); }
    if (c.source === original || c.source === edited) {
      assert.deepEqual(result.parameters.map(p => [p.name, p.quantity, p.unit, p.value, p.uses.length]), [['extent', 'length', 'scene', c.source === original ? 2 : 3, 1], ['zoom', 'scalar', 'dimensionless', .5, 3], ['turn', 'angle', 'deg', 30, 1]]);
      assert.deepEqual(result.ast.rules[0].declarations[0].literals.map(t => t.text), ['$extent']); assert.deepEqual(result.ast.rules[0].declarations[1].literals.map(t => t.text), ['$zoom', '$zoom', '$zoom']);
      assert.deepEqual(result.scene.objects.map(o => [o.id, o.radius, o.scaleXYZ, o.rotateDegrees]), [['extent', c.source === original ? 2 : 3, [.5, .5, .5], [0, 0, 30]], ['other', c.source === original ? 2 : 3, [.5, .5, .5], [0, 0, 30]]]);
    }
    if (c.source === zeroNegative) { assert.equal(result.parameters[0].value, -2); assert.ok(Object.is(result.parameters[1].value, +0)); assert.equal(result.ast.declarations.find(d => d.kind === 'parameter' && d.name.text === 'origin').literal.text, '-0scene'); assert.deepEqual(result.scene.objects[0].translate, [-2, 0, 0]); }
    if (c.source === unused16) { assert.equal(result.parameters.length, 16); assert.ok(result.parameters.every(p => p.uses.length === 0)); }
    if (c.source === thirtyTwo) assert.equal(result.scene.objects.length, 32);
    for (const earlier of retained) independent(result, earlier.result);
    const prefix = resolve(output, provider.label + '.' + c.name), sourcePath = prefix + '.source2.css', resultPath = prefix + '.result.json';
    const files = [await save(sourcePath, c.source), await save(resultPath, signed(result) + '\n')]; if (c.control) files.push(await save(prefix + '.independent-literal.css', c.control));
    const record = { provider: provider.label, name: c.name, sourcePath, resultPath, digest: hash(signed(result)), files, parameterCount: result.parameters.length, objectCount: result.scene.objects.length };
    retained.push({ result, digest: record.digest, files }); records.push(record); coldCases.push(record); accepted++;
  }
  const prior = retained[0].result, changed = clone(prior.scene); changed.objects.forEach(o => o.radius = 3); assert.deepEqual(retained[1].result.scene, changed);
  const emptyLiteral = gpu.compileParameterizedAffineSceneSource(literal), oldLiteral = gpu.compileAffineSceneSource(literal); assert.equal(emptyLiteral.parameters.length, 0); assert.deepEqual(emptyLiteral.scene, oldLiteral.scene); assert.deepEqual(emptyLiteral.shaders, oldLiteral.shaders); accepted++;
  const workSource = '@scene work {version:2;@param extent:length(1scene);sphere #item;}' + Array.from({ length: 128 }, () => 'sphere{' + 'translate:$extent $extent $extent 0;'.repeat(4) + '}').join('');
  assert.equal(occurrences(workSource, '$extent').length, 1536); assert.ok(Buffer.byteLength(workSource) < 65536);
  const checks = [
    ['wrong_quantity_radius', original.replace('radius:$extent', 'radius:$zoom'), 'TYPE', '$zoom'],
    ['unknown_reference', original.replace('radius:$extent', 'radius:$missing'), 'TYPE', '$missing'],
    ['wrong_quantity_rotation', original.replace('rotate-z:$turn', 'rotate-z:$extent'), 'TYPE', '$extent', true],
    ['reference_in_color', original.replace('background:#102030', 'background:$extent'), 'TYPE', '$extent'],
    ['duplicate_parameter', original.replace('@param zoom:scalar(.5);', '@param extent:length(2scene);'), ['TYPE', 'SYNTAX']],
    ['reserved_parameter_name', original.replace('@param extent:', '@param sphere:'), ['TYPE', 'SYNTAX']],
    ['wrong_initializer_unit', original.replace('length(2scene)', 'length(2deg)'), ['SYNTAX', 'TYPE', 'RANGE']],
    ['reference_initializer', original.replace('scalar(.5)', 'scalar($extent)'), ['SYNTAX', 'TYPE']],
    ['parameter_after_object', '@scene bad {version:2;sphere #item;@param extent:length(1scene);}', 'SYNTAX'],
    ['header_after_parameter', '@scene bad {@param extent:length(1scene);version:2;sphere #item;}', 'SYNTAX'],
    ['parameter_in_style', '@scene bad {version:2;sphere #item;} sphere{@param extent:length(1scene);}', 'SYNTAX'],
    ['seventeen_parameters', unused16.replace('sphere #item;', '@param p16:scalar(16);sphere #item;'), 'BUDGET'],
    ['name33', named32.replaceAll(name32, name32 + 'n'), ['SYNTAX', 'TYPE']],
    ['objects33', thirtyTwo.replace('sphere #item31;', 'sphere #item31;sphere #item32;'), ['BUDGET', 'SCENE']],
    ['actual_AST_resolution_work', workSource, 'BUDGET'],
    ['source_UTF8_budget', '/*' + 'é'.repeat(33000) + '*/' + original, 'BUDGET'],
    ['positive_dimension_zero', original.replace('length(2scene)', 'length(0scene)'), 'SCENE', '$extent'],
    ['overridden_wrong_use', original.replace('radius:$extent;', 'radius:$zoom;radius:$extent;'), 'TYPE', '$zoom'],
    ['unused_type_selector_wrong_use', original + 'cylinder{radius:$zoom;}', 'TYPE', '$zoom', true],
    ['native_torus_relationship', '@scene bad {version:2;@param large:length(2scene);@param small:length(1scene);torus #ring;} torus{major-radius:$small;minor-radius:$large;}', 'SCENE', '$large'],
  ];
  async function retention() { assert.equal(getters, 0); for (const item of retained) { assert.equal(hash(signed(item.result)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  for (const [name, source, codes, token, last = false] of checks) {
    let error; try { gpu.compileParameterizedAffineSceneSource(source); } catch (cause) { error = cause; }
    assert.ok(error instanceof gpu.SceneParameterSourceError, name); assert.ok((Array.isArray(codes) ? codes : [codes]).includes(error.code), name + ':' + error.code);
    assert.ok(Array.isArray(error.diagnostics) && error.diagnostics.length > 0); frozen(error.diagnostics);
    const d = error.diagnostics[0]; keys(d, ['code', 'message', 'start', 'end', 'line', 'column']); assert.equal(d.code, error.code); assert.ok(d.message.length <= 1024);
    assert.deepEqual({ start: d.start, end: d.end, line: d.line, column: d.column }, range(source, d.start, d.end));
    if (token) { const start = last ? source.lastIndexOf(token) : source.indexOf(token); assert.deepEqual({ start: d.start, end: d.end, line: d.line, column: d.column }, range(source, start, start + token.length), name); }
    if (error.code === 'SCENE') { assert.ok(error.cause instanceof gpu.SceneError); assert.equal(error.cause.diagnostics[0].start, d.start); assert.equal(error.cause.diagnostics[0].end, d.end); }
    const path = resolve(output, provider.label + '.refused.' + name + '.css'); failures.push({ name, code: error.code, diagnostic: d, causeName: error.cause?.name ?? null, file: await save(path, source) }); refused++; await retention();
  }
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('no coercion'); } });
  for (const value of [object, null, 42, clone(prior.ast)]) { let error; try { gpu.compileParameterizedAffineSceneSource(value); } catch (cause) { error = cause; }
    assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'INPUT'); assert.equal(error.diagnostics[0].start, 0); assert.equal(error.diagnostics[0].end, 0); refused++; await retention(); }
  rows.push({ provider: provider.label, records, failures, literalControlWithoutParameters: true, actualWorkFixtureUses: 1536 });
}
for (let i = 0; i < cases.length; i++) assert.equal(rows[0].records[i].digest, rows[1].records[i].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const c of cfg.cases.filter(c=>c.provider===provider.label)){for(const file of c.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(c.sourcePath,'utf8'),result=gpu.compileParameterizedAffineSceneSource(source);assert.equal(result.source,source);assert.equal(hash(signed(result)),c.digest);assert.deepEqual(result,JSON.parse(readFileSync(c.resultPath,'utf8')));rows.push({provider:provider.label,name:c.name,digest:c.digest,parameters:result.parameters.length,objects:result.scene.objects.length});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentASTAuthority:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-original-parameters.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout);
assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, cases.length * providers.length);
for (const c of coldCases) for (const file of c.files) assert.equal(hash(await readFile(file.path)), file.sha256);
const report = { issue: 1462, stage: 'SCENE2_TYPED_LITERAL_PARAMETER_SOURCE_CPU', parent, node: process.version, accepted, refused, getters, namespaceCount: namespace.length, namespace, sourceGraph,
  ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), rows, cold,
  publicCompatibility: { priorRuntimeCount: 128, additions, sixTypes, oldSceneLeafSourceExact: true, oldPublicSceneAndAffineTypeDeclarationsPreserved: true, internalLowerHelperNotPublic: true, manifestUnchanged: true },
  actualGL: false, rendererAcceptance: false, physicalUnitConversion: false,
  support: 'Original Scene2 typed literal parameters and use spans, shared source relationship, distinct namespaces, copied frozen authored AST/metadata versus resolved scene/shaders, genuine full-source cold reconstruction. No arithmetic/generation/functions/runtime uniforms/CAD/mm/frame/TEN/editor/pixel/publication claim.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1462, accepted, refused, getters, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
