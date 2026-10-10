/** #1331: actual public authored-material CPU evaluation and original files.
 * node examples/gpu-scene/material-evaluation-flow.mjs --output <fresh-directory>
 * No private evaluator, DOM, GL, renderer, pixel, clock or public file codec.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), at = args.indexOf('--output');
assert(at >= 0 && args[at + 1] && !args[at + 1].startsWith('--'), '--output <fresh-directory> required');
const output = resolve(args[at + 1]);
await mkdir(output, { recursive: false });
const hash = value => createHash('sha256').update(value).digest('hex');
const pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.'];
assert.equal(published.import, './dist/index.js'); assert.equal(published.types, './dist/index.d.ts');
const ordinary = resolve(output, 'ordinary-source.mjs');
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
assert(graph.some(path => path.endsWith('/src/material-evaluation.ts')));
assert(graph.some(path => path.endsWith('/src/mesh-material.ts')));
assert(!graph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)), 'No own emitted source fallback');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)],
  ['emitted-public', await import(pathToFileURL(resolve(pkg, published.import)).href)]];
assert.deepEqual(Object.keys(providers[0][1]).sort(), Object.keys(providers[1][1]).sort());
assert.equal(Object.keys(providers[0][1]).length, 102);
const declarationsPath = resolve(pkg, published.types);
const declarations = await readFile(declarationsPath, 'utf8');
for (const name of ['evaluateAuthoredMaterial', 'AuthoredMaterialEvaluationError', 'AuthoredMaterialEvaluationDiagnosticCode', 'AuthoredMaterialRequest', 'AuthoredMaterialSample'])
  assert(new RegExp('\\b' + name + '\\b').test(declarations), 'Actual public declaration: ' + name);
const evaluationDeclarationPath = resolve(pkg, 'dist/material-evaluation.d.ts');
const evaluationDeclaration = await readFile(evaluationDeclarationPath, 'utf8');
assert(/evaluateAuthoredMaterial\(input:\s*unknown\):\s*AuthoredMaterialSample/.test(evaluationDeclaration));
assert(/readonly code:\s*AuthoredMaterialEvaluationDiagnosticCode/.test(evaluationDeclaration));
assert(/uv\?:\s*never/.test(evaluationDeclaration));
assert(/linearRGB:\s*readonly \[number, number, number\]/.test(evaluationDeclaration));

// Private evidence spelling only. JSON.parse preserves explicit numeric -0.
// The product adds no serializer or persisted sample/document format.
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const clone = value => JSON.parse(originalJSON(value));
function frozen(value) { if (value && typeof value === 'object') { assert(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child); } }
function near(actual, expected, tolerance = 1e-12) { assert(Number.isFinite(actual)); assert(Math.abs(actual - expected) <= tolerance, 'Actual ' + actual + '; independent expected ' + expected); }
const grey = value => [value, value, value];
const sampleKeys = ['format', 'version', 'profile', 'colorSpace', 'uvUnit', 'source', 'material', 'uniforms', 'uv', 'linearRGB'].sort();
const shader = (id, expression, declarations = '', comment = '') => `// Original authored ${comment} π🙂\r\n@shader #${id} { ${declarations} @fragment { color:${expression}; } }\n`;
const gainSource = shader('legacy_gain', 'mix(#000000,#FFFFFF,gain)', '@uniform gain:float(-0,1,.25);', 'default and override');
const uvSource = shader('original_uv', 'mix(#000000,#FFFFFF,clamp(uv_u,0,1))', '', 'dimensionless signed UV');
const repeatSource = shader('repeating_phase', 'mix(#000000,#FFFFFF,fract(clamp(uv_u,-999,999)+phase))', '@uniform phase:float(-1,1,0);', 'bounded negative phase');
const zeroSource = shader('original_zero', 'mix(#000000,#FFFFFF,fract(uv_u*amount))', '@uniform amount:float(-0,1,-0);', 'original -0 input versus resolved +0');
const scalarOrder = .1 + (.9 - .1) * .3;
const colorOrder = Math.pow(32 / 255, 2.2) * (1 - .4) + Math.pow(64 / 255, 2.2) * .4;
assert.notEqual(scalarOrder, .1 * (1 - .3) + .9 * .3, 'Independent scalar operation-order witness');
assert.notEqual(colorOrder, Math.pow(32 / 255, 2.2) + (Math.pow(64 / 255, 2.2) - Math.pow(32 / 255, 2.2)) * .4, 'Independent color operation-order witness');
const manyUniforms = Array.from({ length: 16 }, (_, index) => '@uniform u' + index + ':float(0,1,.5);').join(' ');
const cases = [
  { name: 'legacy_defaults', kind: 'legacy', source: gainSource, uniforms: {}, resolved: { gain: .25 }, expected: grey(.25) },
  { name: 'legacy_override', kind: 'legacy', source: gainSource, uniforms: { gain: .75 }, resolved: { gain: .75 }, expected: grey(.75) },
  { name: 'legacy_original_color', kind: 'legacy', source: shader('stored_color', '#204060'), uniforms: {}, resolved: {}, expected: [32, 64, 96].map(value => Math.pow(value / 255, 2.2)) },
  { name: 'plain_uv_v_signed_u', kind: 'uv', source: shader('original_v', 'mix(#000000,#FFFFFF,clamp(uv_v,0,1))'), uniforms: {}, uv: [-0, .25], resolved: {}, expected: grey(.25) },
  { name: 'plain_uv_negative_boundary', kind: 'uv', source: uvSource, uniforms: {}, uv: [-1000, -1000], resolved: {}, expected: grey(0) },
  { name: 'plain_uv_positive_boundary', kind: 'uv', source: uvSource, uniforms: {}, uv: [1000, 1000], resolved: {}, expected: grey(1) },
  { name: 'repeat_negative_u_defaults', kind: 'repeat', source: repeatSource, uniforms: {}, uv: [-.25, 0], resolved: { phase: 0 }, expected: grey(.75) },
  { name: 'repeat_phase_override', kind: 'repeat', source: repeatSource, uniforms: { phase: .5 }, uv: [-.25, 0], resolved: { phase: .5 }, expected: grey(.25) },
  { name: 'repeat_integral_u', kind: 'repeat', source: repeatSource, uniforms: {}, uv: [2, 0], resolved: { phase: 0 }, expected: grey(0) },
  { name: 'expanded_abs_min_max', kind: 'legacy', source: shader('expanded_extrema', 'mix(#000000,#FFFFFF,clamp(min(max(abs(-.3),.1),.25),0,1))'), uniforms: {}, resolved: {}, expected: grey(.25) },
  { name: 'expanded_signed_integer_power', kind: 'legacy', source: shader('expanded_power', 'mix(#000000,#FFFFFF,clamp(pow(-.5,3)+.5,0,1))'), uniforms: {}, resolved: {}, expected: grey(.375) },
  { name: 'expanded_smoothstep', kind: 'legacy', source: shader('expanded_smooth', 'mix(#000000,#FFFFFF,smoothstep(-1,1,.5))'), uniforms: {}, resolved: {}, expected: grey(.84375) },
  { name: 'expanded_literal_division_order', kind: 'legacy', source: shader('expanded_division', 'mix(#000000,#FFFFFF,0.3/7)'), uniforms: {}, resolved: {}, expected: grey(.3 * (1 / 7)), exact: true },
  { name: 'expanded_radians_sin', kind: 'legacy', source: shader('expanded_angle', 'mix(#000000,#FFFFFF,clamp(sin(radians(30)),0,1))'), uniforms: {}, resolved: {}, expected: grey(Math.sin(30 * (Math.PI / 180))), exact: true },
  { name: 'scalar_mix_recorded_order', kind: 'legacy', source: shader('scalar_order', 'mix(#000000,#FFFFFF,clamp(mix(.1,.9,.3),0,1))'), uniforms: {}, resolved: {}, expected: grey(scalarOrder), exact: true },
  { name: 'color_mix_recorded_order', kind: 'legacy', source: shader('color_order', 'mix(#202020,#404040,.4)'), uniforms: {}, resolved: {}, expected: grey(colorOrder), exact: true },
  { name: 'repeating_original_negative_zero', kind: 'repeat', source: zeroSource, uniforms: { amount: -0 }, uv: [-0, -0], resolved: { amount: 0 }, expected: grey(0), zeroUniform: 'amount', materialNegativeZero: true },
  { name: 'plain_uv_final_positive_zero', kind: 'uv', source: uvSource, uniforms: {}, uv: [-0, -0], resolved: {}, expected: grey(0) },
  { name: 'legacy_resolved_positive_zero', kind: 'legacy', source: shader('legacy_zero', 'mix(#000000,#FFFFFF,amount)', '@uniform amount:float(-0,1,-0);'), uniforms: { amount: -0 }, resolved: { amount: 0 }, expected: grey(0), zeroUniform: 'amount', materialNegativeZero: true },
  { name: 'same_id_first_full_source', kind: 'legacy', source: shader('shared_id', '#000000', '', 'first original source'), uniforms: {}, resolved: {}, expected: grey(0) },
  { name: 'same_id_edited_full_source', kind: 'legacy', source: shader('shared_id', '#FFFFFF', '', 'edited original source'), uniforms: {}, resolved: {}, expected: grey(1) },
  { name: 'sixteen_resolved_defaults', kind: 'legacy', source: shader('sixteen_defaults', 'mix(#000000,#FFFFFF,u15)', manyUniforms), uniforms: {}, resolved: Object.fromEntries(Array.from({ length: 16 }, (_, index) => ['u' + index, .5])), expected: grey(.5) },
  { name: 'null_prototype_outer_request', kind: 'uv', source: uvSource, uniforms: {}, uv: [.5, 0], resolved: {}, expected: grey(.5), nullRequest: true },
];
const compileNames = { legacy: 'compileMeshMaterial', uv: 'compileEngineUVMaterial', repeat: 'compileEngineUVRepeatingMaterial' };
const compiler = (gpu, kind, source) => { const result = gpu[compileNames[kind]](source); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.material; };
function makeRequest(gpu, fixture) {
  const material = clone(compiler(gpu, fixture.kind, fixture.source));
  if (fixture.materialNegativeZero) { material.uniforms[0].min = -0; material.uniforms[0].default = -0; }
  const values = { material, uniforms: clone(fixture.uniforms), ...(fixture.kind === 'legacy' ? {} : { uv: [...fixture.uv] }) };
  return fixture.nullRequest ? Object.assign(Object.create(null), values) : values;
}
function checkSample(sample, input, fixture) {
  assert.deepEqual(Object.keys(sample).sort(), sampleKeys);
  assert.equal(sample.format, 'barocss-gpu-authored-material-sample'); assert.equal(sample.version, 0);
  assert.equal(sample.profile, 'binary64-linear-rgb-v0'); assert.equal(sample.colorSpace, 'linear-rgb'); assert.equal(sample.uvUnit, 'dimensionless');
  assert.equal(sample.source, fixture.source); assert.equal(sample.material.source, fixture.source);
  assert.deepEqual(sample.uniforms, fixture.resolved);
  assert.deepEqual(sample.uv, fixture.kind === 'legacy' ? null : fixture.uv);
  if (fixture.uv) fixture.uv.forEach((value, index) => assert(Object.is(sample.uv[index], value), 'Original UV sign changed'));
  if (fixture.zeroUniform) assert(Object.is(sample.uniforms[fixture.zeroUniform], 0));
  sample.linearRGB.forEach((value, index) => {
    if (fixture.exact) assert.equal(value, fixture.expected[index], fixture.name + ' recorded Number order');
    else near(value, fixture.expected[index]);
    if (fixture.expected[index] === 0) assert(Object.is(value, 0), 'Final RGB must use positive zero');
  });
  assert.notStrictEqual(sample.material, input.material); assert.notStrictEqual(sample.uniforms, input.uniforms);
  if (input.uv) assert.notStrictEqual(sample.uv, input.uv);
  frozen(sample);
}
async function file(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
let accepted = 0, refused = 0, getters = 0, reflectionExceptions = 0, oversizedUVEnumeration = 0;
const results = [], failures = [];
try {
  for (const [provider, gpu] of providers) {
    for (const name of ['evaluateAuthoredMaterial', 'AuthoredMaterialEvaluationError', 'compileMeshMaterial', 'compileEngineUVMaterial', 'compileEngineUVRepeatingMaterial']) assert.equal(typeof gpu[name], 'function');
    assert(Object.isFrozen(gpu.AuthoredMaterialEvaluationDiagnosticCode));
    assert.deepEqual(Object.keys(gpu.AuthoredMaterialEvaluationDiagnosticCode).sort(), ['INPUT', 'BUDGET', 'PROFILE', 'MATERIAL', 'UNIFORM', 'UV', 'NUMERICAL'].sort());
    const records = [];
    let preserved;
    for (const fixture of cases) {
      const input = makeRequest(gpu, fixture), original = originalJSON(input), sample = gpu.evaluateAuthoredMaterial(input);
      checkSample(sample, input, fixture); assert.equal(originalJSON(input), original);
      const repeated = gpu.evaluateAuthoredMaterial(input); checkSample(repeated, input, fixture);
      assert.deepEqual(repeated, sample); assert.notStrictEqual(repeated, sample); assert.notStrictEqual(repeated.material.expression, sample.material.expression);
      assert.notStrictEqual(repeated.uniforms, sample.uniforms); assert.notStrictEqual(repeated.linearRGB, sample.linearRGB);
      if (sample.uv) assert.notStrictEqual(repeated.uv, sample.uv);
      const stem = provider + '.' + fixture.name;
      const sourcePath = resolve(output, stem + '.original-source.css'), irPath = resolve(output, stem + '.original-ir.json');
      const requestPath = resolve(output, stem + '.original-request.json'), samplePath = resolve(output, stem + '.sample.json');
      await writeFile(sourcePath, fixture.source); await writeFile(irPath, originalJSON(input.material) + '\n');
      await writeFile(requestPath, original + '\n'); await writeFile(samplePath, originalJSON(sample) + '\n');
      const coldSource = await readFile(sourcePath, 'utf8'), coldIR = JSON.parse(await readFile(irPath, 'utf8'));
      const coldRequest = JSON.parse(await readFile(requestPath, 'utf8'));
      assert.equal(coldSource, fixture.source); assert.deepEqual(coldIR, coldRequest.material); assert.deepEqual(coldRequest, JSON.parse(original));
      const cold = gpu.evaluateAuthoredMaterial(coldRequest); checkSample(cold, coldRequest, fixture);
      assert.deepEqual(cold, sample); assert.deepEqual(JSON.parse(await readFile(samplePath, 'utf8')), sample);
      assert.notStrictEqual(cold.material.expression, sample.material.expression);
      if (fixture.uv) fixture.uv.forEach((value, index) => assert(Object.is(coldRequest.uv[index], value) && Object.is(cold.uv[index], value)));
      const beforeSample = originalJSON(sample);
      input.material.shaderId = 'caller_changed'; input.material.expression.kind = 'forged';
      if (Object.keys(input.uniforms).length) input.uniforms[Object.keys(input.uniforms)[0]] = .9;
      if (input.uv) input.uv[0] = 999;
      assert.equal(originalJSON(sample), beforeSample, 'Caller mutations exposed result authority');
      records.push({ name: fixture.name, expected: fixture.expected, actual: sample.linearRGB, resolved: sample.uniforms, uv: sample.uv, shaderId: sample.material.shaderId, files: await Promise.all([sourcePath, irPath, requestPath, samplePath].map(file)) });
      preserved ??= { sample, sampleText: originalJSON(sample), files: await Promise.all([sourcePath, irPath, requestPath, samplePath].map(file)) };
      accepted++;
    }
    const firstId = records.find(record => record.name === 'same_id_first_full_source'), editedId = records.find(record => record.name === 'same_id_edited_full_source');
    assert.equal(firstId.shaderId, editedId.shaderId); assert.notDeepEqual(firstId.actual, editedId.actual);
    const unclampedSource = shader('unclamped_repeating', 'mix(#000000,#FFFFFF,fract(uv_u+phase))', '@uniform phase:float(-1,1,0);', 'genuine existing provider refusal');
    const unclamped = gpu.compileEngineUVRepeatingMaterial(unclampedSource);
    assert.equal(unclamped.ok, false); assert.equal(unclamped.diagnostics[0].code, 'RANGE');
    assert.equal(unclampedSource.slice(unclamped.diagnostics[0].start, unclamped.diagnostics[0].end), 'fract');
    const unclampedPath = resolve(output, provider + '.unclamped-existing-refusal.css');
    await writeFile(unclampedPath, unclampedSource); refused++;
    const refusals = [{ name: 'unclamped UV plus phase has [-1001,1001] compiler bound', stage: 'existing compiler', diagnostics: unclamped.diagnostics, source: await file(unclampedPath) }];
    function reject(name, input, code, inspect) {
      let error;
      try { gpu.evaluateAuthoredMaterial(input); } catch (caught) { error = caught; }
      assert(error instanceof gpu.AuthoredMaterialEvaluationError, name + ': actual exported service error');
      assert.equal(error.code, code, name); assert(error.message.length <= 1024);
      inspect?.(error);
      assert.equal(originalJSON(preserved.sample), preserved.sampleText);
      refused++; refusals.push({ name, code: error.code, error: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message, start: error.cause.start ?? null, end: error.cause.end ?? null, originalDiagnostic: error.cause.cause ?? null } : error.cause === undefined ? null : String(error.cause) });
    }
    const legacy = () => makeRequest(gpu, cases[0]);
    const uv = () => makeRequest(gpu, cases[3]);
    reject('missing required uniforms', { material: legacy().material }, 'INPUT');
    reject('legacy forbids UV', { ...legacy(), uv: [0, 0] }, 'UV');
    const missingUV = uv(); delete missingUV.uv; reject('UV profile requires UV', missingUV, 'UV');
    reject('unknown header profile', { ...uv(), material: { ...uv().material, profile: 'not-a-supported-profile' } }, 'PROFILE');
    reject('wrong material version', { ...legacy(), material: { ...legacy().material, version: 1 } }, 'PROFILE');
    reject('extra request field', { ...legacy(), callerShader: 'not supported' }, 'INPUT');
    const outerGetter = { uniforms: {} }; Object.defineProperty(outerGetter, 'material', { enumerable: true, get() { getters++; return legacy().material; } });
    reject('outer getter is never invoked', outerGetter, 'INPUT');
    const headerGetter = legacy(); Object.defineProperty(headerGetter.material, 'profile', { enumerable: true, get() { getters++; return 'mesh-opaque-fragment-v0'; } });
    reject('header getter is never invoked', headerGetter, 'INPUT');
    const forged = legacy(); forged.material.expression = { kind: 'color', type: 'color', hex: '#FFFFFF', linear: [1, 1, 1] };
    reject('forged canonical IR', forged, 'MATERIAL', error => assert.equal(error.cause.code, 'IR'));
    const nestedGetter = legacy(); Object.defineProperty(nestedGetter.material.expression, 'args', { enumerable: true, get() { getters++; return []; } });
    reject('inherited IR getter guard', nestedGetter, 'MATERIAL');
    reject('UV tuple has wrong size', { ...uv(), uv: [0, 0, 0] }, 'UV');
    reject('UV is nonfinite', { ...uv(), uv: [NaN, 0] }, 'UV');
    reject('UV out of original range', { ...uv(), uv: [1000.01, 0] }, 'UV');
    reject('UV is sparse', { ...uv(), uv: new Array(2) }, 'UV');
    const uvGetter = [0, 0]; Object.defineProperty(uvGetter, '0', { enumerable: true, get() { getters++; return 0; } });
    reject('UV getter is never invoked', { ...uv(), uv: uvGetter }, 'UV');
    const oversizedUV = new Proxy([0, 0, 0], { ownKeys(target) { oversizedUVEnumeration++; return Reflect.ownKeys(target); } });
    reject('UV size refused before full key enumeration', { ...uv(), uv: oversizedUV }, 'UV'); assert.equal(oversizedUVEnumeration, 0);
    const uvAndForged = uv(); uvAndForged.uv = [1001, 0]; uvAndForged.material.expression.kind = 'forged';
    reject('UV admission precedes binder reconstruction', uvAndForged, 'UV');
    reject('unknown uniform', { ...legacy(), uniforms: { absent: 0 } }, 'UNIFORM');
    reject('out of declared uniform range', { ...legacy(), uniforms: { gain: 2 } }, 'UNIFORM');
    reject('uniform array', { ...legacy(), uniforms: [] }, 'UNIFORM');
    reject('inherited uniform nonfinite guard', { ...legacy(), uniforms: { gain: NaN } }, 'MATERIAL');
    reject('inherited null-prototype uniform guard', { ...legacy(), uniforms: Object.assign(Object.create(null), { gain: .5 }) }, 'MATERIAL');
    reject('inherited seventeen-key uniform guard', { ...legacy(), uniforms: Object.fromEntries(Array.from({ length: 17 }, (_, index) => ['u' + index, 0])) }, 'MATERIAL');
    const uniformGetter = {}; Object.defineProperty(uniformGetter, 'gain', { enumerable: true, get() { getters++; return .5; } });
    reject('uniform getter is never invoked', { ...legacy(), uniforms: uniformGetter }, 'MATERIAL');
    const unsafe = uv(); unsafe.uniforms = Object.fromEntries([['__proto__', 0]]); unsafe.material.expression.kind = 'forged';
    reject('unsafe own override precedes forged binder input', unsafe, 'UNIFORM');
    for (const kind of ['legacy', 'uv', 'repeat']) {
      const unsafeSource = shader('unsafe_declaration_' + kind, 'mix(#000000,#FFFFFF,__proto__)', '@uniform __proto__:float(0,1,0);');
      const material = compiler(gpu, kind, unsafeSource);
      reject('unsafe reconstructed declaration ' + kind, { material, uniforms: {}, ...(kind === 'legacy' ? {} : { uv: [0, 0] }) }, 'UNIFORM');
    }
    const sourceBudget = uv(); sourceBudget.material.source += ' '.repeat(65536);
    reject('inherited own-data source code-unit budget', sourceBudget, 'BUDGET');
    const treeBudget = legacy(); treeBudget.material.expression = { kind: 'call', type: 'color', name: 'mix', args: Array.from({ length: 256 }, () => Object.fromEntries(Array.from({ length: 16 }, (_, index) => ['p' + index, [0, 0, 0, 0]]))) };
    reject('inherited snapshot visit budget before IR comparison', treeBudget, 'BUDGET');
    const bytesBudget = uv(); bytesBudget.material.source += '/*' + 'é'.repeat(32768) + '*/';
    reject('UTF8 compiler budget keeps actual binder IR mapping', bytesBudget, 'MATERIAL', error => { assert.equal(error.cause.code, 'IR'); assert.equal(error.cause.cause.code, 'BUDGET'); });
    const badUVSource = uv(); badUVSource.material.source = shader('original_v', 'mix(#000000,#FFFFFF,missing_input)', '', 'original UTF16 diagnostic');
    const uvStart = badUVSource.material.source.indexOf('missing_input');
    reject('UV reconstructed source retains actual ranged diagnostic', badUVSource, 'MATERIAL', error => { assert.equal(error.cause.code, 'IR'); assert.equal(error.cause.start, uvStart); assert.equal(error.cause.end, uvStart + 'missing_input'.length); assert.equal(error.cause.cause.code, 'TYPE'); assert.equal(error.cause.cause.start, uvStart); });
    const badLegacy = legacy(); badLegacy.material.source = shader('legacy_gain', 'missing_input', '', 'legacy inherited lost ranges');
    reject('legacy reconstructed source does not fabricate lost offsets', badLegacy, 'MATERIAL', error => { assert.equal(error.cause.code, 'IR'); assert.equal(error.cause.start, 0); assert.equal(error.cause.end, 0); assert.equal(error.cause.cause, undefined); });
    const outerMarker = new Error('actual outer reflection marker');
    reject('actual outer reflection cause', new Proxy(legacy(), { getPrototypeOf() { reflectionExceptions++; throw outerMarker; } }), 'INPUT', error => assert.strictEqual(error.cause, outerMarker));
    const headerMarker = new Error('actual header reflection marker'), reflected = uv();
    reflected.material = new Proxy(reflected.material, { getOwnPropertyDescriptor() { reflectionExceptions++; throw headerMarker; } });
    reject('actual header reflection cause', reflected, 'INPUT', error => assert.strictEqual(error.cause, headerMarker));
    assert.equal(getters, 0);
    for (const previous of preserved.files) assert.equal(hash(await readFile(previous.path)), previous.sha256);
    results.push({ provider, exports: Object.keys(gpu).length, records, refusals, priorFilesRetained: true });
  }
  assert.deepEqual(results[0].records.map(record => ({ name: record.name, expected: record.expected, actual: record.actual, resolved: record.resolved, uv: record.uv, shaderId: record.shaderId })), results[1].records.map(record => ({ name: record.name, expected: record.expected, actual: record.actual, resolved: record.resolved, uv: record.uv, shaderId: record.shaderId })));
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1331, profile: 'binary64-linear-rgb-v0', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), accepted, refused, getters, reflectionExceptions, oversizedUVEnumeration, results, failures,
    ordinarySourceGraph: graph, emittedEntry: { path: resolve(pkg, published.import), sha256: hash(await readFile(resolve(pkg, published.import))), declarations: declarationsPath, declarationSHA256: hash(await readFile(declarationsPath)), evaluationDeclarations: evaluationDeclarationPath, evaluationDeclarationSHA256: hash(evaluationDeclaration) },
    actualGL: false, actualPixels: false, actualFloat32: false, publicFileCodec: false, defensiveNumericalOverflowExecuted: false,
    limits: ['Actual public CPU/source-reconstructed evaluation and original private evidence files only.', 'JavaScript Math/transcendental and binary64 recorded order do not certify Float32 or GPU results.', 'Valid canonical colors/ratios already have admitted ranges; endpoint/final positive-zero controls do not claim forged out-of-range RGB evaluation.', 'NUMERICAL evaluator guards are defensive; no fabricated admitted overflow case.', 'Legacy source validation loses original offsets/cause; this flow preserves that actual inherited limit.', 'Original requests with omitted overrides differ from resolved samples; private -0 JSON spelling is not a product codec.', 'Native CPU, Integration, material authoring consumer, currentRoot and graphics/publication remain separate.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1331, accepted, refused, getters, reflectionExceptions, oversizedUVEnumeration, exports: 102, actualGL: false, failures }));
}
