/** #1482 ONE source/emitted/full-file/cold CPU qualifier. Run after the GPU build.
 * node examples/gpu-scene/scene-conditional-flow.mjs --output ABS_FRESH
 * All potential objects validate before selection. No renderer or GL claim.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
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
const parent = 'f86ed2adaf3df25443549ae35a0123258d47ad93', pkg = resolve(repo, 'packages/barocss-gpu');
// (The package's built files live in folders since R2d: a leaf's declaration found by its name under dist/.)
const builtDeclaration = leaf => { const name = leaf + '.d.ts', hit = readdirSync(resolve(pkg, 'dist'), { recursive: true }).find(p => p === name || p.endsWith('/' + name)); assert.ok(hit, 'built ' + name); return resolve(pkg, 'dist', hit); };
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const oldBarrel = parentFile('src/index.ts'), oldFile = ts.createSourceFile('parent-barrel.ts', oldBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = oldFile.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause))
  .flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort();
assert.equal(new Set(parentRuntime).size, parentRuntime.length); assert.equal(parentRuntime.length, 138);
const ordinary = resolve(output, 'ordinary-public.mjs');
const bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs);
assert.ok(sourceGraph.some(path => path.endsWith('/src/scene/scene-conditional-source.ts')));
assert.ok(!sourceGraph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const namespace = Object.keys(providers[0].gpu).sort();
assert.ok(['compileConditionalAffineSceneSource'].sort().every(x => namespace.includes(x)));
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
  ['scene-parameter-source', ['SceneParameterCode', 'SceneParameterDiagnostic', 'SceneParameterDeclaration', 'ParameterizedAffineSceneAst', 'SceneParameter', 'CompiledParameterizedAffineSceneSource', 'SceneRepeatDeclaration', 'SceneGenerationRecord'], 'compileParameterizedAffineSceneSource'],
  ['scene-product-source', ['MultiplicativeAffineSceneAst', 'CompiledMultiplicativeAffineSceneSource'], 'compileMultiplicativeAffineSceneSource'],
  ['scene-arithmetic-source', ['ArithmeticAffineSceneAst', 'CompiledArithmeticAffineSceneSource'], 'compileArithmeticAffineSceneSource'],
  ['scene-finite-repeat-source', ['FiniteRepeatAffineSceneAst', 'CompiledFiniteRepeatAffineSceneSource'], 'compileFiniteRepeatAffineSceneSource'],
];
for (const [leaf, names, runtime] of oldDeclarations) {
  const before = parentFile('src/' + leaf + '.ts'), after = await readFile(builtDeclaration(leaf), 'utf8');
  assert.equal(Object.keys(types(before, names)).length, names.length); assert.deepEqual(types(after, names), types(before, names));
  assert.deepEqual(signature(after, runtime), signature(before, runtime));
}
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8');
const leafDTS = await readFile(resolve(pkg, 'dist/scene/scene-conditional-source.d.ts'), 'utf8');
const parameterDTS = await readFile(resolve(pkg, 'dist/scene/scene-parameter-source.d.ts'), 'utf8');
const newTypes = ['SceneConditionalDeclaration', 'SceneConditionalDecision', 'ConditionalAffineSceneAst', 'CompiledConditionalAffineSceneSource'];
for (const name of newTypes) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDTS + parameterDTS)); }
assert.deepEqual(signature(leafDTS, 'compileConditionalAffineSceneSource').parameters, ['input: unknown']);
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
const header = used => '/* Original conditional é😀 and CRLF retained. */\r\n@scene selection {\r\n version:2;background:#102030;\r\n @param used:length(' + used + 'scene);@param limit:length(2scene);@param gain:scalar(.5);\r\n';
const commonStyles = '\r\n}\r\nsphere{radius:calc($limit * $gain);translate:-0 0 0;}\r\n#anchor{translate:-2 -0 0;}\r\n';
const optionalStyles = '#optional_0{radius:$limit;}\r\n#optional_0{translate:$used 0 0;}\r\n';
const original = header('1') + ' sphere #anchor;@when optional:sphere($used < $limit);' + commonStyles + optionalStyles;
const excluded = original.replace('used:length(1scene)', 'used:length(3scene)');
const restored = excluded.replace('used:length(3scene)', 'used:length(1scene)');
const manualTrue = header('1') + ' sphere #anchor;sphere #optional_0;' + commonStyles + optionalStyles;
const manualFalse = header('3') + ' sphere #anchor;' + commonStyles;
function simple(name, declarations, tail = '', parameters = '@param used:scalar(1);@param limit:scalar(2);') {
  return '@scene ' + name + ' {version:2;' + parameters + declarations + '}' + tail;
}
const allShapes = simple('shapes', shapes.map(type => '@when ' + type + ':' + type + '($used < $limit);').join(''));
const allShapesManual = simple('shapes', shapes.map(type => type + ' #' + type + '_0;').join(''));
const eight = simple('eight', Array.from({ length: 8 }, (_, index) => '@when p' + index + ':sphere($used < $limit);').join(''));
const maxPotential = simple('potential', Array.from({ length: 24 }, (_, index) => 'sphere #plain_' + index + ';').join('') +
  Array.from({ length: 8 }, (_, index) => '@when p' + index + ':sphere($limit < $used);').join(''));
function workSource(rules) {
  return simple('work', 'sphere #anchor;@when optional:sphere($used < $limit);',
    Array.from({ length: rules }, () => 'sphere{' + 'translate:$used $limit $used;'.repeat(4) + '}').join(''),
    '@param used:length(1scene);@param limit:length(2scene);');
}
const work4084 = workSource(88), work4130 = workSource(89);
assert.equal(36 + 46 * 88, 4084); assert.equal(36 + 46 * 89, 4130); assert.ok(Buffer.byteLength(work4130) < 65536);
const commentConditional = simple('comments', 'sphere #anchor;@when optional:sphere($used /* relation */ < // bound\n $limit);');
const cases = [
  { name: 'true_original_provenance', source: original, manual: manualTrue, included: [true], ids: ['anchor', 'optional_0'] },
  { name: 'edit_false_keeps_public_rules', source: excluded, manual: manualFalse, included: [false], ids: ['anchor'] },
  { name: 'return_true_same_source_and_ids', source: restored, manual: manualTrue, included: [true], ids: ['anchor', 'optional_0'] },
  { name: 'explicit_interleaving', source: simple('order', 'sphere #head;@when middle:box($used < $limit);sphere #tail;@when end:sphere($limit < $used);'),
    manual: simple('order', 'sphere #head;box #middle_0;sphere #tail;'), included: [true, false], ids: ['head', 'middle_0', 'tail'] },
  { name: 'six_shapes_reserved_prefixes', source: allShapes, manual: allShapesManual, included: shapes.map(() => true), ids: shapes.map(type => type + '_0') },
  { name: 'eight_predicates', source: eight, manual: simple('eight', Array.from({ length: 8 }, (_, index) => 'sphere #p' + index + '_0;').join('')),
    included: Array(8).fill(true), ids: Array.from({ length: 8 }, (_, index) => 'p' + index + '_0') },
  { name: 'potential32_counts_false_candidates', source: maxPotential, manual: simple('potential', Array.from({ length: 24 }, (_, index) => 'sphere #plain_' + index + ';').join('')),
    included: Array(8).fill(false), ids: Array.from({ length: 24 }, (_, index) => 'plain_' + index) },
  { name: 'equality_original_negative_zero_false', source: simple('zero', 'sphere #anchor;@when optional:sphere($used < $limit);', '#optional_0{radius:2;}', '@param used:scalar(-0);@param limit:scalar(0);'),
    manual: simple('zero', 'sphere #anchor;', '', '@param used:scalar(-0);@param limit:scalar(0);'), included: [false], ids: ['anchor'] },
  { name: 'allfalse_empty_scene', source: simple('empty', '@when optional:sphere($limit < $used);', '#optional_0{radius:2;}'), manual: simple('empty', ''), included: [false], ids: [] },
  { name: 'angle_quantity_predicate', source: simple('angle', '@when optional:box($used < $limit);', '#optional_0{rotate-y:$limit;}', '@param used:angle(-30deg);@param limit:angle(20deg);'),
    manual: simple('angle', 'box #optional_0;', '#optional_0{rotate-y:$limit;}', '@param used:angle(-30deg);@param limit:angle(20deg);'), included: [true], ids: ['optional_0'] },
  { name: 'comment_separated_operator', source: commentConditional, manual: simple('comments', 'sphere #anchor;sphere #optional_0;'), included: [true], ids: ['anchor', 'optional_0'] },
  { name: 'independent_work4084', source: work4084, manual: simple('work', 'sphere #anchor;sphere #optional_0;', 'sphere{translate:1 2 1;}', '@param used:length(1scene);@param limit:length(2scene);'),
    included: [true], ids: ['anchor', 'optional_0'] },
];
let accepted = 0, refused = 0, getters = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const fixture of cases) {
    const result = gpu.compileConditionalAffineSceneSource(fixture.source), control = gpu.compileArithmeticAffineSceneSource(fixture.manual);
    keys(result, ['format', 'version', 'profile', 'source', 'ast', 'parameters', 'decisions', 'scene', 'shaders']);
    assert.equal(result.format, 'barocss-gpu-conditional-affine-scene-source'); assert.equal(result.version, 0);
    assert.equal(result.profile, 'source2-typed-conditional-objects-v0'); assert.equal(result.source, fixture.source);
    keys(result.ast, ['schema', 'schemaVersion', 'sourceVersion', 'source', 'header', 'name', 'range', 'declarations', 'rules']);
    assert.equal(result.ast.schema, 'barocss-gpu-conditional-affine-scene-ast'); assert.equal(result.ast.schemaVersion, 0); assert.equal(result.ast.sourceVersion, 2);
    assert.equal(result.ast.source, fixture.source); assert.deepEqual(result.ast.range, range(fixture.source, 0, fixture.source.length));
    assert.deepEqual(result.scene, control.scene); assert.deepEqual(result.shaders, control.shaders); frozen(result);
    assert.deepEqual(result.scene.objects.map(object => object.id), fixture.ids);
    const conditionals = result.ast.declarations.filter(declaration => declaration.kind === 'conditional');
    assert.equal(conditionals.length, fixture.included.length); assert.equal(result.decisions.length, conditionals.length);
    const expectedDecisions = [];
    for (const [index, declaration] of conditionals.entries()) {
      keys(declaration, ['kind', 'prefix', 'type', 'left', 'operator', 'right', 'tokens', 'range']); assert.equal(declaration.tokens.length, 11);
      assert.deepEqual(declaration.tokens.map(token => token.text), ['@', 'when', declaration.prefix.text, ':', declaration.type.text, '(', declaration.left.text, '<', declaration.right.text, ')', ';']);
      assert.deepEqual(declaration.prefix, declaration.tokens[2]); assert.deepEqual(declaration.type, declaration.tokens[4]);
      assert.deepEqual(declaration.left, declaration.tokens[6]); assert.deepEqual(declaration.operator, declaration.tokens[7]); assert.deepEqual(declaration.right, declaration.tokens[8]);
      const start = declaration.tokens[0].range.start, end = declaration.tokens[10].range.end;
      assert.equal(fixture.source.slice(start, start + 5), '@when'); assert.deepEqual(declaration.range, range(fixture.source, start, end));
      for (const token of declaration.tokens) {
        assert.equal(fixture.source.slice(token.range.start, token.range.end), token.text);
        assert.deepEqual(token.range, range(fixture.source, token.range.start, token.range.end));
      }
      expectedDecisions.push({ nodeId: declaration.prefix.text + '_0', prefix: declaration.prefix.text, included: fixture.included[index], declaration: declaration.range });
    }
    assert.deepEqual(result.decisions, expectedDecisions);
    for (const decision of result.decisions) {
      keys(decision, ['nodeId', 'prefix', 'included', 'declaration']); assert.equal(result.scene.objects.some(object => object.id === decision.nodeId), decision.included);
    }
    for (const declaration of result.ast.declarations.filter(declaration => declaration.kind === 'object'))
      assert.equal(fixture.source.slice(declaration.id.range.start, declaration.id.range.end), declaration.id.text);
    for (let index = 1; index < result.ast.declarations.length; index++) assert.ok(result.ast.declarations[index - 1].range.start <= result.ast.declarations[index].range.start);
    const sourceReferences = [...fixture.source.matchAll(/\$([A-Za-z_][A-Za-z0-9_-]*)/g)].map(match => ({ name: match[1], span: range(fixture.source, match.index, match.index + match[0].length) }));
    for (const parameter of result.parameters) {
      keys(parameter, ['name', 'quantity', 'unit', 'value', 'definition', 'uses']);
      const expected = sourceReferences.filter(ref => ref.name === parameter.name).map(ref => ref.span).sort((a, b) => a.start - b.start);
      assert.deepEqual([...parameter.uses].sort((a, b) => a.start - b.start), expected);
    }
    if (fixture.source === original || fixture.source === restored) {
      assert.deepEqual(result.scene.objects[0].translate, [-2, 0, 0]); assert.equal(result.scene.objects[0].radius, 1); assert.equal(result.scene.objects[1].radius, 2);
    }
    if (fixture.name === 'edit_false_keeps_public_rules') assert.equal(result.ast.rules.filter(rule => rule.selector.text === '#optional_0').length, 2);
    if (fixture.name === 'equality_original_negative_zero_false') {
      assert.equal(result.ast.declarations.find(declaration => declaration.kind === 'parameter' && declaration.name.text === 'used').literal.text, '-0');
      assert.ok(Object.is(result.parameters.find(parameter => parameter.name === 'used').value, 0));
    }
    if (fixture.name === 'independent_work4084') assert.equal(result.parameters.reduce((sum, parameter) => sum + parameter.uses.length, 0), 2 + 12 * 88);
    independent(result.ast, result.decisions); independent(result.ast, result.scene); independent(result.parameters, result.decisions);
    for (const earlier of retained) independent(result, earlier.result);
    const prefix = resolve(output, provider.label + '.' + fixture.name), sourcePath = prefix + '.source2.css', manualPath = prefix + '.manual.css', resultPath = prefix + '.result.json';
    const files = [await save(sourcePath, fixture.source), await save(manualPath, fixture.manual), await save(resultPath, signed(result) + '\n'),
      await save(prefix + '.ast.json', signed(result.ast) + '\n'), await save(prefix + '.decisions.json', signed(result.decisions) + '\n'),
      await save(prefix + '.vertex.glsl', result.shaders.vertex), await save(prefix + '.fragment.glsl', result.shaders.fragment)];
    const record = { provider: provider.label, name: fixture.name, sourcePath, manualPath, resultPath, files, digest: hash(signed(result)), objects: result.scene.objects.length, included: fixture.included };
    records.push(record); coldCases.push(record); retained.push({ result, digest: record.digest, files }); accepted++;
  }
  assert.deepEqual(retained[0].result, retained[2].result); assert.notStrictEqual(retained[0].result, retained[2].result);
  assert.deepEqual(retained[0].result.scene.objects[0], retained[1].result.scene.objects[0]);
  const oldProfiles = [
    ['compileParameterizedAffineSceneSource', 'barocss-gpu-parameterized-affine-scene-ast', 'source2-typed-literal-parameters-v0'],
    ['compileMultiplicativeAffineSceneSource', 'barocss-gpu-multiplicative-affine-scene-ast', 'source2-typed-product-coefficients-v0'],
    ['compileArithmeticAffineSceneSource', 'barocss-gpu-arithmetic-affine-scene-ast', 'source2-typed-flat-arithmetic-coefficients-v0'],
    ['compileFiniteRepeatAffineSceneSource', 'barocss-gpu-finite-repeat-affine-scene-ast', 'source2-typed-finite-repeat-coefficients-v0'],
  ];
  const compatible = '@scene compatible {version:2;@param extent:length(1scene);sphere #one;}sphere{radius:$extent;}';
  const ordinaryControl = gpu.compileConditionalAffineSceneSource(compatible);
  for (const [name, schema, profile] of oldProfiles) {
    const prior = gpu[name](compatible); assert.equal(prior.ast.schema, schema); assert.equal(prior.profile, profile); assert.deepEqual(prior.scene, ordinaryControl.scene); assert.deepEqual(prior.shaders, ordinaryControl.shaders);
    let error; try { gpu[name](original); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'SYNTAX');
    const start = original.indexOf('@when') + 1; assert.equal(error.diagnostics[0].start, start); assert.equal(error.diagnostics[0].end, start + 4); refused++;
  }
  const repeatControl = gpu.compileFiniteRepeatAffineSceneSource('@scene repeat {version:2;@repeat row:sphere(2);}');
  assert.deepEqual(repeatControl.scene.objects.map(object => object.id), ['row_0', 'row_1']);
  const predicate = (relation, tail = '') => simple('bad', 'sphere #anchor;@when optional:sphere(' + relation + ');', tail);
  const checks = [
    { name: 'unknown_left_reference', source: predicate('$missing < $limit'), code: 'TYPE' },
    { name: 'unknown_right_reference_even_false', source: predicate('$limit < $missing'), code: 'TYPE' },
    { name: 'mixed_quantity', source: simple('bad', '@when optional:sphere($used < $limit);', '', '@param used:length(1scene);@param limit:scalar(2);'), code: 'TYPE' },
    { name: 'literal_operand', source: predicate('1 < $limit'), code: 'SYNTAX' },
    { name: 'compact_comparison', source: predicate('$used<$limit'), code: 'SYNTAX' },
    { name: 'missing_left_separation', source: predicate('$used< $limit'), code: 'SYNTAX' },
    { name: 'unsupported_greater', source: predicate('$used > $limit'), code: 'SYNTAX' },
    { name: 'unsupported_less_equal', source: predicate('$used <= $limit'), code: 'SYNTAX' },
    { name: 'unsupported_equality', source: predicate('$used == $limit'), code: 'SYNTAX' },
    { name: 'arithmetic_predicate', source: predicate('calc($used + $limit) < $limit'), code: 'SYNTAX' },
    { name: 'nested_condition', source: predicate('($used < $limit)'), code: 'SYNTAX' },
    { name: 'unknown_shape', source: predicate('$used < $limit').replace('optional:sphere', 'optional:triangle'), code: 'TYPE' },
    { name: 'invalid_prefix', source: predicate('$used < $limit').replace('optional:sphere', '9bad:sphere'), code: 'SYNTAX' },
    { name: 'duplicate_false_prefix', source: simple('bad', '@when optional:sphere($limit < $used);@when optional:box($limit < $used);'), code: 'TYPE' },
    { name: 'false_potential_explicit_collision', source: simple('bad', 'sphere #optional_0;@when optional:sphere($limit < $used);'), code: 'TYPE' },
    { name: 'unknown_noncandidate_selector', source: predicate('$limit < $used', '#unrelated{radius:1;}'), code: 'SCENE' },
    { name: 'false_invalid_radius', source: predicate('$limit < $used', '#optional_0{radius:-1;}'), code: 'SCENE' },
    { name: 'false_invalid_capsule_relationship', source: predicate('$limit < $used', '#optional_0{start:0 0 0;end:0 0 0;}').replace('optional:sphere', 'optional:capsule'), code: 'SCENE' },
    { name: 'false_invalid_torus_relationship', source: predicate('$limit < $used', '#optional_0{major-radius:1;minor-radius:2;}').replace('optional:sphere', 'optional:torus'), code: 'SCENE' },
    { name: 'false_wrong_style_quantity', source: predicate('$limit < $used', '#optional_0{rotate-y:$used;}'), code: 'TYPE' },
    { name: 'later_parameter', source: simple('bad', '@when optional:sphere($used < $limit);@param late:scalar(1);'), code: 'SYNTAX' },
    { name: 'conditional_in_style', source: simple('bad', 'sphere #anchor;', 'sphere{@when optional:sphere($used < $limit);}'), code: 'SYNTAX' },
    { name: 'no_implicit_repeat', source: simple('bad', '@repeat row:sphere(2);'), code: 'SYNTAX' },
    { name: 'ninth_predicate', source: eight.replace('}', '@when ninth:sphere($used < $limit);}'), code: 'BUDGET' },
    { name: 'potential33_despite_false', source: maxPotential.replace('sphere #plain_0;', 'sphere #extra;sphere #plain_0;'), code: 'BUDGET' },
    { name: 'independent_work4130', source: work4130, code: 'BUDGET' },
    { name: 'original_UTF8_source_cap', source: '/*' + 'é'.repeat(33000) + '*/' + original, code: 'BUDGET' },
  ];
  async function retention() {
    assert.equal(getters, 0);
    for (const item of retained) { assert.equal(hash(signed(item.result)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); }
  }
  for (const fixture of checks) {
    let error; try { gpu.compileConditionalAffineSceneSource(fixture.source); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError, fixture.name); assert.equal(error.code, fixture.code, fixture.name); frozen(error.diagnostics);
    const diagnostic = error.diagnostics[0]; keys(diagnostic, ['code', 'message', 'start', 'end', 'line', 'column']); assert.ok(error.message.length <= 1024); assert.ok(diagnostic.message.length <= 1024);
    assert.deepEqual({ start: diagnostic.start, end: diagnostic.end, line: diagnostic.line, column: diagnostic.column }, range(fixture.source, diagnostic.start, diagnostic.end));
    if (fixture.code === 'SCENE') assert.ok(error.cause instanceof gpu.SceneError, fixture.name); else assert.equal(Object.hasOwn(error, 'cause'), false, fixture.name);
    failures.push({ name: fixture.name, code: error.code, diagnostic, causeName: error.cause?.name ?? null, file: await save(resolve(output, provider.label + '.refused.' + fixture.name + '.css'), fixture.source) });
    refused++; await retention();
  }
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('No source coercion'); } });
  for (const value of [object, JSON.parse(signed(retained[0].result.ast)), null]) {
    let error; try { gpu.compileConditionalAffineSceneSource(value); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.SceneParameterSourceError); assert.equal(error.code, 'INPUT'); assert.equal(Object.hasOwn(error, 'cause'), false); refused++; await retention();
  }
  rows.push({ provider: provider.label, records, failures, oldProfilesAndRepeatRetained: true, independentWork: { admitted: 4084, refused: 4130, referenceUses: 1058 } });
}
assert.ok(accepted >= 20); assert.ok(refused >= 40);
for (let index = 0; index < cases.length; index++) assert.equal(rows[0].records[index].digest, rows[1].records[index].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=value=>createHash('sha256').update(value).digest('hex');
function signed(value){if(typeof value==='number'){assert.ok(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}if(value===null||typeof value!=='object')return JSON.stringify(value);return Array.isArray(value)?'['+value.map(signed).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+signed(value[key])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const fixture of cfg.cases.filter(fixture=>fixture.provider===provider.label)){for(const file of fixture.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(fixture.sourcePath,'utf8'),result=gpu.compileConditionalAffineSceneSource(source),manual=gpu.compileArithmeticAffineSceneSource(readFileSync(fixture.manualPath,'utf8'));assert.equal(result.source,source);assert.equal(hash(signed(result)),fixture.digest);assert.deepEqual(result,JSON.parse(readFileSync(fixture.resultPath,'utf8')));assert.deepEqual(result.scene,manual.scene);assert.deepEqual(result.shaders,manual.shaders);assert.deepEqual(result.decisions.map(decision=>decision.included),fixture.included);rows.push({provider:provider.label,name:fixture.name,digest:fixture.digest,objects:result.scene.objects.length});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'complete original source only; result files are expected observations',actualGL:false}));`;
const coldPath = resolve(output, 'cold-authored-conditionals.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' });
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, cases.length * providers.length);
const report = { issue: 1482, stage: 'SCENE2_TYPED_CONDITIONAL_OBJECT_SOURCE_CPU', parent, node: process.version, accepted, refused, getters, namespaceCount: namespace.length,
  namespace, parentRuntime, sourceGraph, rows, cold, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), newTypes,
  oldPublicTypesAndSignaturesPreserved: true, oldManifestAndBarrelPrefixPreserved: true, unchangedSemanticAndShaderProviders: true,
  independentWork: 'Original potential AST + typed parameters + eleven-token condition + predicate/provenance/reference work + exact active-view work:36+46R;88=4084;89=4130. Both condition operands count even when false.',
  providerStages: 'ONE masked parse; TWO unchanged lowerAffineSceneAst calls selected by contract: validate all potential candidates, then lower selected private view. Static pipeline contract, not runtime instrumentation.',
  actualGL: false, consumerPresentation: false, physicalUnitConversion: false,
  support: 'Strict same-quantity original-parameter comparison controls stable PREFIX_0 inclusion. All potential/false shapes and styles validate; authored AST retains every declaration/rule/decision. Independent manual Scene2/shader controls and complete-source cold reconstruction. No repeat widening, dynamic loop, native CAD/TEN/frame/renderer/pixels/history/publication.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1482, accepted, refused, getters, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
