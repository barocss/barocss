/** #1432 CPU grammar only.
 * Node22 examples/gpu-scene/native-surface-uv01-material-flow.mjs --output ABS_FRESH
 * Public source/emitted compiler, reconstructed IR, trusted lowering and cold files.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]);
await mkdir(output, { recursive: false });
const parent = 'c8bb228130069d0597cd575d551862de460af9b5', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const ordinary = resolve(output, 'ordinary-public.mjs'), emitted = resolve(pkg, manifest.publishConfig.exports['.'].import);
const bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm',
  target: 'node22', outfile: ordinary, metafile: true });
// One explicitly internal compatibility control; no new public binding export.
const internalOrdinary = resolve(output, 'internal-legacy-binding-source.mjs'), internalEmitted = resolve(pkg, 'dist/material/mesh-material.js');
const internalBundle = await build({ entryPoints: [resolve(pkg, 'src/material/mesh-material.ts')], bundle: true, platform: 'node', format: 'esm',
  target: 'node22', outfile: internalOrdinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs);
assert.ok(sourceGraph.some(p => p.endsWith('/src/material/mesh-material.ts')));
assert.ok(sourceGraph.some(p => p.includes('barocss-cad/src/')), 'Actual own CAD source dependency closure is disclosed');
assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)), 'Ordinary actual source graph');
const hash = value => createHash('sha256').update(value).digest('hex');
function signed(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(signed).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + signed(value[k])).join(',') + '}';
}
const clone = value => JSON.parse(signed(value));
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
const providers = [{ label: 'ordinary-source', path: ordinary, internalPath: internalOrdinary }, { label: 'emitted-public', path: emitted, internalPath: internalEmitted }];
for (const p of providers) { p.gpu = await import(pathToFileURL(p.path).href); p.internal = await import(pathToFileURL(p.internalPath).href); }
const namespace = Object.keys(providers[0].gpu).sort(), newNames = ['compileNativeSurfaceUV01Material', 'validateNativeSurfaceUV01MaterialIR', 'lowerNativeSurfaceUV01Material'];
assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace); assert.equal(namespace.length, 122);
for (const name of newNames) assert.ok(namespace.includes(name));
const declarationPath = resolve(pkg, manifest.publishConfig.exports['.'].types), declaration = await readFile(declarationPath, 'utf8');
const leafDeclarationPath = resolve(pkg, 'dist/mesh-material.d.ts'), leafDeclaration = await readFile(leafDeclarationPath, 'utf8');
for (const name of [...newNames, 'NativeSurfaceUV01MaterialExpression', 'NativeSurfaceUV01MaterialIR', 'LoweredNativeSurfaceUV01Material']) {
  assert.ok(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public declaration export ' + name);
  assert.ok(new RegExp('\\b' + name + '\\b').test(leafDeclaration), 'Actual emitted leaf declaration ' + name);
}
assert.ok(/MeshMaterialExpression\s*=\s*MaterialExpression<never>/.test(leafDeclaration), 'Old coordinate-free public expression type');
assert.ok(/EngineUVMaterialExpression\s*=\s*MaterialExpression<UVInput>/.test(leafDeclaration));
assert.ok(/EngineUVRepeatingMaterialExpression\s*=\s*MaterialExpression<UVInput,\s*'fract'>/.test(leafDeclaration));
for (const signature of [
  'validateMeshMaterialIR(input: unknown): MeshMaterialIR;',
  'validateEngineUVMaterialIR(input: unknown): EngineUVMaterialIR;',
  'validateEngineUVRepeatingMaterialIR(input: unknown): EngineUVRepeatingMaterialIR;',
  'lowerMeshMaterial(input: unknown): LoweredMeshMaterial;',
  'lowerEngineUVMaterial(input: unknown): LoweredEngineUVMaterial;',
  'lowerEngineUVRepeatingMaterial(input: unknown): LoweredEngineUVMaterial;',
]) assert.ok(leafDeclaration.includes(signature), 'Unchanged old public signature ' + signature);
for (const name of ['compileMeshMaterial', 'compileEngineUVMaterial', 'compileEngineUVRepeatingMaterial'])
  assert.ok(leafDeclaration.includes(name + '(source: string):'), 'Old source compiler signature ' + name);
const model = (expression, declarations = '', id = 'native_uv01') => '@shader #' + id + ' { ' + declarations + ' @fragment { color:' + expression + '; } }';
const black = { kind: 'color', type: 'color', hex: '#000000', linear: [0, 0, 0] }, white = { kind: 'color', type: 'color', hex: '#FFFFFF', linear: [1, 1, 1] };
const input = name => ({ kind: 'input', type: 'float', name }), literal = value => ({ kind: 'float', type: 'float', value });
const call = (name, args, type = 'float') => ({ kind: 'call', type, name, args });
const binary = (operator, left, right) => ({ kind: 'binary', type: 'float', operator, left, right });
const bt = 'vec3(0.0000000000000000,0.0000000000000000,0.0000000000000000)', wt = 'vec3(1.0000000000000000,1.0000000000000000,1.0000000000000000)';
const out = expression => 'clamp(' + expression + ',vec3(0.0),vec3(1.0))';
const mixText = ratio => out('mix(' + bt + ',' + wt + ',clamp(' + ratio + ',0.0,1.0))');
function sum(n) { if (n === 1) return 'surface_u01'; const left = Math.floor(n / 2); return '(' + sum(left) + '+' + sum(n - left) + ')'; }
function sumIR(n) { if (n === 1) return input('surface_u01'); const left = Math.floor(n / 2); return binary('+', sumIR(left), sumIR(n - left)); }
function sumText(n) { if (n === 1) return 'v_native_surface_uv01.x'; const left = Math.floor(n / 2); return '(' + sumText(left) + '+' + sumText(n - left) + ')'; }
function padded(source, bytes) { const remaining = bytes - Buffer.byteLength(source) - 4; assert.ok(remaining >= 0);
  const result = source + '/*' + 'é'.repeat(Math.floor(remaining / 2)) + 'x'.repeat(remaining % 2) + '*/'; assert.equal(Buffer.byteLength(result), bytes); return result; }
