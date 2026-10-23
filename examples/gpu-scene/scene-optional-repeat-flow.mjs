/** #1494 ONE optional-repeat source/emitted/original-file/cold CPU qualifier.
 * Node22 after GPU build: node examples/gpu-scene/scene-optional-repeat-flow.mjs --output ABS_FRESH
 * Zero keeps original declaration authority and creates no phantom ID or instance.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';
assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]);
await mkdir(output, { recursive: false });
const parent = '4dcb0ebb67ac25f94a9f9e0b84d921f54ab468e8', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const oldBarrel = parentFile('src/index.ts'), oldFile = ts.createSourceFile('parent-barrel.ts', oldBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = oldFile.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause))
  .flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort();
assert.equal(new Set(parentRuntime).size, parentRuntime.length); assert.equal(parentRuntime.length, 140);
const ordinary = resolve(output, 'ordinary-public.mjs');
const bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs);
assert.ok(sourceGraph.some(path => path.endsWith('/src/scene/scene-optional-repeat-source.ts')));
assert.ok(!sourceGraph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const namespace = Object.keys(providers[0].gpu).sort();
assert.ok(['compileOptionalRepeatedAffineSceneSource'].sort().every(x => namespace.includes(x)));
assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);



const printer = ts.createPrinter({ removeComments: true });
function types(text, names) {
  const file = ts.createSourceFile('types.ts', text, ts.ScriptTarget.Latest, true);
  return Object.fromEntries(file.statements.filter(node => (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && names.includes(node.name.text))
    .map(node => [node.name.text, printer.printNode(ts.EmitHint.Unspecified, node, file)]));
}
function signature(text, name) {
  const file = ts.createSourceFile('signature.ts', text, ts.ScriptTarget.Latest, true);
  const fn = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name); assert.ok(fn);
  return { parameters: fn.parameters.map(node => printer.printNode(ts.EmitHint.Unspecified, node, file)), result: printer.printNode(ts.EmitHint.Unspecified, fn.type, file) };
}
const oldDeclarations = [
  ['scene-parameter-source', ['SceneParameterCode', 'SceneParameterDiagnostic', 'SceneParameterDeclaration', 'ParameterizedAffineSceneAst', 'SceneParameter', 'CompiledParameterizedAffineSceneSource', 'SceneRepeatDeclaration', 'SceneGenerationRecord', 'SceneConditionalDeclaration', 'SceneConditionalDecision'], 'compileParameterizedAffineSceneSource'],
  ['scene-product-source', ['MultiplicativeAffineSceneAst', 'CompiledMultiplicativeAffineSceneSource'], 'compileMultiplicativeAffineSceneSource'],
  ['scene-arithmetic-source', ['ArithmeticAffineSceneAst', 'CompiledArithmeticAffineSceneSource'], 'compileArithmeticAffineSceneSource'],
  ['scene-finite-repeat-source', ['FiniteRepeatAffineSceneAst', 'CompiledFiniteRepeatAffineSceneSource'], 'compileFiniteRepeatAffineSceneSource'],
  ['scene-conditional-source', ['ConditionalAffineSceneAst', 'CompiledConditionalAffineSceneSource'], 'compileConditionalAffineSceneSource'],
  ['scene-generated-source', ['GeneratedAffineSceneAst', 'CompiledGeneratedAffineSceneSource'], 'compileGeneratedAffineSceneSource'],
];
for (const [leaf, names, runtime] of oldDeclarations) {
  const before = parentFile('src/' + leaf + '.ts'), after = await readFile(resolve(pkg, 'dist/' + leaf + '.d.ts'), 'utf8');
  assert.equal(Object.keys(types(before, names)).length, names.length); assert.deepEqual(types(after, names), types(before, names));
  assert.deepEqual(signature(after, runtime), signature(before, runtime));
}
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8');
const leafDTS = await readFile(resolve(pkg, 'dist/scene-optional-repeat-source.d.ts'), 'utf8');
const newTypes = ['OptionalRepeatedAffineSceneAst', 'CompiledOptionalRepeatedAffineSceneSource'];
for (const name of newTypes) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDTS)); }
assert.deepEqual(signature(leafDTS, 'compileOptionalRepeatedAffineSceneSource').parameters, ['input: unknown']);
for (const name of ['compileSceneParameterData', 'finishSceneParameterSource', 'lowerAffineSceneAst']) {
  assert.ok(!namespace.includes(name)); assert.ok(!new RegExp('\\b' + name + '\\b').test(publicDTS));
}
function signed(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return Array.isArray(value) ? '[' + value.map(signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}';
}
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, seen = new Set()) { if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); Object.values(value).forEach(child => refs(child, seen)); } return seen; }
function independent(left, right) { const rightRefs = refs(right); for (const ref of refs(left)) assert.ok(!rightRefs.has(ref)); }
function keys(value, names) { assert.deepEqual(Object.keys(value).sort(), [...names].sort()); }
function range(source, start, end) { const prefix = source.slice(0, start); return { start, end, line: prefix.split('\n').length, column: start - prefix.lastIndexOf('\n') }; }
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }

const shapes = ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'];
const header = '/* Original optional row é😀 and CRLF retained. */\r\n@scene optional {\r\n version:2;background:#102030;\r\n @param extent:length(2scene);@param gain:scalar(.5);@param offset:length(-0scene);\r\n';
const styles = '\r\n}\r\nsphere{radius:calc($extent * $gain);translate:$offset -0 0;}\r\n';
const original = header + ' @repeat row:sphere(2);' + styles;
const zero = original.replace('row:sphere(2)', 'row:sphere(0)'), three = original.replace('row:sphere(2)', 'row:sphere(3)');
const manual = count => header + Array.from({ length: count }, (_, index) => ' sphere #row_' + index + ';').join('') + styles;
function simple(name, declarations, tail = '', parameters = '') { return '@scene ' + name + ' {version:2;' + parameters + declarations + '}' + tail; }
const sixZero = simple('six', shapes.map(type => '@repeat ' + type + ':' + type + '(0);').join(''));
const eightZero32 = simple('eight', Array.from({ length: 8 }, (_, index) => '@repeat z' + index + ':sphere(0);').join('') + Array.from({ length: 32 }, (_, index) => 'sphere #real_' + index + ';').join(''));
const sameExplicit = simple('real', 'box #row_0;@repeat row:sphere(0);', '#row_0{size:1 2 3;}');
const interleaved = simple('order', 'sphere #head;@repeat omitted:box(0);@repeat row:box(2);sphere #tail;@repeat none:sphere(0);');
const zeroTorus = simple('torus_policy', '@repeat row:torus(0);', 'torus{major-radius:1;minor-radius:2;}');
const zeroCapsule = simple('capsule_policy', '@repeat row:capsule(0);', 'capsule{start:0 0 0;end:0 0 0;}');
const zeroRounded = simple('rounded_policy', '@repeat row:rounded-box(0);', 'rounded-box{radius:2;size:1 1 1;}');
function workSource(count, products) {
  let field = 0;
  return simple('work', '@repeat row:sphere(' + count + ');', Array.from({ length: 128 }, () => 'sphere{' + Array.from({ length: 4 }, () => field++ < products ? 'translate:calc($extent * $gain) $extent 0;' : 'translate:$extent $extent $extent;').join('') + '}').join(''),
    '@param extent:length(1scene);@param gain:scalar(1);');
}
const workZero4092 = workSource(0, 45), workZero4100 = workSource(0, 46), workOne4096 = workSource(1, 45), workTwo4100 = workSource(2, 45);
assert.equal(3732 + 8 * 45, 4092); assert.equal(3732 + 8 * 46, 4100); assert.equal(3732 + 4 + 8 * 45, 4096); assert.equal(3732 + 8 + 8 * 45, 4100);
assert.ok(Buffer.byteLength(workZero4100) < 65536);
const cases = [
  { name: 'count2_original', source: original, manual: manual(2), ids: ['row_0', 'row_1'] },
  { name: 'count0_no_phantom', source: zero, manual: manual(0), ids: [] },
  { name: 'count3_stable_ids', source: three, manual: manual(3), ids: ['row_0', 'row_1', 'row_2'] },
  { name: 'six_supported_zero_shapes', source: sixZero, manual: simple('six', ''), ids: [] },
  { name: 'eight_zero_declarations_32_explicit', source: eightZero32, manual: simple('eight', Array.from({ length: 32 }, (_, index) => 'sphere #real_' + index + ';').join('')), ids: Array.from({ length: 32 }, (_, index) => 'real_' + index) },
  { name: 'explicit_row0_is_genuine', source: sameExplicit, manual: simple('real', 'box #row_0;', '#row_0{size:1 2 3;}'), ids: ['row_0'] },
  { name: 'zero_positive_explicit_interleaving', source: interleaved, manual: simple('order', 'sphere #head;box #row_0;box #row_1;sphere #tail;'), ids: ['head', 'row_0', 'row_1', 'tail'] },
  { name: 'zero_torus_no_instance_relationship', source: zeroTorus, manual: simple('torus_policy', '', 'torus{major-radius:1;minor-radius:2;}'), ids: [] },
  { name: 'zero_capsule_no_instance_relationship', source: zeroCapsule, manual: simple('capsule_policy', '', 'capsule{start:0 0 0;end:0 0 0;}'), ids: [] },
  { name: 'zero_rounded_no_instance_relationship', source: zeroRounded, manual: simple('rounded_policy', '', 'rounded-box{radius:2;size:1 1 1;}'), ids: [] },
  { name: 'maximum32_actual_generated', source: simple('maximum', '@repeat row:sphere(32);'), manual: simple('maximum', Array.from({ length: 32 }, (_, index) => 'sphere #row_' + index + ';').join('')), ids: Array.from({ length: 32 }, (_, index) => 'row_' + index) },
  { name: 'zero_work4092_1536uses', source: workZero4092, manual: simple('work', '', 'sphere{translate:1 1 1;}', '@param extent:length(1scene);@param gain:scalar(1);'), ids: [] },
  { name: 'one_work4096_exact_boundary', source: workOne4096, manual: simple('work', 'sphere #row_0;', 'sphere{translate:1 1 1;}', '@param extent:length(1scene);@param gain:scalar(1);'), ids: ['row_0'] },
];
let accepted = 0, refused = 0, getters = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const fixture of cases) {
    const result = gpu.compileOptionalRepeatedAffineSceneSource(fixture.source), control = gpu.compileArithmeticAffineSceneSource(fixture.manual);
    keys(result, ['format', 'version', 'profile', 'source', 'ast', 'parameters', 'generation', 'scene', 'shaders']);
    assert.equal(result.format, 'barocss-gpu-optional-repeat-affine-scene-source'); assert.equal(result.version, 0); assert.equal(result.profile, 'source2-typed-optional-repeat-coefficients-v0'); assert.equal(result.source, fixture.source);
    keys(result.ast, ['schema', 'schemaVersion', 'sourceVersion', 'source', 'header', 'name', 'range', 'declarations', 'rules']);
    assert.equal(result.ast.schema, 'barocss-gpu-optional-repeat-affine-scene-ast'); assert.equal(result.ast.schemaVersion, 0); assert.equal(result.ast.sourceVersion, 2); assert.equal(result.ast.source, fixture.source);
    assert.deepEqual(result.ast.range, range(fixture.source, 0, fixture.source.length)); assert.deepEqual(result.scene, control.scene); assert.deepEqual(result.shaders, control.shaders); frozen(result);
    assert.deepEqual(result.scene.objects.map(object => object.id), fixture.ids);
    const expectedGeneration = [], expectedOrder = [], repeats = result.ast.declarations.filter(declaration => declaration.kind === 'repeat');
    for (const declaration of result.ast.declarations) {
      if (declaration.kind === 'object') { assert.equal(fixture.source.slice(declaration.id.range.start, declaration.id.range.end), declaration.id.text); expectedOrder.push(declaration.id.text.slice(1)); continue; }
      if (declaration.kind !== 'repeat') continue;
      keys(declaration, ['kind', 'prefix', 'type', 'count', 'tokens', 'range']); assert.equal(declaration.tokens.length, 9);
      assert.deepEqual(declaration.tokens.map(token => token.text), ['@', 'repeat', declaration.prefix.text, ':', declaration.type.text, '(', declaration.count.text, ')', ';']);
      assert.deepEqual(declaration.prefix, declaration.tokens[2]); assert.deepEqual(declaration.type, declaration.tokens[4]); assert.deepEqual(declaration.count, declaration.tokens[6]);
      const start = declaration.tokens[0].range.start, end = declaration.tokens[8].range.end;
      assert.equal(fixture.source.slice(start, start + 7), '@repeat'); assert.deepEqual(declaration.range, range(fixture.source, start, end));
      for (const token of declaration.tokens) { assert.equal(fixture.source.slice(token.range.start, token.range.end), token.text); assert.deepEqual(token.range, range(fixture.source, token.range.start, token.range.end)); }
      for (let index = 0; index < Number(declaration.count.text); index++) {
        const nodeId = declaration.prefix.text + '_' + index; expectedOrder.push(nodeId);
        expectedGeneration.push({ nodeId, prefix: declaration.prefix.text, index, declaration: declaration.range });
      }
    }
    assert.deepEqual(result.generation, expectedGeneration); assert.deepEqual(expectedOrder, fixture.ids);
    assert.equal(result.scene.objects.length, result.ast.declarations.filter(declaration => declaration.kind === 'object').length + result.generation.length);
    assert.ok(repeats.length <= 8); assert.ok(result.scene.objects.length <= 32);
    for (const generation of result.generation) { keys(generation, ['nodeId', 'prefix', 'index', 'declaration']); assert.ok(result.scene.objects.some(object => object.id === generation.nodeId)); }
    for (let index = 1; index < result.ast.declarations.length; index++) assert.ok(result.ast.declarations[index - 1].range.start <= result.ast.declarations[index].range.start);
    const sourceReferences = [...fixture.source.matchAll(/\$([A-Za-z_][A-Za-z0-9_-]*)/g)].map(match => ({ name: match[1], span: range(fixture.source, match.index, match.index + match[0].length) }));
    for (const parameter of result.parameters) {
      keys(parameter, ['name', 'quantity', 'unit', 'value', 'definition', 'uses']);
      assert.deepEqual([...parameter.uses].sort((a, b) => a.start - b.start), sourceReferences.filter(ref => ref.name === parameter.name).map(ref => ref.span).sort((a, b) => a.start - b.start));
    }
    if (['count2_original', 'count0_no_phantom', 'count3_stable_ids'].includes(fixture.name)) {
      assert.equal(result.ast.declarations.find(declaration => declaration.kind === 'parameter' && declaration.name.text === 'offset').literal.text, '-0scene');
      assert.ok(Object.is(result.parameters.find(parameter => parameter.name === 'offset').value, 0)); assert.equal(result.ast.rules[0].declarations[1].literals[1].text, '-0');
      for (const object of result.scene.objects) { assert.equal(object.radius, 1); assert.deepEqual(object.translate, [0, 0, 0]); }
    }
    if (fixture.name === 'count0_no_phantom') { assert.equal(repeats.length, 1); assert.equal(repeats[0].count.text, '0'); assert.equal(result.ast.rules.length, 1); assert.deepEqual(result.generation, []); }
    if (fixture.name === 'explicit_row0_is_genuine') { assert.deepEqual(result.generation, []); assert.equal(result.scene.objects[0].type, 'box'); assert.deepEqual(result.scene.objects[0].size, [1, 2, 3]); }
    if (fixture.name.includes('work')) {
      assert.equal(result.parameters.reduce((sum, parameter) => sum + parameter.uses.length, 0), 1536);
      assert.equal(result.parameters.find(parameter => parameter.name === 'extent').uses.length, 1491); assert.equal(result.parameters.find(parameter => parameter.name === 'gain').uses.length, 45);
    }
    independent(result.ast, result.generation); independent(result.ast, result.scene); independent(result.parameters, result.generation);
    for (const earlier of retained) independent(result, earlier.result);
    const prefix = resolve(output, provider.label + '.' + fixture.name), sourcePath = prefix + '.source2.css', manualPath = prefix + '.manual.css', resultPath = prefix + '.result.json';
    const files = [await save(sourcePath, fixture.source), await save(manualPath, fixture.manual), await save(resultPath, signed(result) + '\n'), await save(prefix + '.ast.json', signed(result.ast) + '\n'),
      await save(prefix + '.generation.json', signed(result.generation) + '\n'), await save(prefix + '.vertex.glsl', result.shaders.vertex), await save(prefix + '.fragment.glsl', result.shaders.fragment)];
    const record = { provider: provider.label, name: fixture.name, sourcePath, manualPath, resultPath, files, digest: hash(signed(result)), objects: result.scene.objects.length, generated: result.generation.length };
    records.push(record); coldCases.push(record); retained.push({ result, digest: record.digest, files }); accepted++;
  }
  assert.deepEqual(retained[0].result.scene.objects, retained[2].result.scene.objects.slice(0, 2));
  assert.deepEqual(retained[0].result.generation.map(record => record.nodeId), ['row_0', 'row_1']); assert.deepEqual(retained[2].result.generation.map(record => record.nodeId), ['row_0', 'row_1', 'row_2']);
  assert.equal(retained[1].result.scene.objects.length, 0); assert.equal(retained[1].result.generation.length, 0);
  for (const [name, schema, profile] of [
    ['compileFiniteRepeatAffineSceneSource', 'barocss-gpu-finite-repeat-affine-scene-ast', 'source2-typed-finite-repeat-coefficients-v0'],
    ['compileGeneratedAffineSceneSource', 'barocss-gpu-generated-affine-scene-ast', 'source2-typed-mixed-generation-v0'],
  ]) {
    const compatible = gpu[name](original); assert.equal(compatible.ast.schema, schema); assert.equal(compatible.profile, profile); assert.deepEqual(compatible.scene, retained[0].result.scene); assert.deepEqual(compatible.shaders, retained[0].result.shaders);
    let error; try { gpu[name](zero); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'SYNTAX');
    const start = zero.indexOf('row:sphere(0)') + 'row:sphere('.length;
    assert.equal(error.diagnostics[0].start, start); assert.equal(error.diagnostics[0].end, start + 1); refused++;
  }
  const bad = (count = '0', type = 'sphere', tail = '') => simple('bad', '@repeat row:' + type + '(' + count + ');', tail);
  const checks = [
    ...['00', '02', '+0', '-0', '0.0', '0e0', '-1', '1.5', 'Infinity', '$extent', '1+1'].map((count, index) => ({ name: 'bad_count_' + index + '_' + count.replace(/[^a-zA-Z0-9]/g, '_'), source: bad(count), code: 'SYNTAX' })),
    { name: 'canonical_count33', source: bad('33'), code: 'RANGE' },
    { name: 'unknown_zero_shape', source: bad('0', 'triangle'), code: 'TYPE' },
    { name: 'duplicate_zero_prefix', source: simple('bad', '@repeat row:sphere(0);@repeat row:box(0);'), code: 'TYPE' },
    { name: 'stale_zero_id_rule', source: bad('0', 'sphere', '#row_0{radius:1;}'), code: 'SCENE' },
    { name: 'invalid_unmatched_radius', source: bad('0', 'sphere', 'sphere{radius:0;}'), code: 'SCENE' },
    { name: 'invalid_unmatched_scale', source: bad('0', 'sphere', 'sphere{scale:.001 1 1;}'), code: 'SCENE' },
    { name: 'invalid_unmatched_shape_property', source: bad('0', 'sphere', 'box{radius:1;}'), code: 'SCENE' },
    { name: 'unknown_unmatched_parameter', source: bad('0', 'sphere', 'sphere{radius:$missing;}'), code: 'TYPE' },
    { name: 'positive_torus_real_relationship', source: zeroTorus.replace('torus(0)', 'torus(1)'), code: 'SCENE' },
    { name: 'positive_capsule_real_relationship', source: zeroCapsule.replace('capsule(0)', 'capsule(1)'), code: 'SCENE' },
    { name: 'positive_rounded_real_relationship', source: zeroRounded.replace('rounded-box(0)', 'rounded-box(1)'), code: 'SCENE' },
    { name: 'ninth_zero_declaration', source: simple('bad', Array.from({ length: 9 }, (_, index) => '@repeat z' + index + ':sphere(0);').join('')), code: 'BUDGET' },
    { name: 'actual_expanded33', source: simple('bad', 'sphere #extra;@repeat row:sphere(32);'), code: 'BUDGET' },
    { name: 'unsupported_condition', source: simple('bad', '@repeat row:sphere(0);@when optional:sphere($extent < $extent);', '', '@param extent:length(1scene);'), code: 'SYNTAX' },
    { name: 'unsupported_repeat_body', source: simple('bad', '@repeat row:sphere(0){sphere #inner;};'), code: 'SYNTAX' },
    { name: 'unsupported_nested_repeat', source: simple('bad', '@repeat row:sphere(0){@repeat inner:sphere(1);};'), code: 'SYNTAX' },
    { name: 'unsupported_index', source: bad('1', 'sphere', 'sphere{translate:$index 0 0;}'), code: 'TYPE' },
    { name: 'late_parameter', source: simple('bad', '@repeat row:sphere(0);@param late:scalar(1);'), code: 'SYNTAX' },
    { name: 'repeat_in_style', source: bad('0', 'sphere', 'sphere{@repeat late:sphere(0);}'), code: 'SYNTAX' },
    { name: 'zero_work4100_46products', source: workZero4100, code: 'BUDGET' },
    { name: 'two_work4100_45products', source: workTwo4100, code: 'BUDGET' },
    { name: 'genuine_UTF8_source_cap', source: '/*' + 'é'.repeat(33000) + '*/' + zero, code: 'BUDGET' },
  ];
  async function retention() {
    assert.equal(getters, 0);
    for (const item of retained) { assert.equal(hash(signed(item.result)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); }
  }
  for (const fixture of checks) {
    let error; try { gpu.compileOptionalRepeatedAffineSceneSource(fixture.source); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError, fixture.name); assert.equal(error.code, fixture.code, fixture.name); frozen(error.diagnostics);
    const diagnostic = error.diagnostics[0]; keys(diagnostic, ['code', 'message', 'start', 'end', 'line', 'column']); assert.ok(error.message.length <= 1024); assert.ok(diagnostic.message.length <= 1024);
    assert.deepEqual({ start: diagnostic.start, end: diagnostic.end, line: diagnostic.line, column: diagnostic.column }, range(fixture.source, diagnostic.start, diagnostic.end));
    if (fixture.code === 'SCENE') assert.ok(error.cause instanceof gpu.SceneError, fixture.name); else assert.equal(Object.hasOwn(error, 'cause'), false, fixture.name);
    failures.push({ name: fixture.name, code: error.code, diagnostic, causeName: error.cause?.name ?? null, file: await save(resolve(output, provider.label + '.refused.' + fixture.name + '.css'), fixture.source) });
    refused++; await retention();
  }
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('No source coercion'); } });
  for (const value of [object, JSON.parse(signed(retained[0].result.ast)), null]) {
    let error; try { gpu.compileOptionalRepeatedAffineSceneSource(value); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'INPUT'); assert.equal(Object.hasOwn(error, 'cause'), false); refused++; await retention();
  }
  rows.push({ provider: provider.label, records, failures, oldPositiveAndMixedZeroRefusalsRetained: true,
    independentWork: { formula: '3732+4G+8k', zero45: 4092, zero46: 4100, one45: 4096, two45: 4100, uses: 1536 } });
}
for (let index = 0; index < cases.length; index++) assert.equal(rows[0].records[index].digest, rows[1].records[index].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=value=>createHash('sha256').update(value).digest('hex');
function signed(value){if(typeof value==='number'){assert.ok(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}if(value===null||typeof value!=='object')return JSON.stringify(value);return Array.isArray(value)?'['+value.map(signed).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+signed(value[key])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const fixture of cfg.cases.filter(fixture=>fixture.provider===provider.label)){for(const file of fixture.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(fixture.sourcePath,'utf8'),result=gpu.compileOptionalRepeatedAffineSceneSource(source),manual=gpu.compileArithmeticAffineSceneSource(readFileSync(fixture.manualPath,'utf8'));assert.equal(result.source,source);assert.equal(hash(signed(result)),fixture.digest);assert.deepEqual(result,JSON.parse(readFileSync(fixture.resultPath,'utf8')));assert.deepEqual(result.scene,manual.scene);assert.deepEqual(result.shaders,manual.shaders);assert.equal(result.generation.length,fixture.generated);rows.push({provider:provider.label,name:fixture.name,digest:fixture.digest,objects:result.scene.objects.length,generated:result.generation.length});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'whole original source only; saved results are observations',actualGL:false}));`;
const coldPath = resolve(output, 'cold-optional-repeats.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' });
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, cases.length * providers.length);
const report = { issue: 1494, stage: 'SCENE2_TYPED_OPTIONAL_REPEAT_SOURCE_CPU', parent, node: process.version, accepted, refused, getters, namespaceCount: namespace.length,
  namespace, parentRuntime, sourceGraph, rows, cold, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), newTypes,
  oldPublicTypesAndSignaturesPreserved: true, oldManifestAndBarrelPrefixPreserved: true, unchangedSemanticAndShaderProviders: true,
  independentWork: '2version+128rules+512*4fieldnodes+8parameterwork+1536uses+10repeat=3732 atG0;each generated object4;each replacement5 authored-token plus3 expression work. k45/G0=4092;k46/G0=4100;k45/G1=4096;k45/G2=4100.',
  instancePolicy: 'Every unmatched global field/type/range/reference/scale validates. Cross-field torus/capsule/rounded-box relationships apply only to actual instances. Zero does not manufacture a candidate, ID or template-validation certificate.',
  providerStages: 'ONE original scan and masked parse; ONE unchanged lowerAffineSceneAst in this repeat-only profile. Static pipeline contract, not runtime instrumentation.',
  actualGL: false, consumerPresentation: false, physicalUnitConversion: false, unforcedDefensiveGuards: ['complete-valid-result2MiB', 'complete-valid-shader64KiB'],
  support: 'Canonical0..32 in a distinct source profile, original zero declaration and no zero-generated records, genuine explicit identity coexistence, stable positive siblings, unmatched field validation/actual-instance relationships, shared source/work/copy budgets and original-source cold reconstruction. Old positive repeat/mixed zero refusal preserved. No conditions/index/body/runtime/native CAD/TEN/frame/pixels/history/publication.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1494, accepted, refused, getters, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
