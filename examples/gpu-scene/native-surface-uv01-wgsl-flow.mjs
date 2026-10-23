/** #1552 ONE native Surface UV01 WGSL source/emitted/original-file/cold flow.
 * node examples/gpu-scene/native-surface-uv01-wgsl-flow.mjs --output ABS_FRESH
 * No device, browser, fake GPU, program/frame, prior producer or GLSL flow.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';

assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]);
await mkdir(output, { recursive: false });
const parent = '04f7b933c6126c1748e594749100a14885cc7b8c', pkg = resolve(repo, 'packages/barocss-gpu');
const hash = value => createHash('sha256').update(value).digest('hex');
function signed(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || typeof value !== 'object') return JSON.stringify(value); return Array.isArray(value) ? '[' + value.map(signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}'; }
const clone = value => JSON.parse(signed(value));
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, seen = new Set()) { if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); Object.values(value).forEach(child => refs(child, seen)); } return seen; }
function independent(left, right) { const other = refs(right); for (const value of refs(left)) assert.ok(!other.has(value), 'Independent original/lowered graphs'); }
const gitFile = path => execFileSync('git', ['show', parent + ':' + path], { cwd: repo, encoding: 'utf8' });
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(name, text) { const path = resolve(output, name); await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const owned = ['packages/barocss-gpu/src/native/uv01/native-surface-uv01-material-wgsl.ts', 'packages/barocss-gpu/src/native/uv01/native-surface-uv01-wgsl-body.ts', 'packages/barocss-gpu/src/index.ts', 'packages/barocss-gpu/README.md', 'examples/gpu-scene/native-surface-uv01-wgsl-flow.mjs'];
const tracked = execFileSync('git', ['diff', '--name-only', parent], { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const delta = [...new Set([...tracked, ...untracked])].sort(); assert.deepEqual(delta, [...owned].sort());
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8')); assert.deepEqual(manifest, JSON.parse(gitFile('packages/barocss-gpu/package.json')));
const ordinary = resolve(output, 'ordinary-public.mjs'), cadAlias = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await build({ absWorkingDir: repo, alias: { '@barocss/cad': cadAlias }, entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = [], physicalRepo = await realpath(repo);
for (const path of Object.keys(bundled.metafile.inputs).sort()) {
  const absolute = resolve(repo, path), bytes = await readFile(absolute), start = path.indexOf('packages/barocss-'), packagePath = start < 0 ? null : path.slice(start).replaceAll('\\', '/');
  assert.ok(!/(?:^|\/)node_modules\/(?:@barocss|barocss-)/.test(path), 'No shared package provider');
  if (packagePath !== null) { assert.ok(!/(?:^|\/)dist\//.test(packagePath)); assert.equal(relative(repo, absolute).replaceAll('\\', '/'), packagePath); assert.ok((await realpath(absolute)).startsWith(physicalRepo + sep)); if (!owned.includes(packagePath)) assert.deepEqual(bytes, execFileSync('git', ['show', parent + ':' + packagePath], { cwd: repo }), packagePath); }
  sourceGraph.push({ path, packagePath, bytes: bytes.length, sha256: hash(bytes) });
}
for (const leaf of ['native-surface-uv01-material-wgsl.ts', 'native-surface-uv01-wgsl-body.ts', 'mesh-material.ts']) assert.ok(sourceGraph.some(row => row.path.endsWith('/src/' + leaf)));
const parentBarrel = gitFile('packages/barocss-gpu/src/index.ts'), ast = ts.createSourceFile('parent.ts', parentBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = ast.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)).flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort();
assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentBarrel));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.deepEqual(namespace, [...parentRuntime, 'lowerNativeSurfaceUV01MaterialWGSL'].sort()); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
const dts = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), leafDTS = await readFile(resolve(pkg, 'dist/native-surface-uv01-material-wgsl.d.ts'), 'utf8');
for (const name of ['lowerNativeSurfaceUV01MaterialWGSL', 'LoweredNativeSurfaceUV01MaterialWGSL']) { assert.ok(new RegExp('\\b' + name + '\\b').test(dts)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDTS)); }

const literal = value => Math.fround(value).toExponential(8) + 'f';
const color = hex => 'vec3<f32>(' + [1, 3, 5].map(i => literal(Math.pow(parseInt(hex.slice(i, i + 2), 16) / 255, 2.2))).join(',') + ')';
const clipped = expression => 'clamp(' + expression + ',vec3<f32>(0.0),vec3<f32>(1.0))';
const fixtures = [
  { name: 'two_original_native_axes', source: '@shader #native_webgpu_gradient { @uniform amount:float(0,1,.25); @fragment { color:mix(#000,#fff,clamp(surface_u01*amount+surface_v01*.5,0,1)); } }',
    expected: clipped('material_mix(vec3<f32>(0.00000000e+0f,0.00000000e+0f,0.00000000e+0f),vec3<f32>(1.00000000e+0f,1.00000000e+0f,1.00000000e+0f),clamp(((native_surface_uv01.x*materialParams.slot[0].x)+(native_surface_uv01.y*5.00000000e-1f)),0.00000000e+0f,1.00000000e+0f))') },
  { name: 'original_constant_linear_coefficients', source: '// Complete original é😀\r\n@shader #native_constant { @fragment { color:#204080; } }\r\n', expected: clipped(color('#204080')) },
];
let accepted = 0, refused = 0, getters = 0, reflections = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], retained = [], failures = [];
  for (const fixture of fixtures) {
    const compiled = gpu.compileNativeSurfaceUV01Material(fixture.source); assert.equal(compiled.ok, true, fixture.name);
    const original = compiled.material, caller = clone(original), before = signed(caller), result = gpu.lowerNativeSurfaceUV01MaterialWGSL(caller), again = gpu.lowerNativeSurfaceUV01MaterialWGSL(original);
    keys(result, ['format', 'version', 'profile', 'material', 'expression', 'declarations', 'uniformLayout', 'uniformByteLength', 'input']);
    assert.equal(result.format, 'barocss-gpu-native-surface-uv01-material-wgsl'); assert.equal(result.version, 0); assert.equal(result.profile, 'native-surface-opaque-uv01-fragment-wgsl-v0'); assert.equal(result.uniformByteLength, 64);
    assert.deepEqual(result.input, { name: 'native_surface_uv01', type: 'vec2<f32>', domain: 'native-surface-normalized-uv01' }); assert.equal(result.expression, fixture.expected); assert.equal(result.declarations, 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n');
    assert.equal(result.material.source, fixture.source); assert.deepEqual(result.material, original); assert.equal(signed(caller), before); assert.equal(Object.isFrozen(caller), false); independent(result, caller); independent(result, again); assert.deepEqual(result, again); frozen(result);
    assert.deepEqual(result.uniformLayout, original.uniforms.map((uniform, index) => ({ ...uniform, index, byteOffset: 4 * index, access: 'materialParams.slot[' + Math.floor(index / 4) + '].' + 'xyzw'[index % 4] })));
    assert.ok(!/uv_u|uv_v|material_uv|textureSample|@vertex|@fragment|@group|pow\(.*1\.0\//.test(result.expression + result.declarations));
    assert.ok(result.expression.length <= 65536 && new TextEncoder().encode(result.expression).length <= 65536); assert.ok(result.declarations.length <= 65536 && new TextEncoder().encode(result.declarations).length <= 65536); assert.ok(signed(result).length <= 2097152 && new TextEncoder().encode(signed(result)).length <= 2097152);
    if (fixture.name === 'two_original_native_axes') { assert.equal(result.uniformLayout.length, 1); assert.deepEqual(result.uniformLayout[0], { name: 'amount', type: 'float', min: 0, max: 1, default: .25, index: 0, byteOffset: 0, access: 'materialParams.slot[0].x' }); }
    else { assert.equal(result.uniformLayout.length, 0); const expectedLinear = [32, 64, 128].map(n => Math.pow(n / 255, 2.2)); assert.deepEqual(result.material.expression.linear, expectedLinear); assert.ok(expectedLinear.some(n => n !== Math.fround(n))); }
    const sourceFile = await save(provider.label + '.' + fixture.name + '.original.css', fixture.source), irFile = await save(provider.label + '.' + fixture.name + '.original-ir.json', signed(original) + '\n');
    const expressionFile = await save(provider.label + '.' + fixture.name + '.expression.wgsl', result.expression), declarationFile = await save(provider.label + '.' + fixture.name + '.declarations.wgsl', result.declarations), resultFile = await save(provider.label + '.' + fixture.name + '.wgsl-observation.json', signed(result) + '\n');
    const record = { provider: provider.label, name: fixture.name, signature: hash(signed(result)), sourceFile, irFile, expressionFile, declarationFile, resultFile }; records.push(record); coldCases.push(record); retained.push({ result, record }); accepted++;
  }
  async function retention() { assert.equal(getters, 0); for (const { result, record } of retained) { assert.equal(hash(signed(result)), record.signature); for (const file of [record.sourceFile, record.irFile, record.expressionFile, record.declarationFile, record.resultFile]) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  async function reject(name, input, code, inspect) { let error; try { gpu.lowerNativeSurfaceUV01MaterialWGSL(input); } catch (caught) { error = caught; } assert.ok(error instanceof gpu.MeshMaterialError, name); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024); inspect?.(error); failures.push({ name, code: error.code, start: error.start, end: error.end, cause: error.cause instanceof Error ? { name: error.cause.name, code: error.cause.code ?? null } : null }); refused++; await retention(); }
  const material = retained[0].result.material;
  const legacy = gpu.compileMeshMaterial('@shader #legacy { @fragment { color:#fff; } }'); assert.equal(legacy.ok, true); await reject('legacy_IR_is_not_native_domain', legacy.material, 'IR');
  const generic = gpu.compileEngineUVMaterial('@shader #generic { @fragment { color:mix(#000,#fff,clamp(uv_u,0,1)); } }'); assert.equal(generic.ok, true); await reject('generic_UV_IR_is_not_native_domain', generic.material, 'IR');
  const forged = clone(material); forged.expression.args[2].args[0].left.left.name = 'uv_u'; await reject('forged_native_axis', forged, 'IR');
  const sourceMismatch = clone(material); sourceMismatch.source = sourceMismatch.source.replace('surface_v01*.5', 'surface_v01*.25'); await reject('full_source_IR_mismatch', sourceMismatch, 'IR');
  await reject('lowered_result_not_IR', retained[0].result, 'IR');
  const getter = clone(material); Object.defineProperty(getter, 'source', { enumerable: true, get() { getters++; return material.source; } }); await reject('own_source_getter0', getter, 'INPUT', error => assert.equal(Object.hasOwn(error, 'cause'), false));
  for (const kind of ['plain', 'branded']) { const marker = kind === 'plain' ? new Error('Actual native reflection marker') : new gpu.MeshMaterialError('UNIFORM', 'Actual native reflective cause', 19, 23); const proxy = new Proxy(clone(material), { getPrototypeOf() { reflections++; throw marker; } }); await reject('raw_reflection_' + kind, proxy, 'INPUT', error => { assert.notStrictEqual(error, marker); const cause = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(cause && 'value' in cause); assert.strictEqual(cause.value, marker); assert.equal(error.start, 0); assert.equal(error.end, 0); }); }
  for (const [name, source] of [['literal', '@shader #tiny { @fragment { color:mix(#000,#fff,1e-50); } }'], ['default', '@shader #tiny { @uniform tiny:float(0,1,1e-50); @fragment { color:#fff; } }']]) { const compiled = gpu.compileNativeSurfaceUV01Material(source); assert.equal(compiled.ok, true); await reject('f32_underflow_' + name, compiled.material, 'RANGE', error => { assert.equal(error.start, 0); assert.equal(error.end, 0); assert.equal(Object.hasOwn(error, 'cause'), false); }); }
  await retention(); rows.push({ provider: provider.label, records, failures });
}
for (let index = 0; index < fixtures.length; index++) assert.equal(rows[0].records[index].signature, rows[1].records[index].signature);
assert.equal(getters, 0); assert.equal(reflections, 4);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');function signed(v){if(typeof v==='number'){assert.ok(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}const rows=[];
for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const record of cfg.cases.filter(row=>row.provider===provider.label)){for(const file of[record.sourceFile,record.irFile,record.expressionFile,record.declarationFile,record.resultFile])assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(record.sourceFile.path,'utf8'),compiled=gpu.compileNativeSurfaceUV01Material(source);assert.equal(compiled.ok,true);assert.equal(compiled.material.source,source);assert.deepEqual(compiled.material,JSON.parse(readFileSync(record.irFile.path,'utf8')));const result=gpu.lowerNativeSurfaceUV01MaterialWGSL(compiled.material);assert.equal(hash(signed(result)),record.signature);assert.equal(result.expression,readFileSync(record.expressionFile.path,'utf8'));assert.equal(result.declarations,readFileSync(record.declarationFile.path,'utf8'));assert.deepEqual(result,JSON.parse(readFileSync(record.resultFile.path,'utf8')));rows.push({provider:provider.label,name:record.name,signature:record.signature});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'complete original CSS recompiled; IR/WGSL/result are retained observations',actualGPU:false,actualGL:false,fakeGPU:false}));`;
const coldScript = await save('cold-native-surface-uv01-wgsl.mjs', coldCode), coldConfig = await save('cold-config.json', JSON.stringify({ namespace, providers: providers.map(({ label, path }) => ({ label, path })), cases: coldCases }, null, 2) + '\n');
const stdout = execFileSync(process.execPath, [coldScript.path, coldConfig.path], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await save('cold.stdout', stdout); const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 4);
const report = { issue: 1552, parent, stage: 'NATIVE_SURFACE_UV01_WGSL_SOURCE_API_FILE_COLD', node: process.version, accepted, refused, getters, reflections, namespaceCount: namespace.length, namespace, delta, sourceGraph, cadAlias, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), rows, cold,
  actualGPU: false, actualGL: false, fakeGPU: false, programs: false, frames: false, sampledPixels: false, producerFlowsReplayed: false, publication: false,
  support: 'Complete original native UV01 source/IR to typed WGSL expression/declarations/input ABI/layout64; independent text/literal/domain checks, ownership/errors/file retention and one genuine child/four cold rows. No original native Surface attribute/frame/TEN join, shader-module/device/program/upload/render/output-encoding/light/picking/consumer or publication qualification.', unforcedDefensiveCeilings: ['valid256VisitsDepth16', 'valid64KiBTexts', 'valid2MiBCompleteResult'] };
const result = await save('actual-result.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ issue: 1552, accepted, refused, getters, reflections, namespaceCount: namespace.length, freshChildCount: 1, coldRows: cold.rows.length, actualGPU: false, result }));