const amount = { name: 'amount', type: 'float', min: 0, max: 1, default: .25 };
const ratioIR = call('clamp', [binary('*', input('surface_u01'), { kind: 'uniform', type: 'float', name: 'amount' }), literal(0), literal(1)]);
const ratioText = 'clamp((v_native_surface_uv01.x*mat_u_0),0.0000000000000000,1.0000000000000000)';
const scalarIR = binary('+', literal(.2), binary('*', binary('-', literal(.8), literal(.2)), input('surface_v01')));
const scalarText = '(0.20000000000000001+((0.80000000000000004-0.20000000000000001)*v_native_surface_uv01.y))';
const fixtures = [
  { label: 'direct_u01_interval', source: model('mix(#000,#fff,surface_u01)'), expression: call('mix', [black, white, input('surface_u01')], 'color'), text: mixText('v_native_surface_uv01.x'), uniforms: [] },
  { label: 'direct_v01_interval', source: model('mix(#000,#fff,surface_v01)'), expression: call('mix', [black, white, input('surface_v01')], 'color'), text: mixText('v_native_surface_uv01.y'), uniforms: [] },
  { label: 'full_comments_uniform_typed_locals', source: '@shader #native_uv01 {\r\n // Original é comment and UTF16 offsets.\r\n @uniform amount:float(0,1,.25);\r\n @let fade:float(clamp(surface_u01*amount,0,1));\r\n @let tint:color(mix(#000,#fff,fade));\r\n @fragment { color:tint; }\r\n}', expression: call('mix', [black, white, ratioIR], 'color'), text: mixText(ratioText), uniforms: [amount] },
  { label: 'scalar_mix_old_arithmetic_IR', source: model('mix(#000,#fff,mix(.2,.8,surface_v01))'), expression: call('mix', [black, white, scalarIR], 'color'), text: mixText(scalarText), uniforms: [] },
  { label: 'source_minus_zero_numeric_plus_zero', source: model('mix(#000,#fff,clamp(surface_u01*amount,0,1))', '@uniform amount:float(-0,1,-0);'), expression: call('mix', [black, white, ratioIR], 'color'), text: mixText(ratioText), uniforms: [{ ...amount, default: 0 }], signed: true },
  { label: 'native_leaf_expanded256_nodes', source: model('mix(#000,#fff,clamp(many,0,1))', '@let many:float(' + sum(63) + ');'), expression: call('mix', [black, white, call('clamp', [sumIR(63), literal(0), literal(1)])], 'color'), text: mixText('clamp(' + sumText(63) + ',0.0000000000000000,1.0000000000000000)'), uniforms: [], nodeAccounting: { definition: 125, expandedLocal: 125, colors: 2, bounds: 2, clamp: 1, mix: 1, total: 256 } },
  { label: 'unicode_UTF8_65536', source: padded(model('#fff'), 65536), expression: white, text: out(wt), uniforms: [] },
  { label: 'constant_still_fixed_native_declaration', source: model('#fff'), expression: white, text: out(wt), uniforms: [] },
];
let accepted = 0, refused = 0, getters = 0, reflections = 0;
const results = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, admissions = [], failures = [];
  for (const name of [...newNames, 'compileMeshMaterial', 'validateMeshMaterialIR', 'lowerMeshMaterial', 'compileEngineUVMaterial',
    'validateEngineUVMaterialIR', 'compileEngineUVRepeatingMaterial', 'validateEngineUVRepeatingMaterialIR', 'MeshMaterialError']) assert.equal(typeof gpu[name], 'function');
  assert.equal(typeof provider.internal.validateMeshMaterialBinding, 'function', 'Explicit internal legacy binding control only');
  const compile = source => { const r = gpu.compileNativeSurfaceUV01Material(source); assert.equal(r.ok, true, JSON.stringify(r.diagnostics)); return r.material; };
  function verify(ir, fixture) {
    assert.deepEqual(Object.keys(ir).sort(), ['format', 'version', 'profile', 'source', 'shaderId', 'uniforms', 'expression'].sort());
    assert.equal(ir.format, 'barocss-gpu-native-surface-uv01-material'); assert.equal(ir.profile, 'native-surface-opaque-uv01-fragment-v0');
    assert.equal(ir.version, 0); assert.equal(ir.shaderId, 'native_uv01'); assert.equal(ir.source, fixture.source);
    assert.deepEqual(ir.uniforms, fixture.uniforms); assert.deepEqual(ir.expression, fixture.expression); frozen(ir);
  }
  for (const fixture of fixtures) {
    const compiled = compile(fixture.source); verify(compiled, fixture);
    const supplied = clone(compiled); if (fixture.signed) { supplied.uniforms[0].min = -0; supplied.uniforms[0].default = -0; }
    const before = signed(supplied), validated = gpu.validateNativeSurfaceUV01MaterialIR(supplied), lowered = gpu.lowerNativeSurfaceUV01Material(supplied);
    verify(validated, fixture); assert.equal(signed(supplied), before); assert.notStrictEqual(validated, compiled); assert.notStrictEqual(validated.expression, supplied.expression);
    assert.deepEqual(Object.keys(lowered).sort(), ['expression', 'uniformDeclarations', 'uniformLayout', 'inputDeclarations'].sort());
    assert.equal(lowered.inputDeclarations, 'in vec2 v_native_surface_uv01;'); assert.equal(lowered.expression, fixture.text);
    assert.equal(lowered.uniformDeclarations, fixture.uniforms.map((_, i) => 'uniform float mat_u_' + i + ';').join('\n'));
    assert.deepEqual(lowered.uniformLayout, fixture.uniforms.map((u, i) => ({ ...u, glslName: 'mat_u_' + i }))); frozen(lowered);
    if (fixture.signed) { assert.ok(Object.is(supplied.uniforms[0].default, -0)); assert.ok(Object.is(validated.uniforms[0].default, +0)); }
    const prefix = resolve(output, provider.label + '.' + fixture.label), sourcePath = prefix + '.source.css', irPath = prefix + '.supplied-ir.json', derivedPath = prefix + '.derived.json';
    await writeFile(sourcePath, fixture.source, { flag: 'wx' }); await writeFile(irPath, before + '\n', { flag: 'wx' }); await writeFile(derivedPath, signed({ compiled, validated, lowered }) + '\n', { flag: 'wx' });
    const files = await Promise.all([sourcePath, irPath, derivedPath].map(receipt));
    coldCases.push({ provider: provider.label, label: fixture.label, sourcePath, irPath, derivedPath, sourceSHA256: files[0].sha256, irSHA256: files[1].sha256,
      derivedSHA256: files[2].sha256, compiledDigest: hash(signed(compiled)), validatedDigest: hash(signed(validated)), loweredDigest: hash(signed(lowered)) });
    supplied.shaderId = 'changed_by_caller'; if (supplied.uniforms.length) supplied.uniforms[0].default = .9;
    verify(validated, fixture); assert.equal(lowered.expression, fixture.text); assert.throws(() => validated.profile = 'changed', TypeError); assert.throws(() => lowered.uniformLayout.push({}), TypeError);
    accepted++; admissions.push({ label: fixture.label, files, expression: fixture.expression, lowered, nodeAccounting: fixture.nodeAccounting ?? null });
  }
  const retained = compile(fixtures[0].source), retainedLower = gpu.lowerNativeSurfaceUV01Material(retained), retainedBits = signed({ retained, retainedLower });
  const retainedFile = resolve(output, provider.label + '.retained.json'); await writeFile(retainedFile, retainedBits + '\n', { flag: 'wx' }); const saved = await readFile(retainedFile);
  async function retention() { assert.equal(signed({ retained, retainedLower }), retainedBits); assert.deepEqual(await readFile(retainedFile), saved); assert.equal(getters, 0); }
  const sourceFailures = [
    { label: 'uniform_shadow_u', source: model('#fff', '@uniform surface_u01:float(0,1,.25);'), code: 'TYPE', token: 'surface_u01', message: 'Uniform name shadows reserved native Surface UV01 input' },
    { label: 'uniform_shadow_v', source: model('#fff', '@uniform surface_v01:float(0,1,.25);'), code: 'TYPE', token: 'surface_v01', message: 'Uniform name shadows reserved native Surface UV01 input' },
    { label: 'local_shadow_u', source: model('#fff', '@let surface_u01:float(0);'), code: 'TYPE', token: 'surface_u01', message: 'Local name shadows reserved native Surface UV01 input' },
    { label: 'local_shadow_v', source: model('#fff', '@let surface_v01:float(0);'), code: 'TYPE', token: 'surface_v01', message: 'Local name shadows reserved native Surface UV01 input' },
    { label: 'original_Unicode_CRLF_diagnostic_span', source: '// é😀 original\r\n' + model('mix(#000,#fff,surface_unknown)'), code: 'TYPE', token: 'surface_unknown' },
    { label: 'Engine_input_not_native', source: model('mix(#000,#fff,clamp(uv_u,0,1))'), code: 'TYPE', token: 'uv_u' },
    { label: 'dotted_syntax_not_selected', source: model('mix(#000,#fff,surface.u01)'), code: 'SYNTAX', token: '.' },
    { label: 'native_ratio_outside01', source: model('mix(#000,#fff,surface_u01+1)'), code: 'RANGE', token: 'mix' },
    { label: 'fract_not_native_profile', source: model('mix(#000,#fff,fract(surface_u01))'), code: 'SYNTAX', token: 'fract' },
    { label: 'literal_bound', source: model('mix(#000,#fff,clamp(surface_u01*1001,0,1))'), code: 'RANGE', token: '1001' },
    { label: 'intermediate_bound', source: model('mix(#000,#fff,clamp(surface_u01*1000*1000*2,0,1))'), code: 'RANGE' },
    { label: 'expanded_native_leaf_budget', source: model('mix(#000,#fff,clamp(many,0,1))', '@let many:float(' + sum(64) + ');'), code: 'BUDGET' },
    { label: 'native_leaf_parse_depth', source: model('mix(#000,#fff,' + '('.repeat(20) + 'surface_u01' + ')'.repeat(20) + ')'), code: 'BUDGET' },
    { label: 'UTF8_65537', source: padded(model('#fff'), 65537), code: 'BUDGET' },
    { label: 'token4097', source: model('#fff') + ';'.repeat(4097), code: 'BUDGET' },
    { label: 'nontext', source: null, code: 'INPUT' },
  ];
  for (const f of sourceFailures) {
    const r = gpu.compileNativeSurfaceUV01Material(f.source); assert.equal(r.ok, false, f.label); assert.equal(r.diagnostics.length, 1);
    const d = r.diagnostics[0]; assert.equal(d.code, f.code, f.label); assert.ok(d.message.length <= 1024); assert.ok(Number.isInteger(d.start) && Number.isInteger(d.end));
    if (f.token) { assert.equal(d.start, f.source.indexOf(f.token), f.label); assert.equal(d.end, d.start + f.token.length); } if (f.message) assert.equal(d.message, f.message);
    await retention(); refused++; failures.push({ label: f.label, stage: 'compile', diagnostic: d, previousSourceIRLowerAndFileRetained: true });
  }
  const irFailures = [], badIR = (label, edit, code = 'IR') => { const ir = clone(retained); edit(ir); irFailures.push({ label, ir, code }); };
  badIR('wrong_version', ir => ir.version = 1); badIR('forged_Engine_profile', ir => ir.profile = 'engine-opaque-uv-fragment-v0');
  badIR('forged_leaf', ir => ir.expression.args[2].name = 'uv_u'); badIR('forged_leaf_type', ir => ir.expression.args[2].type = 'color');
  badIR('extra_IR_key', ir => ir.extra = true); badIR('source_getter', ir => Object.defineProperty(ir, 'source', { enumerable: true, get() { getters++; return fixtures[0].source; } }), 'INPUT');
  badIR('leaf_getter', ir => Object.defineProperty(ir.expression.args[2], 'name', { enumerable: true, get() { getters++; return 'surface_u01'; } }), 'INPUT');
  badIR('own_snapshot_depth', ir => { let e = literal(0); for (let i = 0; i < 26; i++) e = { kind: 'unary', type: 'float', operator: '+', value: e }; ir.expression = e; }, 'BUDGET');
  const marker = new Error('actual native UV01 reflection marker'); irFailures.push({ label: 'actual_reflection_cause', ir: new Proxy(clone(retained), { ownKeys() { reflections++; throw marker; } }), code: 'INPUT', cause: marker });
  const invalidSource = model('mix(#000,#fff,surface_unknown)'), invalidDiagnostic = gpu.compileNativeSurfaceUV01Material(invalidSource);
  assert.equal(invalidDiagnostic.ok, false); irFailures.push({ label: 'actual_source_diagnostic_cause', ir: { ...clone(retained), source: invalidSource }, code: 'IR', diagnostic: invalidDiagnostic.diagnostics[0] });
  for (const f of irFailures) {
    let error; try { gpu.validateNativeSurfaceUV01MaterialIR(f.ir); } catch (e) { error = e; }
    assert.ok(error instanceof gpu.MeshMaterialError, f.label); assert.equal(error.code, f.code, f.label); assert.ok(error.message.length <= 1024);
    if (f.cause) assert.strictEqual(error.cause, f.cause); if (f.diagnostic) { assert.deepEqual(error.cause, f.diagnostic); assert.equal(error.start, f.diagnostic.start); assert.equal(error.end, f.diagnostic.end); }
    await retention(); refused++; failures.push({ label: f.label, stage: 'validate', code: error.code, message: error.message, start: error.start, end: error.end,
      cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : error.cause ?? null, previousSourceIRLowerAndFileRetained: true });
  }
  const legacySource = model('mix(#000,#fff,surface_u01)', '@uniform surface_u01:float(0,1,.5);');
  const legacy = gpu.compileMeshMaterial(legacySource); assert.equal(legacy.ok, true); assert.equal(legacy.material.profile, 'mesh-opaque-fragment-v0');
  assert.deepEqual(legacy.material.expression, call('mix', [black, white, { kind: 'uniform', type: 'float', name: 'surface_u01' }], 'color'));
  const legacyLower = gpu.lowerMeshMaterial(legacy.material); assert.equal(Object.isFrozen(legacyLower), false); assert.equal(legacyLower.expression, mixText('mat_u_0'));
  assert.deepEqual(Object.keys(legacyLower).sort(), ['expression', 'uniformDeclarations', 'uniformLayout'].sort());
  const legacyBare = gpu.compileMeshMaterial(fixtures[0].source); assert.equal(legacyBare.ok, false); assert.equal(legacyBare.diagnostics[0].code, 'TYPE');
  const engine = gpu.compileEngineUVMaterial(model('mix(#000,#fff,clamp(uv_u,0,1))')), repeating = gpu.compileEngineUVRepeatingMaterial(model('mix(#000,#fff,fract(uv_u))'));
  assert.equal(engine.ok, true); assert.equal(repeating.ok, true); assert.equal(gpu.lowerEngineUVMaterial(engine.material).inputDeclarations, 'in vec2 v_engine_uv;');
  const engineDirect = gpu.compileEngineUVMaterial(model('mix(#000,#fff,uv_u)')); assert.equal(engineDirect.ok, false); assert.equal(engineDirect.diagnostics[0].code, 'RANGE');
  const boundaries = [
    ['native_refuses_legacy', () => gpu.validateNativeSurfaceUV01MaterialIR(legacy.material)],
    ['native_refuses_engine', () => gpu.validateNativeSurfaceUV01MaterialIR(engine.material)],
    ['native_refuses_repeating', () => gpu.validateNativeSurfaceUV01MaterialIR(repeating.material)],
    ['legacy_IR_refuses_native', () => gpu.validateMeshMaterialIR(retained)],
    ['internal_legacy_binding_refuses_native', () => provider.internal.validateMeshMaterialBinding({ material: retained, uniforms: {} }), provider.internal.MeshMaterialError],
    ['Engine_IR_refuses_native', () => gpu.validateEngineUVMaterialIR(retained)],
    ['repeating_IR_refuses_native', () => gpu.validateEngineUVRepeatingMaterialIR(retained)],
  ];
  for (const [label, operation, ErrorClass = gpu.MeshMaterialError] of boundaries) { assert.throws(operation, e => e instanceof ErrorClass && e.code === 'IR'); await retention(); refused++; failures.push({ label, stage: label.startsWith('internal_') ? 'explicit-internal-legacy-binding' : 'public-profile-boundary', code: 'IR' }); }
  const compatibilityFile = resolve(output, provider.label + '.compatibility.json'); await writeFile(compatibilityFile, signed({ legacySource, legacy, legacyLower, legacyBare, engineDirect,
    engineProfile: engine.material.profile, repeatingProfile: repeating.material.profile }) + '\n', { flag: 'wx' });
  results.push({ provider: provider.label, admissions, failures, retainedFile: await receipt(retainedFile), compatibilityFile: await receipt(compatibilityFile),
    internalLegacyBindingControl: { module: await receipt(provider.internalPath), publicExport: false, scope: 'One old binding rejection only; uses this internal module own Error class.' }, finalIRDigest: hash(signed(retained)) });
}
assert.equal(results[0].finalIRDigest, results[1].finalIRDigest);
const coldCode = String.raw`
import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; import {pathToFileURL} from 'node:url'; import {createHash} from 'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22); const cfg=JSON.parse(readFileSync(process.argv[2],'utf8'));
const hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(signed).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
function frozen(v){if(v&&typeof v==='object'){assert(Object.isFrozen(v));Object.values(v).forEach(frozen);}}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);
 for(const item of cfg.cases.filter(c=>c.provider===provider.label)){const sourceBytes=readFileSync(item.sourcePath),irBytes=readFileSync(item.irPath),derivedBytes=readFileSync(item.derivedPath);
  assert.equal(hash(sourceBytes),item.sourceSHA256);assert.equal(hash(irBytes),item.irSHA256);assert.equal(hash(derivedBytes),item.derivedSHA256);
  const source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(sourceBytes),ir=JSON.parse(irBytes.toString('utf8')),before=signed(ir);
  const compiled=gpu.compileNativeSurfaceUV01Material(source);assert.equal(compiled.ok,true);const validated=gpu.validateNativeSurfaceUV01MaterialIR(ir),lowered=gpu.lowerNativeSurfaceUV01Material(ir);
  assert.equal(signed(ir),before);assert.equal(compiled.material.source,source);assert.equal(validated.source,source);assert.equal(hash(signed(compiled.material)),item.compiledDigest);assert.equal(hash(signed(validated)),item.validatedDigest);assert.equal(hash(signed(lowered)),item.loweredDigest);
  assert.equal(lowered.inputDeclarations,'in vec2 v_native_surface_uv01;');frozen(compiled.material);frozen(validated);frozen(lowered);assert.notStrictEqual(compiled.material.expression,validated.expression);
  const saved=JSON.parse(derivedBytes.toString('utf8'));assert.deepEqual(saved,{compiled:compiled.material,validated,lowered});
  rows.push({provider:provider.label,label:item.label,sourceSHA256:item.sourceSHA256,compiledDigest:item.compiledDigest,validatedDigest:item.validatedDigest,loweredDigest:item.loweredDigest});
 }}assert.equal(rows.length,cfg.cases.length);console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentIRAuthority:false,actualGL:false}));
`;
const coldSourcePath = resolve(output, 'cold-public-flow.mjs'), coldConfigPath = resolve(output, 'cold-config.json');
await writeFile(coldSourcePath, coldCode, { flag: 'wx' }); await writeFile(coldConfigPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const coldStdout = execFileSync(process.execPath, [coldSourcePath, coldConfigPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
await writeFile(resolve(output, 'cold.stdout'), coldStdout, { flag: 'wx' }); const cold = JSON.parse(coldStdout);
assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, fixtures.length * 2);
for (const item of coldCases) for (const [path, expected] of [[item.sourcePath, item.sourceSHA256], [item.irPath, item.irSHA256], [item.derivedPath, item.derivedSHA256]]) assert.equal(hash(await readFile(path)), expected);
const report = { issue: 1432, stage: 'NATIVE_SURFACE_UV01_GRAMMAR_CPU', parent, node: process.version, accepted, refused, getters, reflections, namespace,
  namespaceCount: namespace.length, newRuntimeNames: newNames, sourceGraph, ordinary: await receipt(ordinary), emitted: await receipt(emitted), declarations: await receipt(declarationPath),
  internalLegacyBindingSourceGraph: Object.keys(internalBundle.metafile.inputs),
  leafDeclarations: await receipt(leafDeclarationPath), declarationCheck: 'Actual public barrel and emitted leaf text/type exports; no broad declaration compilation campaign.', results, cold,
  actualGL: false, publicEvaluatorUsed: false, sourceNativeDomainProducer: false, nativeBinding: false,
  support: 'Distinct normalized native Surface UV01 source/IR and fixed trusted lower text only. Input [0,1] is a future producer precondition; no native domain normalization, attribute, linked shader, pixels, frame/binding, renderer, consumer adoption or publication.' };
const reportPath = resolve(output, 'actual-result.json'); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1432, accepted, refused, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(reportPath), actualGL: false }));
