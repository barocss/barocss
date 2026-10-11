/** #1498 ONE discrete source/whole-IR/GLSL-text/file/cold qualifier.
 * Node22 after GPU build: node examples/gpu-scene/material-discrete-selection-flow.mjs --output ABS_FRESH
 * Structural strict< selection only; no discrete evaluator, linked shader or pixels.
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
const parent = 'c6ed2f7618cfbb9ab4aba0c329993c245e1c420e', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8')), hash = value => createHash('sha256').update(value).digest('hex');
const parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const oldBarrel = parentFile('src/index.ts'), barrelAST = ts.createSourceFile('parent-barrel.ts', oldBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = barrelAST.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause))
  .flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort();
assert.equal(new Set(parentRuntime).size, parentRuntime.length); assert.equal(parentRuntime.length, 141);
const ordinary = resolve(output, 'ordinary-public.mjs');
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundled.metafile.inputs); assert.ok(sourceGraph.some(path => path.endsWith('/src/mesh-material.ts')));
assert.ok(!sourceGraph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)));
const internalSourcePath = resolve(output, 'ordinary-internal-material.mjs');
await build({ entryPoints: [resolve(pkg, 'src/mesh-material.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: internalSourcePath });
const providers = [{ label: 'ordinary-source', path: ordinary, internalPath: internalSourcePath },
  { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import), internalPath: resolve(pkg, 'dist/mesh-material.js') }];
for (const provider of providers) { provider.gpu = await import(pathToFileURL(provider.path).href); provider.internal = await import(pathToFileURL(provider.internalPath).href); }
const namespace = Object.keys(providers[0].gpu).sort(), additions = ['compileDiscreteMeshMaterial', 'validateDiscreteMeshMaterialIR', 'lowerDiscreteMeshMaterial'];
assert.deepEqual(namespace, [...parentRuntime, ...additions].sort()); assert.equal(namespace.length, 144); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel)); assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));
for (const leaf of ['material-evaluation.ts', 'mesh-shaders.ts', 'native-surface-uv01-binding.ts']) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));
const parentFolder = resolve(output, 'fixed-parent-material'); await mkdir(parentFolder);
const parentLeaf = resolve(parentFolder, 'mesh-material.ts'); await writeFile(parentLeaf, parentFile('src/mesh-material.ts'), { flag: 'wx' });
const program = ts.createProgram([parentLeaf], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], strict: true, skipLibCheck: true, declaration: true, emitDeclarationOnly: true, outDir: parentFolder });
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => repo, getCanonicalFileName: value => value, getNewLine: () => '\n' }));
assert.equal(program.emit().emitSkipped, false);
const printer = ts.createPrinter({ removeComments: true });
function exportedDeclarations(text) {
  const file = ts.createSourceFile('material.d.ts', text, ts.ScriptTarget.Latest, true);
  return Object.fromEntries(file.statements.filter(node => node.name && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
    .map(node => [node.name.text, printer.printNode(ts.EmitHint.Unspecified, node, file)]));
}
const parentDTS = await readFile(resolve(parentFolder, 'mesh-material.d.ts'), 'utf8'), currentDTS = await readFile(resolve(pkg, 'dist/mesh-material.d.ts'), 'utf8');
const oldDeclarations = exportedDeclarations(parentDTS), currentDeclarations = exportedDeclarations(currentDTS);
for (const [name, declaration] of Object.entries(oldDeclarations)) assert.equal(currentDeclarations[name], declaration, name);
const newTypes = ['DiscreteMeshMaterialExpression', 'DiscreteMeshMaterialIR', 'LoweredDiscreteMeshMaterial'];
assert.deepEqual(Object.keys(currentDeclarations).filter(name => !Object.hasOwn(oldDeclarations, name)).sort(), [...additions, ...newTypes].sort());
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8');
for (const name of newTypes) assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS));
assert.ok(!namespace.includes('validateMeshMaterialBinding')); assert.ok(!/\bvalidateMeshMaterialBinding\b/.test(publicDTS));
const parentModulePath = resolve(parentFolder, 'mesh-material.mjs');
await build({ entryPoints: [parentLeaf], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: parentModulePath });
const parentMaterial = await import(pathToFileURL(parentModulePath).href);
function signed(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return Array.isArray(value) ? '[' + value.map(signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}';
}
const clone = value => JSON.parse(signed(value));
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, seen = new Set()) { if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); Object.values(value).forEach(child => refs(child, seen)); } return seen; }
function independent(left, right) { const rightRefs = refs(right); for (const ref of refs(left)) assert.ok(!rightRefs.has(ref)); }
function keys(value, names) { assert.deepEqual(Object.keys(value).sort(), [...names].sort()); }
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const float = value => ({ kind: 'float', type: 'float', value: value === 0 ? 0 : value });
const uniform = name => ({ kind: 'uniform', type: 'float', name });
const unary = (operator, value) => ({ kind: 'unary', type: 'float', operator, value });
function color(authored) {
  const hex = (authored.length === 4 ? '#' + [...authored.slice(1)].map(digit => digit + digit).join('') : authored).toUpperCase();
  return { kind: 'color', type: 'color', hex, linear: [1, 3, 5].map(index => Math.pow(parseInt(hex.slice(index, index + 2), 16) / 255, 2.2)) };
}
const call = (name, type, args) => ({ kind: 'call', type, name, args });
const selection = (value, threshold, below, otherwise) => ({ kind: 'select', type: below.type, value, threshold: float(threshold), below, otherwise });
const mix = value => call('mix', 'color', [color('#000'), color('#fff'), value]);
const a = uniform('amount'), black = color('#000'), white = color('#fff'), red = color('#f00'), blue = color('#00f');
const metadata = (min, max, value) => [{ name: 'amount', type: 'float', min, max, default: value }];
const head = '@uniform amount:float(0,1,.25);', signedHead = '@uniform amount:float(-1,1,-0);';
const source = (expression, declarations = head) => '// Original selection é😀\r\n@shader #bands { ' + declarations + ' @fragment { color:' + expression + '; } }\r\n';
const localChoice = selection(a, .5, black, white);
const tintChoice = value => selection(value, 0, red, blue);
const fixtures = [
  { name: 'uniform_color_bands', source: source('select(amount,.5,#000,#fff)'), uniforms: metadata(0, 1, .25), expression: selection(a, .5, black, white) },
  { name: 'scalar_bands_in_color', source: source('mix(#000,#fff,select(amount,.5,0,1))'), uniforms: metadata(0, 1, .25), expression: mix(selection(a, .5, float(0), float(1))) },
  { name: 'literal_equality_keeps_otherwise', source: source('select(.5,.5,#f00,#00f)', ''), uniforms: [], expression: selection(float(.5), .5, red, blue) },
  { name: 'negative_literal_threshold', source: source('select(amount,-.25,#f00,#00f)', signedHead), uniforms: metadata(-1, 1, 0), expression: selection(a, -.25, red, blue) },
  { name: 'signed_zero_threshold', source: source('select(-0,-0,#000,#fff)', ''), uniforms: [], expression: selection(unary('-', float(0)), 0, black, white) },
  { name: 'nested_scalar_builtins', source: source('mix(#000,#fff,select(sin(amount),-.25,clamp(amount,0,1),clamp(cos(amount),0,1)))', signedHead), uniforms: metadata(-1, 1, 0),
    expression: mix(selection(call('sin', 'float', [a]), -.25, call('clamp', 'float', [a, float(0), float(1)]), call('clamp', 'float', [call('cos', 'float', [a]), float(0), float(1)]))) },
  { name: 'nested_color_selection', source: source('select(amount,.5,select(amount,.25,#000,#f00),#00f)'), uniforms: metadata(0, 1, .25), expression: selection(a, .5, selection(a, .25, black, red), blue) },
  { name: 'pure_float_function', source: source('mix(#000,#fff,gate(amount))', head + '@fn gate(t:float(0,1)):float(select(t,.5,0,1));'), uniforms: metadata(0, 1, .25), expression: mix(selection(a, .5, float(0), float(1))) },
  { name: 'color_function_and_local', source: source('mix(shade,tint(-.25),.5)', signedHead + '@fn tint(t:float(-1,1)):color(select(t,-0,#f00,#00f));@let shade:color(tint(amount));'), uniforms: metadata(-1, 1, 0),
    expression: call('mix', 'color', [tintChoice(a), tintChoice(unary('-', float(.25))), float(.5)]) },
  { name: 'local_select_independent_copies', source: source('mix(choice,choice,.5)', head + '@let choice:color(select(amount,.5,#000,#fff));'), uniforms: metadata(0, 1, .25),
    expression: call('mix', 'color', [localChoice, clone(localChoice), float(.5)]) },
  { name: 'step_function_remains_available', source: source('mix(#000,#fff,step(amount))', head + '@fn step(t:float(0,1)):float(select(t,.5,0,1));'), uniforms: metadata(0, 1, .25), expression: mix(selection(a, .5, float(0), float(1))) },
];
/** Independent text oracle over the separately authored expected trees; it never reads actual IR. */
function expectedLower(expression, uniforms) {
  const layout = uniforms.map((entry, index) => ({ ...entry, glslName: 'mat_u_' + index }));
  const lower = node => {
    if (node.kind === 'float') return node.value.toPrecision(17);
    if (node.kind === 'color') return 'vec3(' + node.linear.map(value => value.toPrecision(17)).join(',') + ')';
    if (node.kind === 'uniform') return layout.find(entry => entry.name === node.name).glslName;
    if (node.kind === 'unary') return '(' + node.operator + lower(node.value) + ')';
    if (node.kind === 'select') return '(' + lower(node.value) + '<' + lower(node.threshold) + '?' + lower(node.below) + ':' + lower(node.otherwise) + ')';
    assert.equal(node.kind, 'call'); const args = node.args.map(lower); if (node.name === 'mix') args[2] = 'clamp(' + args[2] + ',0.0,1.0)';
    return node.name + '(' + args.join(',') + ')';
  };
  return { expression: 'clamp(' + lower(expression) + ',vec3(0.0),vec3(1.0))', uniformDeclarations: layout.map(entry => 'uniform float ' + entry.glslName + ';').join('\n'), uniformLayout: layout };
}
function selectNodes(node, out = []) {
  if (node.kind === 'select') { out.push(node); selectNodes(node.value, out); selectNodes(node.threshold, out); selectNodes(node.below, out); selectNodes(node.otherwise, out); }
  else if (node.kind === 'unary') selectNodes(node.value, out);
  else if (node.kind === 'binary') { selectNodes(node.left, out); selectNodes(node.right, out); }
  else if (node.kind === 'call') node.args.forEach(child => selectNodes(child, out));
  return out;
}
const balanced = depth => depth ? '(' + balanced(depth - 1) + '+' + balanced(depth - 1) + ')' : '.001';
let accepted = 0, refused = 0, getters = 0, reflections = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const fixture of fixtures) {
    const compiled = gpu.compileDiscreteMeshMaterial(fixture.source); assert.equal(compiled.ok, true, fixture.name + ':' + JSON.stringify(compiled));
    const ir = compiled.material, input = clone(ir), before = signed(input), reconstructed = gpu.validateDiscreteMeshMaterialIR(input), lowered = gpu.lowerDiscreteMeshMaterial(ir);
    keys(ir, ['format', 'version', 'profile', 'source', 'shaderId', 'uniforms', 'expression']);
    assert.equal(ir.format, 'barocss-gpu-discrete-mesh-material'); assert.equal(ir.version, 0); assert.equal(ir.profile, 'mesh-opaque-discrete-fragment-v0');
    assert.equal(ir.source, fixture.source); assert.equal(ir.shaderId, 'bands'); assert.deepEqual(ir.uniforms, fixture.uniforms); assert.deepEqual(ir.expression, fixture.expression);
    assert.deepEqual(reconstructed, ir); assert.equal(signed(input), before); assert.equal(Object.isFrozen(input), false); independent(ir, reconstructed); independent(input, reconstructed);
    keys(lowered, ['expression', 'uniformDeclarations', 'uniformLayout']); assert.deepEqual(lowered, expectedLower(fixture.expression, fixture.uniforms));
    frozen(ir); frozen(reconstructed); frozen(lowered); independent(lowered, ir);
    for (const node of selectNodes(ir.expression)) {
      keys(node, ['kind', 'type', 'value', 'threshold', 'below', 'otherwise']); assert.equal(node.threshold.kind, 'float'); assert.equal(node.below.type, node.otherwise.type);
      assert.equal(node.type, node.below.type); assert.notStrictEqual(node.below, node.otherwise);
    }
    assert.ok(lowered.expression.includes('<')); assert.ok(lowered.expression.includes('?')); assert.ok(!lowered.expression.includes('<=') && !/\bselect\s*\(/.test(lowered.expression));
    if (fixture.name === 'literal_equality_keeps_otherwise') { assert.equal(ir.expression.value.value, .5); assert.equal(ir.expression.threshold.value, .5); assert.equal(.5 < .5, false); assert.deepEqual(ir.expression.below, red); assert.deepEqual(ir.expression.otherwise, blue); }
    if (fixture.name === 'signed_zero_threshold') { assert.ok(Object.is(ir.expression.threshold.value, +0)); assert.ok(ir.source.includes('select(-0,-0')); }
    if (fixture.name === 'local_select_independent_copies') independent(ir.expression.args[0], ir.expression.args[1]);
    for (const earlier of retained) independent(ir, earlier.ir);
    const prefix = resolve(output, provider.label + '.' + fixture.name), sourcePath = prefix + '.source.css', irPath = prefix + '.ir.json', lowerPath = prefix + '.lower.json';
    const files = [await save(sourcePath, fixture.source), await save(irPath, signed(ir) + '\n'), await save(lowerPath, signed(lowered) + '\n'),
      await save(prefix + '.expression.glsl', lowered.expression), await save(prefix + '.uniforms.glsl', lowered.uniformDeclarations),
      await save(prefix + '.independent-expected.json', signed({ expression: fixture.expression, uniforms: fixture.uniforms, lowered: expectedLower(fixture.expression, fixture.uniforms) }) + '\n')];
    const record = { provider: provider.label, name: fixture.name, sourcePath, irPath, lowerPath, files, irSHA: hash(signed(ir)), lowerSHA: hash(signed(lowered)), selectCount: selectNodes(ir.expression).length };
    records.push(record); coldCases.push(record); retained.push({ ir, digest: record.irSHA, files }); accepted++;
  }
  async function retention() {
    assert.equal(getters, 0);
    for (const item of retained) { assert.equal(hash(signed(item.ir)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); }
  }
  const checks = [
    ['threshold_reference', source('select(amount,amount,#000,#fff)'), 'SYNTAX'],
    ['threshold_computed', source('select(amount,.5+.1,#000,#fff)'), 'SYNTAX'],
    ['threshold_parenthesized', source('select(amount,(.5),#000,#fff)'), 'SYNTAX'],
    ['missing_fourth_argument', source('select(amount,.5,#000)'), 'SYNTAX'],
    ['selector_not_float', source('select(#000,.5,#000,#fff)', ''), 'TYPE', 'select'],
    ['branch_type_mismatch', source('select(amount,.5,#000,1)'), 'TYPE', 'select'],
    ['unreachable_unknown_branch', source('select(-1,0,#000,missing)', ''), 'TYPE'],
    ['unreachable_intermediate_range', source('select(-1,0,#000,mix(#000,#fff,1000*1000*2))', ''), 'RANGE'],
    ['joined_scalar_range_not_folded', source('mix(#000,#fff,only(select(-1,0,0,2)))', '@fn only(t:float(0,1)):float(t);'), 'RANGE'],
    ['unreachable_work_charged', source('select(-1,0,#000,mix(#000,#fff,' + balanced(7) + '))', ''), 'BUDGET'],
    ['unreachable_parse_depth', source('select(-1,0,#000,' + '('.repeat(18) + '#fff' + ')'.repeat(18) + ')', ''), 'BUDGET'],
    ['new_uniform_select_reserved', source('#fff', '@uniform select:float(0,1,.5);'), 'TYPE'],
    ['new_function_select_reserved', source('#fff', '@fn select(t:float(0,1)):float(t);'), 'TYPE'],
    ['new_parameter_select_reserved', source('#fff', '@fn gate(select:float(0,1)):float(select);'), 'TYPE'],
    ['new_local_select_reserved', source('#fff', '@let select:color(#fff);'), 'TYPE'],
    ['coordinate_input_absent', source('select(uv_u,.5,#000,#fff)', ''), 'TYPE'],
    ['repeating_intrinsic_absent', source('select(amount,.5,#000,mix(#000,#fff,fract(amount)))'), 'SYNTAX'],
  ];
  for (const [name, authored, code, anchor] of checks) {
    const result = gpu.compileDiscreteMeshMaterial(authored); assert.equal(result.ok, false, name); frozen(result.diagnostics);
    const diagnostic = result.diagnostics[0]; keys(diagnostic, ['code', 'message', 'start', 'end']); assert.equal(diagnostic.code, code, name); assert.ok(diagnostic.message.length <= 1024);
    assert.ok(diagnostic.start >= 0 && diagnostic.end <= authored.length && diagnostic.end >= diagnostic.start);
    if (anchor) { const start = authored.indexOf(anchor + '('); assert.equal(diagnostic.start, start, name); assert.equal(diagnostic.end, start + anchor.length, name); }
    failures.push({ name, diagnostic, file: await save(resolve(output, provider.label + '.refused.' + name + '.css'), authored) }); refused++; await retention();
  }
  const ir = retained[0].ir, forged = clone(ir); forged.expression.threshold.value = .75;
  const wrongProfile = clone(ir); wrongProfile.format = 'barocss-gpu-mesh-material'; wrongProfile.profile = 'mesh-opaque-fragment-v0';
  const foreignInput = clone(ir); foreignInput.expression.value = { kind: 'input', type: 'float', name: 'surface_u01' };
  const malformed = clone(ir); malformed.source = source('select(amount,(.5),#000,#fff)');
  for (const method of ['validateDiscreteMeshMaterialIR', 'lowerDiscreteMeshMaterial']) {
    for (const [name, input] of [['forged_threshold', forged], ['wrong_profile', wrongProfile], ['forged_native_input', foreignInput], ['malformed_original_source', malformed]]) {
      let error; try { gpu[method](input); } catch (caught) { error = caught; }
      assert.ok(error instanceof gpu.MeshMaterialError, name); assert.equal(error.code, 'IR', name);
      if (name === 'malformed_original_source') {
        const expected = gpu.compileDiscreteMeshMaterial(malformed.source); assert.equal(expected.ok, false); assert.deepEqual(error.cause, expected.diagnostics[0]); frozen(error.cause);
        assert.equal(error.start, expected.diagnostics[0].start); assert.equal(error.end, expected.diagnostics[0].end);
      } else assert.equal(Object.hasOwn(error, 'cause'), false, name);
      failures.push({ name: method + '.' + name, code: error.code, start: error.start, end: error.end, reconstructionDiagnostic: error.cause ?? null }); refused++; await retention();
    }
    const getter = clone(ir); Object.defineProperty(getter, 'source', { enumerable: true, get() { getters++; return ir.source; } });
    let getterError; try { gpu[method](getter); } catch (caught) { getterError = caught; }
    assert.ok(getterError instanceof gpu.MeshMaterialError); assert.equal(getterError.code, 'INPUT'); assert.equal(Object.hasOwn(getterError, 'cause'), false);
    failures.push({ name: method + '.getter_not_invoked', code: getterError.code }); refused++; await retention();
    for (const operation of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) {
      for (const causeKind of ['same_public_error', 'undefined']) {
        const marker = causeKind === 'undefined' ? undefined : new gpu.MeshMaterialError('UNIFORM', 'Caller reflective sentinel', 17, 29);
        const proxy = new Proxy(clone(ir), { [operation]() { reflections++; throw marker; } });
        let error; try { gpu[method](proxy); } catch (caught) { error = caught; }
        assert.ok(error instanceof gpu.MeshMaterialError); assert.equal(error.code, 'INPUT'); assert.notStrictEqual(error, marker); assert.equal(error.start, 0); assert.equal(error.end, 0); assert.ok(error.message.length <= 1024);
        const cause = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(cause && 'value' in cause); assert.strictEqual(cause.value, marker);
        failures.push({ name: method + '.' + operation + '.' + causeKind, code: error.code, ownExactCause: true, start: error.start, end: error.end }); refused++; await retention();
      }
    }
  }
  const legacySource = '@shader #legacy { @fn select(s:float(0,1)):float(s);@fn step(t:float(0,1)):float(t);@let picked:float(select(.25));@fragment{color:mix(#000,#fff,step(picked));}}';
  const oldProfiles = [
    ['compileMeshMaterial', 'validateMeshMaterialIR', 'lowerMeshMaterial'],
    ['compileEngineUVMaterial', 'validateEngineUVMaterialIR', 'lowerEngineUVMaterial'],
    ['compileEngineUVRepeatingMaterial', 'validateEngineUVRepeatingMaterialIR', 'lowerEngineUVRepeatingMaterial'],
    ['compileNativeSurfaceUV01Material', 'validateNativeSurfaceUV01MaterialIR', 'lowerNativeSurfaceUV01Material'],
  ];
  const oldControls = [];
  for (const [compile, validate, lower] of oldProfiles) {
    const actual = gpu[compile](legacySource), baseline = parentMaterial[compile](legacySource); assert.equal(actual.ok, true); assert.deepEqual(actual, baseline);
    assert.deepEqual(actual.material.expression, mix(float(.25))); assert.deepEqual(gpu[lower](actual.material), parentMaterial[lower](baseline.material));
    const unsupported = gpu[compile](fixtures[0].source); assert.equal(unsupported.ok, false); assert.equal(unsupported.diagnostics[0].code, 'SYNTAX');
    let error; try { gpu[validate](clone(ir)); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.MeshMaterialError); assert.equal(error.code, 'IR'); refused++;
    const prefix = resolve(output, provider.label + '.old.' + compile);
    oldControls.push({ compile, oldNamedSelectAndStepPreserved: true, negativeDiscreteCode: error.code, files: [await save(prefix + '.css', legacySource), await save(prefix + '.ir.json', signed(actual.material) + '\n')] });
    await retention();
  }
  let bindingError; try { provider.internal.validateMeshMaterialBinding({ material: clone(ir), uniforms: {} }); } catch (caught) { bindingError = caught; }
  assert.ok(bindingError instanceof provider.internal.MeshMaterialError); assert.equal(bindingError.code, 'IR'); refused++; await retention();
  let evaluationError; try { gpu.evaluateAuthoredMaterial({ material: clone(ir), uniforms: {} }); } catch (caught) { evaluationError = caught; }
  assert.ok(evaluationError instanceof gpu.AuthoredMaterialEvaluationError); assert.equal(evaluationError.code, 'PROFILE'); refused++; await retention();
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('No source coercion'); } });
  for (const input of [object, null]) { const result = gpu.compileDiscreteMeshMaterial(input); assert.equal(result.ok, false); assert.equal(result.diagnostics[0].code, 'INPUT'); frozen(result.diagnostics); refused++; await retention(); }
  rows.push({ provider: provider.label, records, failures, oldControls,
    internalBindingControl: { publicBarrelExport: false, path: provider.internalPath, refusal: bindingError.code, ownInternalClass: true },
    existingEvaluatorRejection: evaluationError.code, noDiscreteCPUColorSample: true });
}
for (let index = 0; index < fixtures.length; index++) { assert.equal(rows[0].records[index].irSHA, rows[1].records[index].irSHA); assert.equal(rows[0].records[index].lowerSHA, rows[1].records[index].lowerSHA); }
assert.equal(reflections, 24); assert.equal(getters, 0);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=value=>createHash('sha256').update(value).digest('hex');
function signed(value){if(typeof value==='number'){assert.ok(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}if(value===null||typeof value!=='object')return JSON.stringify(value);return Array.isArray(value)?'['+value.map(signed).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+signed(value[key])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const fixture of cfg.cases.filter(fixture=>fixture.provider===provider.label)){for(const file of fixture.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(fixture.sourcePath,'utf8'),compiled=gpu.compileDiscreteMeshMaterial(source);assert.equal(compiled.ok,true);const material=compiled.material,lowered=gpu.lowerDiscreteMeshMaterial(material);assert.equal(material.source,source);assert.equal(hash(signed(material)),fixture.irSHA);assert.equal(hash(signed(lowered)),fixture.lowerSHA);assert.deepEqual(material,JSON.parse(readFileSync(fixture.irPath,'utf8')));assert.deepEqual(lowered,JSON.parse(readFileSync(fixture.lowerPath,'utf8')));rows.push({provider:provider.label,name:fixture.name,irSHA:fixture.irSHA,lowerSHA:fixture.lowerSHA});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'whole original source only; saved IR/GLSL are observations',actualGL:false,discreteEvaluator:false}));`;
const coldPath = resolve(output, 'cold-discrete-source.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' }); await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' });
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, fixtures.length * providers.length);
const report = { issue: 1498, stage: 'DISCRETE_MESH_MATERIAL_SOURCE_IR_GLSL_TEXT_CPU', parent, node: process.version, accepted, refused, getters, reflections,
  namespaceCount: namespace.length, namespace, parentRuntime, newTypes, sourceGraph, rows, cold, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path),
  declarationCompatibility: { oldExportedMaterialDeclarationsPreserved: true, oldNames: Object.keys(oldDeclarations), additions: [...additions, ...newTypes], privateAliasesExcludedFromByteEquality: true, parentDTS: await receipt(resolve(parentFolder, 'mesh-material.d.ts')), currentDTS: await receipt(resolve(pkg, 'dist/mesh-material.d.ts')) },
  strictSelectionEvidence: 'Independent canonical trees and parenthesized strict< GLSL ternaries retain both branches, including equality literals; no constant-folded branch hides invalid type/range/work/depth.',
  actualGL: false, discreteEvaluator: false, linkedShader: false, physicalUnits: false,
  unforcedDefensiveGuards: ['validIR2MiB', 'validLowerExpressionOrDeclarations64KiB', 'validWholeLowered128KiB'],
  support: 'New coordinate-free discrete profile preserves whole original source/IR, typed eager branch admission, trusted ternary text, old named functions/profile surfaces, exact reflection causes and source-only cold reconstruction. No evaluator/binding/frame/native UV/pixels/consumer/document/release availability.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1498, accepted, refused, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false, discreteEvaluator: false }));
