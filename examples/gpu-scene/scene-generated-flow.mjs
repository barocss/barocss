/** #1488 ONE bounded mixed-generation source/emitted/file/cold qualifier.
 * Node22 after GPU build: node examples/gpu-scene/scene-generated-flow.mjs --output ABS_FRESH
 * Original declarations, repeat provenance, decisions and selected Scene2 stay separate.
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
const parent = '447ba55d05de14a248cad16f7b94d35201a57cd6', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const oldBarrel = parentFile('src/index.ts'), oldFile = ts.createSourceFile('parent-barrel.ts', oldBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = oldFile.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause))
  .flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort();
assert.equal(new Set(parentRuntime).size, parentRuntime.length); assert.equal(parentRuntime.length, 139);
const ordinary = resolve(output, 'ordinary-public.mjs');
const bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs);
assert.ok(sourceGraph.some(path => path.endsWith('/src/scene/scene-generated-source.ts')));
assert.ok(!sourceGraph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const namespace = Object.keys(providers[0].gpu).sort();
assert.ok(['compileGeneratedAffineSceneSource'].sort().every(x => namespace.includes(x)));
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
];
for (const [leaf, names, runtime] of oldDeclarations) {
  const before = parentFile('src/' + leaf + '.ts'), after = await readFile(resolve(pkg, 'dist/' + leaf + '.d.ts'), 'utf8');
  assert.equal(Object.keys(types(before, names)).length, names.length); assert.deepEqual(types(after, names), types(before, names));
  assert.deepEqual(signature(after, runtime), signature(before, runtime));
}
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8');
const leafDTS = await readFile(resolve(pkg, 'dist/scene-generated-source.d.ts'), 'utf8');
const newTypes = ['GeneratedAffineSceneAst', 'CompiledGeneratedAffineSceneSource'];
for (const name of newTypes) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDTS)); }
assert.deepEqual(signature(leafDTS, 'compileGeneratedAffineSceneSource').parameters, ['input: unknown']);
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

const header = used => '/* Original mixed row é😀 and CRLF retained. */\r\n@scene combined {\r\n version:2;background:#102030;\r\n @param used:length(' + used + 'scene);@param limit:length(3scene);@param gain:scalar(.5);\r\n';
const sharedStyles = '\r\n}\r\nsphere{radius:calc($limit * $gain);translate:-0 0 0;}\r\n#studs_0{translate:-2 -0 0;}#studs_1{translate:2 0 0;}\r\n';
const optionalStyles = '#optional_0{radius:$used;}\r\n#optional_0{translate:$limit 0 0;}\r\n';
const original = header('2') + ' @repeat studs:sphere(2);@when optional:sphere($used < $limit);' + sharedStyles + optionalStyles;
const excluded = original.replace('used:length(2scene)', 'used:length(4scene)');
const restored = excluded.replace('used:length(4scene)', 'used:length(2scene)');
const count3 = original.replace('studs:sphere(2)', 'studs:sphere(3)');
const manualTrue = header('2') + ' sphere #studs_0;sphere #studs_1;sphere #optional_0;' + sharedStyles + optionalStyles;
const manualFalse = header('4') + ' sphere #studs_0;sphere #studs_1;' + sharedStyles;
const manualCount3 = header('2') + ' sphere #studs_0;sphere #studs_1;sphere #studs_2;sphere #optional_0;' + sharedStyles + optionalStyles;
function simple(name, declarations, tail = '', parameters = '@param used:scalar(1);@param limit:scalar(2);') {
  return '@scene ' + name + ' {version:2;' + parameters + declarations + '}' + tail;
}
const eight = simple('eight', Array.from({ length: 4 }, (_, index) => '@repeat r' + index + ':sphere(2);@when w' + index + ':box($limit < $used);').join(''));
const maximum = simple('maximum', '@repeat row:sphere(31);@when optional:sphere($limit < $used);');
const sixShapes = simple('shapes', '@repeat sphere:sphere(1);@repeat box:box(1);' + ['cylinder', 'capsule', 'rounded-box', 'torus'].map(type => '@when ' + type + ':' + type + '($used < $limit);').join(''));
const interleaved = simple('order', 'sphere #head;@repeat studs:sphere(2);box #middle;@when optional:box($used < $limit);@repeat end:box(1);');
function workSource(rules) {
  return simple('work', '@repeat studs:sphere(2);@when optional:sphere($used < $limit);',
    Array.from({ length: rules }, () => 'sphere{' + 'translate:$used $limit $used;'.repeat(4) + '}').join(''),
    '@param used:length(1scene);@param limit:length(2scene);');
}
const work4056 = workSource(87), work4102 = workSource(88);
assert.equal(54 + 46 * 87, 4056); assert.equal(54 + 46 * 88, 4102); assert.ok(Buffer.byteLength(work4102) < 65536);
const cases = [
  { name: 'mixed_count2_true_original', source: original, manual: manualTrue, included: [true], ids: ['studs_0', 'studs_1', 'optional_0'] },
  { name: 'condition_false_preserves_repeat_ids', source: excluded, manual: manualFalse, included: [false], ids: ['studs_0', 'studs_1'] },
  { name: 'condition_restored_true', source: restored, manual: manualTrue, included: [true], ids: ['studs_0', 'studs_1', 'optional_0'] },
  { name: 'repeat_count3_stable_existing_ids', source: count3, manual: manualCount3, included: [true], ids: ['studs_0', 'studs_1', 'studs_2', 'optional_0'] },
  { name: 'explicit_cross_kind_interleaving', source: interleaved, manual: simple('order', 'sphere #head;sphere #studs_0;sphere #studs_1;box #middle;box #optional_0;box #end_0;'),
    included: [true], ids: ['head', 'studs_0', 'studs_1', 'middle', 'optional_0', 'end_0'] },
  { name: 'six_shapes_mixed_directives', source: sixShapes, manual: simple('shapes', ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'].map(type => type + ' #' + type + '_0;').join('')),
    included: Array(4).fill(true), ids: ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'].map(type => type + '_0') },
  { name: 'shared_eight_declarations', source: eight, manual: simple('eight', Array.from({ length: 4 }, (_, index) => 'sphere #r' + index + '_0;sphere #r' + index + '_1;').join('')),
    included: Array(4).fill(false), ids: Array.from({ length: 4 }, (_, index) => ['r' + index + '_0', 'r' + index + '_1']).flat() },
  { name: 'potential32_includes_false_object', source: maximum, manual: simple('maximum', Array.from({ length: 31 }, (_, index) => 'sphere #row_' + index + ';').join('')),
    included: [false], ids: Array.from({ length: 31 }, (_, index) => 'row_' + index) },
  { name: 'negative_zero_equality_false', source: simple('zero', '@repeat row:sphere(1);@when optional:sphere($used < $limit);', '#optional_0{radius:2;}', '@param used:scalar(-0);@param limit:scalar(0);'),
    manual: simple('zero', 'sphere #row_0;', '', '@param used:scalar(-0);@param limit:scalar(0);'), included: [false], ids: ['row_0'] },
  { name: 'allfalse_zero_selected', source: simple('empty', '@when optional:sphere($limit < $used);', '#optional_0{radius:2;}'), manual: simple('empty', ''), included: [false], ids: [] },
  { name: 'zero_generation_empty', source: simple('none', '', '', ''), manual: simple('none', '', '', ''), included: [], ids: [] },
  { name: 'mixed_comment_separation', source: simple('comments', '@repeat row:sphere(2);@when optional:sphere($used /* original */ < // bound\n $limit);'),
    manual: simple('comments', 'sphere #row_0;sphere #row_1;sphere #optional_0;'), included: [true], ids: ['row_0', 'row_1', 'optional_0'] },
  { name: 'independent_shared_work4056', source: work4056, manual: simple('work', 'sphere #studs_0;sphere #studs_1;sphere #optional_0;', 'sphere{translate:1 2 1;}', '@param used:length(1scene);@param limit:length(2scene);'),
    included: [true], ids: ['studs_0', 'studs_1', 'optional_0'] },
];
let accepted = 0, refused = 0, getters = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const fixture of cases) {
    const result = gpu.compileGeneratedAffineSceneSource(fixture.source), control = gpu.compileArithmeticAffineSceneSource(fixture.manual);
    keys(result, ['format', 'version', 'profile', 'source', 'ast', 'parameters', 'generation', 'decisions', 'scene', 'shaders']);
    assert.equal(result.format, 'barocss-gpu-generated-affine-scene-source'); assert.equal(result.version, 0);
    assert.equal(result.profile, 'source2-typed-mixed-generation-v0'); assert.equal(result.source, fixture.source);
    keys(result.ast, ['schema', 'schemaVersion', 'sourceVersion', 'source', 'header', 'name', 'range', 'declarations', 'rules']);
    assert.equal(result.ast.schema, 'barocss-gpu-generated-affine-scene-ast'); assert.equal(result.ast.schemaVersion, 0); assert.equal(result.ast.sourceVersion, 2);
    assert.equal(result.ast.source, fixture.source); assert.deepEqual(result.ast.range, range(fixture.source, 0, fixture.source.length));
    assert.deepEqual(result.scene, control.scene); assert.deepEqual(result.shaders, control.shaders); frozen(result);
    assert.deepEqual(result.scene.objects.map(object => object.id), fixture.ids);
    const directives = result.ast.declarations.filter(declaration => declaration.kind === 'repeat' || declaration.kind === 'conditional');
    const expectedGeneration = [], expectedDecisions = [], potentialOrder = [];
    let conditionalIndex = 0;
    for (const declaration of result.ast.declarations) {
      if (declaration.kind === 'object') {
        assert.equal(fixture.source.slice(declaration.id.range.start, declaration.id.range.end), declaration.id.text);
        potentialOrder.push({ id: declaration.id.text.slice(1), included: true }); continue;
      }
      if (declaration.kind !== 'repeat' && declaration.kind !== 'conditional') continue;
      const conditional = declaration.kind === 'conditional';
      keys(declaration, conditional ? ['kind', 'prefix', 'type', 'left', 'operator', 'right', 'tokens', 'range'] : ['kind', 'prefix', 'type', 'count', 'tokens', 'range']);
      assert.equal(declaration.tokens.length, conditional ? 11 : 9);
      assert.deepEqual(declaration.tokens.map(token => token.text), conditional ? ['@', 'when', declaration.prefix.text, ':', declaration.type.text, '(', declaration.left.text, '<', declaration.right.text, ')', ';'] : ['@', 'repeat', declaration.prefix.text, ':', declaration.type.text, '(', declaration.count.text, ')', ';']);
      assert.deepEqual(declaration.prefix, declaration.tokens[2]); assert.deepEqual(declaration.type, declaration.tokens[4]);
      if (conditional) {
        assert.deepEqual(declaration.left, declaration.tokens[6]); assert.deepEqual(declaration.operator, declaration.tokens[7]); assert.deepEqual(declaration.right, declaration.tokens[8]);
      } else assert.deepEqual(declaration.count, declaration.tokens[6]);
      const start = declaration.tokens[0].range.start, end = declaration.tokens.at(-1).range.end;
      assert.equal(fixture.source.slice(start, start + (conditional ? 5 : 7)), conditional ? '@when' : '@repeat');
      assert.deepEqual(declaration.range, range(fixture.source, start, end));
      for (const token of declaration.tokens) {
        assert.equal(fixture.source.slice(token.range.start, token.range.end), token.text);
        assert.deepEqual(token.range, range(fixture.source, token.range.start, token.range.end));
      }
      if (conditional) {
        const included = fixture.included[conditionalIndex++], nodeId = declaration.prefix.text + '_0'; assert.equal(typeof included, 'boolean');
        expectedDecisions.push({ nodeId, prefix: declaration.prefix.text, included, declaration: declaration.range }); potentialOrder.push({ id: nodeId, included });
      } else {
        for (let index = 0; index < Number(declaration.count.text); index++) {
          const nodeId = declaration.prefix.text + '_' + index;
          expectedGeneration.push({ nodeId, prefix: declaration.prefix.text, index, declaration: declaration.range }); potentialOrder.push({ id: nodeId, included: true });
        }
      }
    }
    assert.ok(directives.length <= 8); assert.ok(potentialOrder.length <= 32); assert.equal(conditionalIndex, fixture.included.length);
    assert.deepEqual(result.generation, expectedGeneration); assert.deepEqual(result.decisions, expectedDecisions);
    assert.deepEqual(potentialOrder.filter(object => object.included).map(object => object.id), fixture.ids);
    for (const generation of result.generation) { keys(generation, ['nodeId', 'prefix', 'index', 'declaration']); assert.ok(result.scene.objects.some(object => object.id === generation.nodeId)); }
    for (const decision of result.decisions) { keys(decision, ['nodeId', 'prefix', 'included', 'declaration']); assert.equal(result.scene.objects.some(object => object.id === decision.nodeId), decision.included); }
    for (let index = 1; index < result.ast.declarations.length; index++) assert.ok(result.ast.declarations[index - 1].range.start <= result.ast.declarations[index].range.start);
    const sourceReferences = [...fixture.source.matchAll(/\$([A-Za-z_][A-Za-z0-9_-]*)/g)].map(match => ({ name: match[1], span: range(fixture.source, match.index, match.index + match[0].length) }));
    for (const parameter of result.parameters) {
      keys(parameter, ['name', 'quantity', 'unit', 'value', 'definition', 'uses']);
      const expected = sourceReferences.filter(ref => ref.name === parameter.name).map(ref => ref.span).sort((a, b) => a.start - b.start);
      assert.deepEqual([...parameter.uses].sort((a, b) => a.start - b.start), expected);
    }
    if (fixture.name === 'mixed_count2_true_original') { assert.equal(result.scene.objects[0].radius, 1.5); assert.equal(result.scene.objects[2].radius, 2); assert.deepEqual(result.scene.objects[2].translate, [3, 0, 0]); }
    if (fixture.name === 'condition_false_preserves_repeat_ids') assert.equal(result.ast.rules.filter(rule => rule.selector.text === '#optional_0').length, 2);
    if (fixture.name === 'negative_zero_equality_false') {
      assert.equal(result.ast.declarations.find(declaration => declaration.kind === 'parameter' && declaration.name.text === 'used').literal.text, '-0');
      assert.ok(Object.is(result.parameters.find(parameter => parameter.name === 'used').value, 0));
    }
    if (fixture.name === 'independent_shared_work4056') {
      assert.equal(result.parameters.reduce((sum, parameter) => sum + parameter.uses.length, 0), 1046);
      assert.equal(result.parameters.find(parameter => parameter.name === 'used').uses.length, 697);
      assert.equal(result.parameters.find(parameter => parameter.name === 'limit').uses.length, 349);
    }
    independent(result.ast, result.generation); independent(result.ast, result.decisions); independent(result.generation, result.decisions); independent(result.ast, result.scene);
    for (const earlier of retained) independent(result, earlier.result);
    const prefix = resolve(output, provider.label + '.' + fixture.name), sourcePath = prefix + '.source2.css', manualPath = prefix + '.manual.css', resultPath = prefix + '.result.json';
    const files = [await save(sourcePath, fixture.source), await save(manualPath, fixture.manual), await save(resultPath, signed(result) + '\n'),
      await save(prefix + '.ast.json', signed(result.ast) + '\n'), await save(prefix + '.generation.json', signed(result.generation) + '\n'), await save(prefix + '.decisions.json', signed(result.decisions) + '\n'),
      await save(prefix + '.vertex.glsl', result.shaders.vertex), await save(prefix + '.fragment.glsl', result.shaders.fragment)];
    const record = { provider: provider.label, name: fixture.name, sourcePath, manualPath, resultPath, files, digest: hash(signed(result)), objects: result.scene.objects.length, generated: result.generation.length, included: fixture.included };
    records.push(record); coldCases.push(record); retained.push({ result, digest: record.digest, files }); accepted++;
  }
  assert.deepEqual(retained[0].result, retained[2].result); assert.notStrictEqual(retained[0].result, retained[2].result);
  assert.deepEqual(retained[0].result.scene.objects.slice(0, 2), retained[1].result.scene.objects);
  for (const object of retained[0].result.scene.objects) assert.deepEqual(retained[3].result.scene.objects.find(candidate => candidate.id === object.id), object);
  assert.deepEqual(retained[0].result.generation.map(record => record.nodeId), ['studs_0', 'studs_1']);
  assert.deepEqual(retained[3].result.generation.map(record => record.nodeId), ['studs_0', 'studs_1', 'studs_2']);
  const oldProfiles = [
    ['compileParameterizedAffineSceneSource', 'barocss-gpu-parameterized-affine-scene-ast', 'source2-typed-literal-parameters-v0'],
    ['compileMultiplicativeAffineSceneSource', 'barocss-gpu-multiplicative-affine-scene-ast', 'source2-typed-product-coefficients-v0'],
    ['compileArithmeticAffineSceneSource', 'barocss-gpu-arithmetic-affine-scene-ast', 'source2-typed-flat-arithmetic-coefficients-v0'],
    ['compileFiniteRepeatAffineSceneSource', 'barocss-gpu-finite-repeat-affine-scene-ast', 'source2-typed-finite-repeat-coefficients-v0'],
    ['compileConditionalAffineSceneSource', 'barocss-gpu-conditional-affine-scene-ast', 'source2-typed-conditional-objects-v0'],
  ];
  const compatible = '@scene compatible {version:2;@param extent:length(1scene);sphere #one;}sphere{radius:$extent;}';
  const ordinaryControl = gpu.compileGeneratedAffineSceneSource(compatible);
  for (const [name, schema, profile] of oldProfiles) {
    const prior = gpu[name](compatible); assert.equal(prior.ast.schema, schema); assert.equal(prior.profile, profile); assert.deepEqual(prior.scene, ordinaryControl.scene); assert.deepEqual(prior.shaders, ordinaryControl.shaders);
    let error; try { gpu[name](original); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'SYNTAX');
    const word = name === 'compileFiniteRepeatAffineSceneSource' ? 'when' : 'repeat', start = original.indexOf('@' + word) + 1;
    assert.equal(error.diagnostics[0].start, start); assert.equal(error.diagnostics[0].end, start + word.length); refused++;
  }
  assert.deepEqual(gpu.compileFiniteRepeatAffineSceneSource('@scene repeat {version:2;@repeat row:sphere(2);}').scene.objects.map(object => object.id), ['row_0', 'row_1']);
  assert.deepEqual(gpu.compileConditionalAffineSceneSource(simple('condition', '@when optional:sphere($used < $limit);')).scene.objects.map(object => object.id), ['optional_0']);
  const predicate = (relation, tail = '') => simple('bad', '@repeat studs:sphere(2);@when optional:sphere(' + relation + ');', tail);
  const checks = [
    { name: 'false_cross_kind_duplicate_prefix', source: simple('bad', '@repeat row:sphere(2);@when row:box($limit < $used);'), code: 'TYPE' },
    { name: 'false_condition_then_repeat_collision', source: simple('bad', '@when row:box($limit < $used);@repeat row:sphere(2);'), code: 'TYPE' },
    { name: 'false_explicit_identity_collision', source: predicate('$limit < $used').replace('@repeat', 'box #optional_0;@repeat'), code: 'TYPE' },
    { name: 'repeat_explicit_identity_collision', source: predicate('$used < $limit').replace('@repeat', 'box #studs_1;@repeat'), code: 'TYPE' },
    { name: 'unknown_predicate_reference', source: predicate('$missing < $limit'), code: 'TYPE' },
    { name: 'mixed_predicate_quantity', source: simple('bad', '@repeat studs:sphere(2);@when optional:sphere($used < $limit);', '', '@param used:length(1scene);@param limit:angle(2deg);'), code: 'TYPE' },
    { name: 'compact_predicate', source: predicate('$used<$limit'), code: 'SYNTAX' },
    { name: 'unsupported_predicate_operator', source: predicate('$used > $limit'), code: 'SYNTAX' },
    { name: 'arithmetic_predicate', source: predicate('calc($used + $limit) < $limit'), code: 'SYNTAX' },
    { name: 'literal_predicate_operand', source: predicate('1 < $limit'), code: 'SYNTAX' },
    { name: 'zero_repeat_count', source: predicate('$used < $limit').replace('studs:sphere(2)', 'studs:sphere(0)'), code: 'SYNTAX' },
    { name: 'noncanonical_repeat_count', source: predicate('$used < $limit').replace('studs:sphere(2)', 'studs:sphere(02)'), code: 'SYNTAX' },
    { name: 'repeat_count33', source: predicate('$used < $limit').replace('studs:sphere(2)', 'studs:sphere(33)'), code: 'RANGE' },
    { name: 'no_computed_count', source: predicate('$used < $limit').replace('studs:sphere(2)', 'studs:sphere(2+1)'), code: 'SYNTAX' },
    { name: 'no_parameter_count', source: predicate('$used < $limit').replace('studs:sphere(2)', 'studs:sphere($used)'), code: 'SYNTAX' },
    { name: 'no_index_variable', source: predicate('$used < $limit', '#studs_0{translate:$index 0 0;}'), code: 'TYPE' },
    { name: 'no_nested_repeat_body', source: simple('bad', '@repeat row:sphere(2){@when optional:sphere($used < $limit);};'), code: 'SYNTAX' },
    { name: 'no_conditional_body', source: simple('bad', '@repeat row:sphere(2);@when optional:sphere($used < $limit){sphere #inner;};'), code: 'SYNTAX' },
    { name: 'false_invalid_capsule_relationship', source: predicate('$limit < $used', '#optional_0{start:0 0 0;end:0 0 0;}').replace('optional:sphere', 'optional:capsule'), code: 'SCENE' },
    { name: 'false_invalid_torus_relationship', source: predicate('$limit < $used', '#optional_0{major-radius:1;minor-radius:2;}').replace('optional:sphere', 'optional:torus'), code: 'SCENE' },
    { name: 'false_invalid_style', source: predicate('$limit < $used', '#optional_0{radius:-1;}'), code: 'SCENE' },
    { name: 'false_wrong_style_quantity', source: predicate('$limit < $used', '#optional_0{rotate-y:$used;}'), code: 'TYPE' },
    { name: 'unknown_noncandidate_selector', source: predicate('$limit < $used', '#unrelated{radius:1;}'), code: 'SCENE' },
    { name: 'later_parameter', source: simple('bad', '@repeat row:sphere(2);@when optional:sphere($used < $limit);@param late:scalar(1);'), code: 'SYNTAX' },
    { name: 'repeat_in_style', source: predicate('$used < $limit', 'sphere{@repeat late:sphere(1);}'), code: 'SYNTAX' },
    { name: 'condition_in_style', source: predicate('$used < $limit', 'sphere{@when late:sphere($used < $limit);}'), code: 'SYNTAX' },
    { name: 'shared_ninth_declaration', source: eight.replace('}', '@repeat ninth:sphere(1);}'), code: 'BUDGET' },
    { name: 'potential33_including_false', source: maximum.replace('@repeat', 'sphere #extra;@repeat'), code: 'BUDGET' },
    { name: 'independent_shared_work4102', source: work4102, code: 'BUDGET' },
  ];
  async function retention() {
    assert.equal(getters, 0);
    for (const item of retained) { assert.equal(hash(signed(item.result)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); }
  }
  for (const fixture of checks) {
    let error; try { gpu.compileGeneratedAffineSceneSource(fixture.source); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError, fixture.name); assert.equal(error.code, fixture.code, fixture.name); frozen(error.diagnostics);
    const diagnostic = error.diagnostics[0]; keys(diagnostic, ['code', 'message', 'start', 'end', 'line', 'column']); assert.ok(error.message.length <= 1024); assert.ok(diagnostic.message.length <= 1024);
    assert.deepEqual({ start: diagnostic.start, end: diagnostic.end, line: diagnostic.line, column: diagnostic.column }, range(fixture.source, diagnostic.start, diagnostic.end));
    if (fixture.code === 'SCENE') assert.ok(error.cause instanceof gpu.SceneError, fixture.name); else assert.equal(Object.hasOwn(error, 'cause'), false, fixture.name);
    failures.push({ name: fixture.name, code: error.code, diagnostic, causeName: error.cause?.name ?? null, file: await save(resolve(output, provider.label + '.refused.' + fixture.name + '.css'), fixture.source) });
    refused++; await retention();
  }
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('No source coercion'); } });
  for (const value of [object, JSON.parse(signed(retained[0].result.ast)), null]) {
    let error; try { gpu.compileGeneratedAffineSceneSource(value); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'INPUT'); assert.equal(Object.hasOwn(error, 'cause'), false); refused++; await retention();
  }
  rows.push({ provider: provider.label, records, failures, oldSeparateProfilesRetained: true, independentWork: { admitted: 4056, refused: 4102, admittedUses: 1046, refusedUses: 1058 } });
}
for (let index = 0; index < cases.length; index++) assert.equal(rows[0].records[index].digest, rows[1].records[index].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=value=>createHash('sha256').update(value).digest('hex');
function signed(value){if(typeof value==='number'){assert.ok(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}if(value===null||typeof value!=='object')return JSON.stringify(value);return Array.isArray(value)?'['+value.map(signed).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+signed(value[key])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const fixture of cfg.cases.filter(fixture=>fixture.provider===provider.label)){for(const file of fixture.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(fixture.sourcePath,'utf8'),result=gpu.compileGeneratedAffineSceneSource(source),manual=gpu.compileArithmeticAffineSceneSource(readFileSync(fixture.manualPath,'utf8'));assert.equal(result.source,source);assert.equal(hash(signed(result)),fixture.digest);assert.deepEqual(result,JSON.parse(readFileSync(fixture.resultPath,'utf8')));assert.deepEqual(result.scene,manual.scene);assert.deepEqual(result.shaders,manual.shaders);assert.deepEqual(result.decisions.map(decision=>decision.included),fixture.included);assert.equal(result.generation.length,fixture.generated);rows.push({provider:provider.label,name:fixture.name,digest:fixture.digest,objects:result.scene.objects.length,generated:result.generation.length});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'whole original source only; result files are expected observations',actualGL:false}));`;
const coldPath = resolve(output, 'cold-authored-generation.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' });
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, cases.length * providers.length);
const report = { issue: 1488, stage: 'SCENE2_TYPED_MIXED_GENERATION_SOURCE_CPU', parent, node: process.version, accepted, refused, getters, namespaceCount: namespace.length,
  namespace, parentRuntime, sourceGraph, rows, cold, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), newTypes,
  oldPublicTypesAndSignaturesPreserved: true, oldManifestAndBarrelPrefixPreserved: true, unchangedSemanticAndShaderProviders: true,
  independentWork: { formula: 'B=2+17R;2params=8;repeat=10;conditional=15;3potential=12;U=2+12R;A=5+17R;total54+46R', admitted: { rules: 87, work: 4056, uses: 1046, used: 697, limit: 349 }, refused: { rules: 88, work: 4102, uses: 1058 } },
  providerStages: 'ONE masked parse; TWO unchanged lowerAffineSceneAst calls in selected mixed-mode source contract, even without predicates: validate all potential candidates, then lower selected private view. False invalid shape refusals are genuine observations; call count is a static contract, not runtime telemetry.',
  actualGL: false, consumerPresentation: false, physicalUnitConversion: false,
  unforcedDefensiveGuards: ['complete-valid-result2MiB', 'complete-valid-shader64KiB'],
  support: 'One explicit source profile composes existing repeat and conditional statements. Shared8 declaration/32 potential/4096 work caps, stable source-order IDs, all false constraints validated, independent generation/decisions and original authored AST/rules, manual Scene2/shader equality and full-source cold reconstruction. No index/body/nesting/runtime loop/native CAD/TEN/frame/pixels/history/publication.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1488, accepted, refused, getters, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
