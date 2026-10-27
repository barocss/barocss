/** #1502 ONE discrete binary64 source/sample/file/cold qualifier. Node22 after GPU build.
 * node examples/gpu-scene/material-discrete-evaluation-flow.mjs --output ABS_FRESH
 * Original source and overrides are authority; no lighting, encoding, GL or F32 parity claim.
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
const parent = 'd3af43cf7241ee970050bb8ee98cf63c5a622ccc', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8')), hash = value => createHash('sha256').update(value).digest('hex');
const parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const barrel = parentFile('src/index.ts'), ast = ts.createSourceFile('parent.ts', barrel, ts.ScriptTarget.Latest, true);
const parentRuntime = ast.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause))
  .flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort(); assert.equal(parentRuntime.length, 144);
const ordinary = resolve(output, 'ordinary-public.mjs');
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundled.metafile.inputs); assert.ok(sourceGraph.some(path => path.endsWith('/src/material/material-evaluation.ts'))); assert.ok(!sourceGraph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.ok(['evaluateDiscreteAuthoredMaterial'].sort().every(x => namespace.includes(x))); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);


const printer = ts.createPrinter({ removeComments: true });
function declarations(text, names) { const file = ts.createSourceFile('eval.ts', text, ts.ScriptTarget.Latest, true); return Object.fromEntries(file.statements.filter(node => node.name && names.includes(node.name.text)).map(node => [node.name.text, printer.printNode(ts.EmitHint.Unspecified, node, file)])); }
function signature(text, name) { const file = ts.createSourceFile('eval.ts', text, ts.ScriptTarget.Latest, true), fn = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name); assert.ok(fn); return { args: fn.parameters.map(node => printer.printNode(ts.EmitHint.Unspecified, node, file)), result: printer.printNode(ts.EmitHint.Unspecified, fn.type, file) }; }
const oldSource = parentFile('src/material-evaluation.ts'), dts = await readFile(resolve(pkg, 'dist/material/material-evaluation.d.ts'), 'utf8');
const oldTypes = ['AuthoredMaterialEvaluationDiagnosticCode', 'AuthoredMaterialRequest', 'AuthoredMaterialSample'];
assert.equal(Object.keys(declarations(oldSource, oldTypes)).length, oldTypes.length); assert.deepEqual(declarations(dts, oldTypes), declarations(oldSource, oldTypes)); assert.deepEqual(signature(dts, 'evaluateAuthoredMaterial'), signature(oldSource, 'evaluateAuthoredMaterial'));
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), newTypes = ['DiscreteAuthoredMaterialRequest', 'DiscreteAuthoredMaterialSample'];
for (const name of newTypes) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(dts)); }
function signed(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || typeof value !== 'object') return JSON.stringify(value); return Array.isArray(value) ? '[' + value.map(signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}'; }
const clone = value => JSON.parse(signed(value));
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, seen = new Set()) { if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); Object.values(value).forEach(child => refs(child, seen)); } return seen; }
function independent(left, right) { const rightRefs = refs(right); for (const ref of refs(left)) assert.ok(!rightRefs.has(ref)); }
function keys(value, names) { assert.deepEqual(Object.keys(value).sort(), [...names].sort()); }
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const rgb = hex => [1, 3, 5].map(index => Math.pow(parseInt(hex.slice(index, index + 2), 16) / 255, 2.2));
const paletteA = rgb('#204080'), paletteB = rgb('#E08020'), red = rgb('#AA0000'), green = rgb('#00AA00'), blue = rgb('#0000AA');
const mixed = (a, b, ratio) => a.map((value, index) => { const result = value * (1 - ratio) + b[index] * ratio; return result === 0 ? 0 : result; });
const fill = value => [value, value, value], directRatio = .1 * (1 / 1000), arithmeticRatio = (1000 + (.1 - 1000) * 1) * (1 / 1000);
assert.notEqual(directRatio, arithmeticRatio);
const source = (body, declarations = '@uniform amount:float(0,1,.25);') => '// Original sample é😀\r\n@shader #sample { ' + declarations + ' @fragment {color:' + body + ';} }\r\n';
const groups = [
  { name: 'palette', source: source('select(amount,.5,#204080,#E08020)'), samples: [{ name: 'default_below', overrides: {}, resolved: { amount: .25 }, rgb: paletteA }, { name: 'equal', overrides: { amount: .5 }, resolved: { amount: .5 }, rgb: paletteB }, { name: 'above', overrides: { amount: .75 }, resolved: { amount: .75 }, rgb: paletteB }] },
  { name: 'scalar_endpoints', source: source('mix(#000,#fff,select(amount,.5,0,1))'), samples: [{ name: 'below_zero', overrides: { amount: 0 }, resolved: { amount: 0 }, rgb: fill(0) }, { name: 'equal_one', overrides: { amount: .5 }, resolved: { amount: .5 }, rgb: fill(1) }] },
  { name: 'literal_endpoint_order', source: source('mix(#000,#fff,select(amount,.5,1000,.1)/1000)', '@uniform amount:float(0,1,.5);'), samples: [{ name: 'default_equal_literal', overrides: {}, resolved: { amount: .5 }, rgb: fill(directRatio) }, { name: 'minimum_below', overrides: { amount: 0 }, resolved: { amount: 0 }, rgb: fill(1) }, { name: 'maximum_above', overrides: { amount: 1 }, resolved: { amount: 1 }, rgb: fill(directRatio) }] },
  { name: 'function_local', source: source('mix(chosen,#00A,.25)', '@uniform amount:float(0,1,.25);@fn shade(t:float(0,1)):color(select(t,.5,#A00,#0A0));@let chosen:color(shade(amount));'), samples: [{ name: 'default_below', overrides: {}, resolved: { amount: .25 }, rgb: mixed(red, blue, .25) }, { name: 'equal', overrides: { amount: .5 }, resolved: { amount: .5 }, rgb: mixed(green, blue, .25) }] },
  { name: 'signed_zero', source: source('select(amount,-0,#000,#fff)', '@uniform amount:float(-1,1,-0);'), samples: [{ name: 'default_equal', overrides: {}, resolved: { amount: 0 }, rgb: fill(1) }, { name: 'override_negative_zero', overrides: { amount: -0 }, resolved: { amount: 0 }, rgb: fill(1) }, { name: 'negative_below', overrides: { amount: -.25 }, resolved: { amount: -.25 }, rgb: fill(0) }] },
  { name: 'constructor_own_name', source: source('select(constructor,.5,#000,#fff)', '@uniform constructor:float(0,1,.25);'), samples: [{ name: 'default', overrides: {}, resolved: { constructor: .25 }, rgb: fill(0) }, { name: 'own_override', overrides: Object.fromEntries([['constructor', .75]]), resolved: { constructor: .75 }, rgb: fill(1) }] },
];
let accepted = 0, refused = 0, getters = 0, reflections = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  const compile = authored => { const result = gpu.compileDiscreteMeshMaterial(authored); assert.equal(result.ok, true, JSON.stringify(result)); return result.material; };
  for (const group of groups) {
    const material = compile(group.source), sourcePath = resolve(output, provider.label + '.' + group.name + '.source.css');
    const sourceFile = await save(sourcePath, group.source), irFile = await save(sourcePath + '.ir.json', signed(material) + '\n');
    for (const fixture of group.samples) {
      const input = { material: clone(material), uniforms: clone(fixture.overrides) }, before = signed(input), sample = gpu.evaluateDiscreteAuthoredMaterial(input);
      keys(sample, ['format', 'version', 'profile', 'colorSpace', 'source', 'material', 'uniforms', 'linearRGB']); assert.equal(sample.format, 'barocss-gpu-discrete-authored-material-sample'); assert.equal(sample.version, 0); assert.equal(sample.profile, 'binary64-discrete-linear-rgb-v0'); assert.equal(sample.colorSpace, 'linear-rgb');
      assert.equal(sample.source, group.source); assert.deepEqual(sample.material, material); assert.deepEqual(sample.uniforms, fixture.resolved); assert.deepEqual(sample.linearRGB, fixture.rgb);
      assert.equal(signed(input), before); assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(input.material), false); assert.equal(Object.isFrozen(input.uniforms), false); frozen(sample); independent(sample, input); independent(sample.material, material);
      for (const previous of retained) independent(sample, previous.sample);
      if (group.name === 'signed_zero' && fixture.name !== 'negative_below') { assert.ok(Object.is(sample.uniforms.amount, +0)); assert.ok(sample.source.includes('float(-1,1,-0)')); }
      if (fixture.name === 'override_negative_zero') assert.ok(Object.is(fixture.overrides.amount, -0));
      if (group.name === 'constructor_own_name') assert.ok(Object.hasOwn(sample.uniforms, 'constructor'));
      const prefix = resolve(output, provider.label + '.' + group.name + '.' + fixture.name), overridePath = prefix + '.overrides.json', samplePath = prefix + '.sample.json';
      const files = [sourceFile, irFile, await save(overridePath, signed(fixture.overrides) + '\n'), await save(samplePath, signed(sample) + '\n')];
      const record = { provider: provider.label, group: group.name, name: fixture.name, sourcePath, overridePath, samplePath, files, sampleSHA: hash(signed(sample)), rgb: fixture.rgb };
      records.push(record); coldCases.push(record); retained.push({ sample, digest: record.sampleSHA, files }); accepted++;
    }
  }
  async function retention() { assert.equal(getters, 0); for (const item of retained) { assert.equal(hash(signed(item.sample)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); } for (const file of oldFiles) assert.equal(hash(await readFile(file.path)), file.sha256); }
  const legacySource = '@shader #old_order {@fragment{color:mix(#000,#fff,mix(1000,.1,1)/1000);}}', legacy = gpu.compileMeshMaterial(legacySource); assert.equal(legacy.ok, true);
  const oldSample = gpu.evaluateAuthoredMaterial({ material: clone(legacy.material), uniforms: {} }); assert.deepEqual(oldSample.linearRGB, fill(arithmeticRatio)); assert.notDeepEqual(oldSample.linearRGB, fill(directRatio));
  assert.equal(oldSample.profile, 'binary64-linear-rgb-v0'); assert.equal(oldSample.uvUnit, 'dimensionless'); assert.equal(oldSample.uv, null);
  const oldFiles = [await save(resolve(output, provider.label + '.old-order.css'), legacySource), await save(resolve(output, provider.label + '.old-order.sample.json'), signed(oldSample) + '\n')];
  const ir = compile(groups[0].source), forged = clone(ir); forged.expression.threshold.value = .75;
  const malformed = clone(ir); malformed.source = source('select(-1,0,#000,missing)', '');
  const budget = clone(ir); budget.source = '/*' + 'x'.repeat(66000) + '*/';
  const unsafeDeclared = compile(source('select(amount,.5,#000,#fff)', '@uniform amount:float(0,1,.25);@uniform __proto__:float(0,1,.25);'));
  const unsafeOverrides = Object.fromEntries([['__proto__', .25]]);
  const checks = [
    ['root_primitive', null, 'INPUT'], ['root_extra_uv', { material: ir, uniforms: {}, uv: [0, 0] }, 'INPUT'],
    ['material_primitive', { material: null, uniforms: {} }, 'INPUT'], ['header_missing', { material: { format: ir.format, version: 0 }, uniforms: {} }, 'INPUT'],
    ['unsupported_version', { material: { ...ir, version: 1 }, uniforms: {} }, 'PROFILE'], ['legacy_profile', { material: legacy.material, uniforms: {} }, 'PROFILE'],
    ['uniform_primitive', { material: ir, uniforms: null }, 'UNIFORM'], ['uniform_unknown', { material: ir, uniforms: { missing: .25 } }, 'UNIFORM'],
    ['uniform_bounds', { material: ir, uniforms: { amount: 1.01 } }, 'UNIFORM'], ['uniform_nonfinite', { material: ir, uniforms: { amount: NaN } }, 'UNIFORM'],
    ['unsafe_override', { material: ir, uniforms: unsafeOverrides }, 'UNIFORM'], ['unsafe_declaration_default', { material: unsafeDeclared, uniforms: {} }, 'UNIFORM'],
    ['forged_complete_IR', { material: forged, uniforms: {} }, 'MATERIAL', 'IR'], ['invalid_unreachable_source', { material: malformed, uniforms: {} }, 'MATERIAL', 'IR'],
    ['actual_provider_budget', { material: budget, uniforms: {} }, 'BUDGET', 'BUDGET'],
  ];
  for (const [name, input, code, providerCode] of checks) {
    let error; try { gpu.evaluateDiscreteAuthoredMaterial(input); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.AuthoredMaterialEvaluationError, name); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024);
    if (providerCode) { assert.ok(error.cause instanceof gpu.MeshMaterialError); assert.equal(error.cause.code, providerCode); if (name === 'invalid_unreachable_source') { assert.equal(error.cause.cause.code, 'TYPE'); frozen(error.cause.cause); } }
    else assert.equal(error.cause, undefined, name);
    failures.push({ name, code: error.code, providerCode: error.cause?.code ?? null }); refused++; await retention();
  }
  const getterRoot = { uniforms: {} }; Object.defineProperty(getterRoot, 'material', { enumerable: true, get() { getters++; return ir; } });
  const getterUniform = {}; Object.defineProperty(getterUniform, 'amount', { enumerable: true, get() { getters++; return .25; } });
  for (const [name, input, code] of [['root_getter0', getterRoot, 'INPUT'], ['uniform_getter0', { material: ir, uniforms: getterUniform }, 'UNIFORM']]) {
    let error; try { gpu.evaluateDiscreteAuthoredMaterial(input); } catch (caught) { error = caught; } assert.ok(error instanceof gpu.AuthoredMaterialEvaluationError); assert.equal(error.code, code); assert.equal(error.cause, undefined); failures.push({ name, code }); refused++; await retention();
  }
  const missingRoot = new Proxy({ material: ir, uniforms: {} }, { ownKeys() { return ['material', 'uniforms']; }, getOwnPropertyDescriptor(target, key) { return key === 'uniforms' ? undefined : Reflect.getOwnPropertyDescriptor(target, key); } });
  const missingUniform = new Proxy({ amount: .25 }, { ownKeys() { return ['amount']; }, getOwnPropertyDescriptor() { return undefined; } });
  for (const [name, input, code] of [['root_snapshot_missing_descriptor', missingRoot, 'INPUT'], ['uniform_snapshot_missing_descriptor', { material: ir, uniforms: missingUniform }, 'UNIFORM']]) {
    let error; try { gpu.evaluateDiscreteAuthoredMaterial(input); } catch (caught) { error = caught; } assert.ok(error instanceof gpu.AuthoredMaterialEvaluationError); assert.equal(error.code, code); assert.equal(error.cause, undefined); failures.push({ name, code, localSnapshotGuard: true }); refused++; await retention();
  }
  for (const operation of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) for (const causeKind of ['branded', 'undefined']) {
    const marker = causeKind === 'undefined' ? undefined : new gpu.AuthoredMaterialEvaluationError('UNIFORM', 'Caller reflection sentinel');
    const proxy = new Proxy({ material: ir, uniforms: {} }, { [operation]() { reflections++; throw marker; } });
    let error; try { gpu.evaluateDiscreteAuthoredMaterial(proxy); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.AuthoredMaterialEvaluationError); assert.equal(error.code, 'INPUT'); assert.notStrictEqual(error, marker); const cause = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(cause && 'value' in cause); assert.strictEqual(cause.value, marker);
    failures.push({ name: operation + '.' + causeKind, code: error.code, freshExactOwnCause: true }); refused++; await retention();
  }
  let oldRejection; try { gpu.evaluateAuthoredMaterial({ material: ir, uniforms: {} }); } catch (caught) { oldRejection = caught; } assert.ok(oldRejection instanceof gpu.AuthoredMaterialEvaluationError); assert.equal(oldRejection.code, 'PROFILE'); refused++; await retention();
  rows.push({ provider: provider.label, records, failures, oldAPI: { profile: oldSample.profile, arithmeticRGB: oldSample.linearRGB, discreteRejected: oldRejection.code, files: oldFiles } });
}
for (let index = 0; index < rows[0].records.length; index++) assert.equal(rows[0].records[index].sampleSHA, rows[1].records[index].sampleSHA);
assert.equal(accepted, 30); assert.equal(reflections, 12); assert.equal(getters, 0);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';assert.equal(Number(process.versions.node.split('.')[0]),22);
const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=value=>createHash('sha256').update(value).digest('hex');function signed(value){if(typeof value==='number'){assert.ok(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}if(value===null||typeof value!=='object')return JSON.stringify(value);return Array.isArray(value)?'['+value.map(signed).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+signed(value[key])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const fixture of cfg.cases.filter(fixture=>fixture.provider===provider.label)){for(const file of fixture.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(fixture.sourcePath,'utf8'),compiled=gpu.compileDiscreteMeshMaterial(source);assert.equal(compiled.ok,true);const uniforms=JSON.parse(readFileSync(fixture.overridePath,'utf8')),sample=gpu.evaluateDiscreteAuthoredMaterial({material:compiled.material,uniforms});assert.equal(sample.source,source);assert.deepEqual(sample.linearRGB,fixture.rgb);assert.equal(hash(signed(sample)),fixture.sampleSHA);assert.deepEqual(sample,JSON.parse(readFileSync(fixture.samplePath,'utf8')));rows.push({provider:provider.label,group:fixture.group,name:fixture.name,sampleSHA:fixture.sampleSHA});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'complete original source plus overrides only; saved IR/sample are observations',actualGL:false}));`;
const coldPath = resolve(output, 'cold-discrete-samples.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' });
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 30);
const report = { issue: 1502, stage: 'DISCRETE_AUTHORED_MATERIAL_BINARY64_CPU', parent, node: process.version, accepted, refused, getters, reflections, namespace, namespaceCount: namespace.length, newTypes, sourceGraph, rows, cold,
  ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), oldPublicTypesAndSignaturePreserved: true, compilerAndShadersUnchanged: true,
  operationOrder: { selectedLiteral: directRatio, oldArithmeticMix: arithmeticRatio, distinct: true },
  support: 'Actual independent below/equal/above RGB, scalar endpoints and selected literal operation order, defaults/overrides/signedzero/purefunction/local, safe own names, frozen independent complete-source outputs and original-source cold reconstruction. Source validation retains both branches; runtime branch visit count is not instrumented.',
  actualGL: false, F32Parity: false, lightingOrOutputEncoding: false, rendererOrBindingAvailable: false, publication: false, unforcedDefensiveGuards: ['validCompleteSample2MiB', 'runtimeNumericalOrTraversalFailureFromValidSource'] };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ issue: 1502, accepted, refused, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
