/** #1479 ONE directional shader SOURCE/API/file/cold CPU qualifier. Node22 after GPU build.
 * node examples/gpu-scene/directional-light-shader-source-flow.mjs --output ABS_FRESH
 * Independent Number reference is not a shader/pixel/GL/frame/TEN certificate.
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
const parent = '3833ded7e03819f53c6817c79ff1a53c22526388', pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = v => createHash('sha256').update(v).digest('hex'), parentFile = n => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + n], { cwd: repo, encoding: 'utf8' });
const oldBarrel = parentFile('src/index.ts'), barrelAST = ts.createSourceFile('parent-index.ts', oldBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = barrelAST.statements.filter(n => ts.isExportDeclaration(n) && !n.isTypeOnly && n.exportClause && ts.isNamedExports(n.exportClause)).flatMap(n => n.exportClause.elements.filter(e => !e.isTypeOnly).map(e => e.name.text)).sort(); assert.equal(parentRuntime.length, 136);
const ordinary = resolve(output, 'ordinary-public.mjs'), bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/native-directional-light-shader-source.ts'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }]; for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const additions = ['prepareNativeDirectionalLightShaderSource', 'DirectionalLightShaderSourceError'], namespace = Object.keys(providers[0].gpu).sort(); assert.deepEqual(namespace, [...parentRuntime, ...additions].sort()); assert.equal(namespace.length, 138); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
assert.ok(!namespace.includes('directionalLightMeshShaderSource')); assert.ok(!namespace.includes('DirectionalLightShaderSourceDiagnosticCode'));
assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel)); assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));
const unchangedLeaves = ['mesh-shaders.ts', 'mesh-lighting.ts', 'mesh-material.ts', 'native-directional-lights.ts', 'mesh-renderer.ts', 'primitive-scene-renderer.ts'];
for (const leaf of unchangedLeaves) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), leafDTS = await readFile(resolve(pkg, 'dist/native-directional-light-shader-source.d.ts'), 'utf8');
const sixTypes = ['DirectionalLightShaderSourceCode', 'DirectionalLightShaderSlot', 'DirectionalLightShaderExecutionLight', 'DirectionalLightShaderExecution', 'DirectionalLightShaderABI', 'PreparedDirectionalLightShaderSource'];
for (const name of [...additions, ...sixTypes]) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDTS)); }
// Extract only the immutable parent's literal vertex text; never execute its shader generator.
const shaderAST = ts.createSourceFile('parent-mesh-shaders.ts', parentFile('src/mesh-shaders.ts'), ts.ScriptTarget.Latest, true);
const oldShaderDeclaration = shaderAST.statements.filter(ts.isVariableStatement).flatMap(n => n.declarationList.declarations).find(n => n.name.getText(shaderAST) === 'MESH_SHADERS'); assert.ok(oldShaderDeclaration && ts.isObjectLiteralExpression(oldShaderDeclaration.initializer));
const vertexNode = oldShaderDeclaration.initializer.properties.find(n => ts.isPropertyAssignment(n) && n.name.getText(shaderAST) === 'vertex'); assert.ok(ts.isNoSubstitutionTemplateLiteral(vertexNode.initializer)); const expectedVertex = vertexNode.initializer.text;
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); } if (v === null || typeof v !== 'object') return JSON.stringify(v); return Array.isArray(v) ? '[' + v.map(signed).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(x => refs(x, out)); } return out; }
function independent(a, b) { const right = refs(b); for (const ref of refs(a)) assert.ok(!right.has(ref)); }
function keys(v, names) { assert.deepEqual(Object.keys(v).sort(), [...names].sort()); }
function near(a, b, tolerance = 1e-14) { assert.ok(Math.abs(a - b) <= tolerance, a + ' differs from ' + b); }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const paletteA = [32, 48, 64].map(n => Math.pow(n / 255, 2.2)), paletteB = [255, 238, 221].map(n => Math.pow(n / 255, 2.2));
const vectorText = numbers => 'vec3(' + numbers.map(n => n.toPrecision(17)).join(',') + ')';
const paletteExpression = 'clamp(mix(' + vectorText(paletteA) + ',' + vectorText(paletteB) + ',clamp(mat_u_0,0.0,1.0)),vec3(0.0),vec3(1.0))';
const constantExpression = 'clamp(vec3(1.0000000000000000,1.0000000000000000,1.0000000000000000),vec3(0.0),vec3(1.0))';
// Independent fixed literal slot blocks; do not call the production emitter or generate its loop.
const declarationBlocks = {
  0: '',
  1: 'uniform vec3 nativeLightDirection_0;\nuniform vec3 nativeLightColor_0;\nuniform float nativeLightIntensity_0;',
  2: 'uniform vec3 nativeLightDirection_0;\nuniform vec3 nativeLightColor_0;\nuniform float nativeLightIntensity_0;\nuniform vec3 nativeLightDirection_1;\nuniform vec3 nativeLightColor_1;\nuniform float nativeLightIntensity_1;',
  4: 'uniform vec3 nativeLightDirection_0;\nuniform vec3 nativeLightColor_0;\nuniform float nativeLightIntensity_0;\nuniform vec3 nativeLightDirection_1;\nuniform vec3 nativeLightColor_1;\nuniform float nativeLightIntensity_1;\nuniform vec3 nativeLightDirection_2;\nuniform vec3 nativeLightColor_2;\nuniform float nativeLightIntensity_2;\nuniform vec3 nativeLightDirection_3;\nuniform vec3 nativeLightColor_3;\nuniform float nativeLightIntensity_3;',
};
const contributionBlocks = {
  0: '',
  1: ' light += nativeLightColor_0 * nativeLightIntensity_0 * max(dot(normalizedWorldNormal,nativeLightDirection_0),0.0);',
  2: ' light += nativeLightColor_0 * nativeLightIntensity_0 * max(dot(normalizedWorldNormal,nativeLightDirection_0),0.0);\n light += nativeLightColor_1 * nativeLightIntensity_1 * max(dot(normalizedWorldNormal,nativeLightDirection_1),0.0);',
  4: ' light += nativeLightColor_0 * nativeLightIntensity_0 * max(dot(normalizedWorldNormal,nativeLightDirection_0),0.0);\n light += nativeLightColor_1 * nativeLightIntensity_1 * max(dot(normalizedWorldNormal,nativeLightDirection_1),0.0);\n light += nativeLightColor_2 * nativeLightIntensity_2 * max(dot(normalizedWorldNormal,nativeLightDirection_2),0.0);\n light += nativeLightColor_3 * nativeLightIntensity_3 * max(dot(normalizedWorldNormal,nativeLightDirection_3),0.0);',
};
const expectedFragment = (count, materialKind) => `#version 300 es
precision highp float;
in vec3 worldNormal;
uniform float nativeAmbientStrength;
${materialKind === 'null' ? 'uniform vec3 color;' : materialKind === 'constant' ? '' : 'uniform float mat_u_0;'}
${declarationBlocks[count]}
out vec4 outputColor;
void main(){
 vec3 normalizedWorldNormal=normalize(worldNormal);
 vec3 light=vec3(nativeAmbientStrength);
${contributionBlocks[count]}
 vec3 baseLinear=${materialKind === 'null' ? 'pow(color,vec3(2.2))' : '(' + (materialKind === 'constant' ? constantExpression : paletteExpression) + ')'};
 vec3 linearRadiance=clamp(baseLinear*light,vec3(0.0),vec3(1.0));
 outputColor=vec4(pow(linearRadiance,vec3(1.0/2.2)),1.0);
}`;
const rawCatalog = { format: 'barocss-gpu-native-directional-lights', version: 0, profile: 'native-world-directional-linear-v0', sourceId: 'native-material-study', revision: 0, ambientStrength: .1,
  lights: [{ nodeId: 'red-key', label: 'Key é😀', enabled: true, directionScene: [2, -0, 0], colorLinearRGB: [1, -0, 0], intensity: .5 }, { nodeId: 'blue-fill', label: 'Blue\nFill', enabled: true, directionScene: [0, -0, 4], colorLinearRGB: [-0, 0, 1], intensity: .25 }] };
const materialSource = '/* Original é😀 shader / -0 retained. */\r\n@shader #palette { @uniform amount:float(-0,1,.25); @fragment {color:mix(#203040,#FFEEDD,amount);} }\r\n';
const constantSource = '@shader #constant { @fragment {color:#fff;} }';
const unsafeSource = '@shader #unsafe { @uniform __proto__:float(0,1,.5); @fragment {color:mix(#000,#fff,__proto__);} }';
const normal = [1 / Math.sqrt(2), 0, 1 / Math.sqrt(2)], encodedColor = [.4, .6, .8];
function CPUReference(result, materialKind, amount) { const light = [result.execution.ambientStrength, result.execution.ambientStrength, result.execution.ambientStrength];
  for (const entry of result.execution.lights) { const dot = Math.max(0, entry.unitDirection.reduce((sum, n, axis) => sum + n * normal[axis], 0)); for (let axis = 0; axis < 3; axis++) light[axis] += entry.colorLinearRGB[axis] * entry.intensity * dot; }
  const base = materialKind === 'null' ? encodedColor.map(n => Math.pow(n, 2.2)) : materialKind === 'constant' ? [1, 1, 1] : paletteA.map((n, axis) => n * (1 - amount) + paletteB[axis] * amount);
  const radiance = base.map((n, axis) => Math.min(Math.max(n * light[axis], 0), 1)), output = radiance.map(n => Math.pow(n, 1 / 2.2)); return { light, base, radiance, output, CPUReferenceOnly: true }; }
let accepted = 0, refused = 0, getters = 0, reflections = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  const compile = source => { const r = gpu.compileMeshMaterial(source); assert.equal(r.ok, true, JSON.stringify(r)); return r.material; }, material = compile(materialSource), constant = compile(constantSource);
  const editedCatalog = clone(rawCatalog); editedCatalog.revision = 1; editedCatalog.lights[0].intensity = .75;
  const disabledCatalog = clone(editedCatalog); disabledCatalog.revision = 2; disabledCatalog.lights[0].enabled = false;
  const removedCatalog = clone(disabledCatalog); removedCatalog.revision = 3; removedCatalog.lights.shift();
  const reordered = clone(rawCatalog); reordered.revision = 4; reordered.lights.reverse();
  const four = clone(rawCatalog); four.ambientStrength = 1; four.lights.push({ nodeId: 'white-a', label: 'A', enabled: true, directionScene: [1, 0, 1], colorLinearRGB: [1, 1, 1], intensity: 1 }, { nodeId: 'white-b', label: 'B', enabled: true, directionScene: [1, 0, 1], colorLinearRGB: [1, 1, 1], intensity: 1 });
  const tiny = { ...clone(rawCatalog), lights: [{ nodeId: 'tiny', label: 'Subnormal', enabled: true, directionScene: [Number.MIN_VALUE, -0, Number.MIN_VALUE], colorLinearRGB: [1, 1, 1], intensity: 1 }] };
  const nullRecord = Object.assign(Object.create(null), { lights: Object.assign(Object.create(null), clone(rawCatalog)), material: null });
  const request = (lights, uniforms = {}, kind = 'palette') => ({ lights: clone(lights), material: kind === 'null' ? null : { material: clone(kind === 'constant' ? constant : material), uniforms } });
  const cases = [{ name: 'bound_default_two_lights', input: request(rawCatalog), kind: 'palette', amount: .25 }, { name: 'bound_uniform_update', input: request(rawCatalog, { amount: .75 }), kind: 'palette', amount: .75 },
    { name: 'edited_light_stable_id', input: request(editedCatalog), kind: 'palette', amount: .25 }, { name: 'disabled_effective_zero', input: request(disabledCatalog), kind: 'palette', amount: .25 },
    { name: 'removed_light_compacts_slot', input: request(removedCatalog), kind: 'palette', amount: .25 }, { name: 'source_order_slots', input: request(reordered), kind: 'palette', amount: .25 },
    { name: 'zero_lights_null_material', input: request({ ...clone(rawCatalog), lights: [] }, {}, 'null'), kind: 'null' }, { name: 'four_lights_post_product_saturation', input: request(four, {}, 'constant'), kind: 'constant' },
    { name: 'subnormal_null_material', input: request(tiny, {}, 'null'), kind: 'null' }, { name: 'signed_uniform_zero', input: request(rawCatalog, { amount: -0 }), kind: 'palette', amount: 0 },
    { name: 'own_null_request_catalog', input: nullRecord, kind: 'null' }];
  for (const c of cases) {
    const before = signed(c.input), result = gpu.prepareNativeDirectionalLightShaderSource(c.input); assert.equal(signed(c.input), before); assert.equal(Object.isFrozen(c.input), false); independent(result, c.input); frozen(result);
    keys(result, ['format', 'version', 'profile', 'catalog', 'material', 'execution', 'abi', 'shaders']); assert.equal(result.format, 'barocss-gpu-native-directional-light-shader-source'); assert.equal(result.version, 0); assert.equal(result.profile, 'native-world-directional-linear-mesh-opaque-v0'); assert.deepEqual(result.catalog, clone(c.input.lights));
    keys(result.execution, ['ambientStrength', 'lights', 'materialUniforms']); keys(result.abi, ['ambientUniform', 'colorUniform', 'lights', 'materialUniforms']); assert.equal(result.abi.ambientUniform, 'nativeAmbientStrength'); assert.equal(result.abi.colorUniform, c.kind === 'null' ? 'color' : null);
    assert.equal(result.execution.lights.length, c.input.lights.lights.length); assert.equal(result.abi.lights.length, c.input.lights.lights.length);
    for (let index = 0; index < c.input.lights.lights.length; index++) { const raw = c.input.lights.lights[index], slot = result.abi.lights[index], exec = result.execution.lights[index];
      keys(slot, ['nodeId', 'index', 'directionUniform', 'colorUniform', 'intensityUniform']); assert.deepEqual(slot, { nodeId: raw.nodeId, index, directionUniform: 'nativeLightDirection_' + index, colorUniform: 'nativeLightColor_' + index, intensityUniform: 'nativeLightIntensity_' + index });
      keys(exec, ['nodeId', 'index', 'unitDirection', 'colorLinearRGB', 'intensity']); assert.equal(exec.nodeId, raw.nodeId); assert.equal(exec.index, index); assert.deepEqual(exec.colorLinearRGB, raw.colorLinearRGB); assert.equal(exec.intensity, raw.enabled ? raw.intensity : 0); if (!raw.enabled) assert.ok(Object.is(exec.intensity, +0)); near(Math.hypot(...exec.unitDirection), 1);
    }
    if (c.kind === 'palette') { assert.deepEqual(result.material.material, material); assert.deepEqual(result.material.uniforms, { amount: c.amount }); assert.deepEqual(result.abi.materialUniforms, [{ name: 'amount', glslName: 'mat_u_0' }]); assert.deepEqual(result.execution.materialUniforms, [{ name: 'amount', glslName: 'mat_u_0', value: c.amount }]); if (c.amount === 0) assert.ok(Object.is(result.material.uniforms.amount, +0)); }
    else { assert.deepEqual(result.abi.materialUniforms, []); assert.deepEqual(result.execution.materialUniforms, []); if (c.kind === 'null') assert.equal(result.material, null); else assert.deepEqual(result.material, { material: constant, uniforms: {} }); }
    assert.deepEqual(result.shaders, { vertex: expectedVertex, fragment: expectedFragment(result.catalog.lights.length, c.kind) }); for (const text of Object.values(result.shaders)) assert.ok(text.length <= 65536 && Buffer.byteLength(text) <= 65536);
    assert.equal((result.shaders.fragment.match(/normalize\(worldNormal\)/g) ?? []).length, 1); assert.ok(!/\bfor\s*\(|uniform\s+float\s+directionalStrength\b/.test(result.shaders.fragment));
    for (const [a, b] of [[result.catalog, result.execution], [result.abi, result.execution], [result.material, result.abi]]) independent(a, b); for (const previous of retained) independent(result, previous.result);
    const reference = CPUReference(result, c.kind, c.amount);
    if (c.name === 'bound_default_two_lights') { const expectedLight = [.1 + .5 / Math.sqrt(2), .1, .1 + .25 / Math.sqrt(2)]; expectedLight.forEach((n, axis) => near(reference.light[axis], n)); }
    if (c.kind === 'constant') { assert.ok(reference.light.every(n => n > 1)); assert.deepEqual(reference.radiance, [1, 1, 1]); assert.deepEqual(reference.output, [1, 1, 1]); }
    const prefix = resolve(output, provider.label + '.' + c.name), requestPath = prefix + '.raw-request.json', resultPath = prefix + '.whole-result.json', vertexPath = prefix + '.vertex.glsl', fragmentPath = prefix + '.fragment.glsl';
    const files = [await save(requestPath, before + '\n'), await save(resultPath, signed(result) + '\n'), await save(vertexPath, result.shaders.vertex), await save(fragmentPath, result.shaders.fragment)];
    if (c.input.material !== null) files.push(await save(prefix + '.material.css', c.input.material.material.source));
    const record = { provider: provider.label, name: c.name, kind: c.kind, amount: c.amount ?? null, requestPath, resultPath, vertexPath, fragmentPath, files, digest: hash(signed(result)), reference };
    records.push(record); coldCases.push(record); retained.push({ result, files, digest: record.digest }); accepted++;
  }
  assert.deepEqual(retained[0].result.shaders, retained[1].result.shaders); assert.notDeepEqual(retained[0].result.execution.materialUniforms, retained[1].result.execution.materialUniforms);
  const bad = (name, edit, code, providerCode = null) => { const value = request(rawCatalog); edit(value); return { name, value, code, providerCode }; };
  const checks = [bad('extra_request_field', r => r.shader = 'caller GLSL', 'INPUT'), { name: 'partial_request', value: { lights: clone(rawCatalog) }, code: 'INPUT' }, { name: 'foreign_request', value: new Date(), code: 'INPUT' },
    bad('request_getter0', r => Object.defineProperty(r, 'material', { enumerable: true, get() { getters++; return null; } }), 'INPUT'),
    bad('prepared_catalog_rejected', r => r.lights = gpu.prepareNativeDirectionalLights(r.lights), 'LIGHTS', 'INPUT'),
    bad('duplicate_light_id', r => r.lights.lights[1].nodeId = r.lights.lights[0].nodeId, 'LIGHTS', 'IDENTITY'),
    bad('catalog_profile', r => r.lights.profile = 'other', 'LIGHTS', 'VERSION'), bad('nonfinite_direction', r => r.lights.lights[0].directionScene[0] = Infinity, 'LIGHTS', 'NUMERICAL'),
    bad('inventory_count5', r => r.lights.lights.push(...Array.from({ length: 3 }, (_, i) => ({ ...clone(rawCatalog.lights[0]), nodeId: 'extra-' + i }))), 'LIGHTS', 'BUDGET'),
    bad('material_null_prototype', r => r.material = Object.assign(Object.create(null), r.material), 'MATERIAL', 'INPUT'),
    bad('forged_material_IR', r => r.material.material.expression = { kind: 'color', type: 'color', hex: '#FFFFFF', linear: [1, 1, 1] }, 'MATERIAL', 'IR'),
    bad('unknown_uniform', r => r.material.uniforms.extra = .5, 'MATERIAL', 'UNIFORM'), bad('uniform_range', r => r.material.uniforms.amount = 2, 'MATERIAL', 'UNIFORM'),
    bad('material_getter0', r => Object.defineProperty(r.material, 'uniforms', { enumerable: true, get() { getters++; return {}; } }), 'MATERIAL', 'INPUT')];
  const uv = gpu.compileEngineUVMaterial('@shader #uv { @fragment {color:mix(#000,#fff,clamp(uv_u,0,1));} }'); assert.equal(uv.ok, true); checks.push(bad('wrong_EngineUV_profile', r => r.material.material = uv.material, 'MATERIAL', 'IR'));
  const unsafeIR = compile(unsafeSource); checks.push({ name: 'actual_proto_uniform_resolved_not_numeric', value: { lights: clone(rawCatalog), material: { material: unsafeIR, uniforms: Object.fromEntries([['__proto__', .75]]) } }, code: 'MATERIAL', noCause: true });
  const marker = new gpu.DirectionalLightShaderSourceError('MATERIAL', 'caller same-class reflection marker'); checks.push({ name: 'raw_request_reflection', value: new Proxy(request(rawCatalog), { ownKeys() { reflections++; throw marker; } }), code: 'INPUT', exactCause: marker });
  async function retention() { assert.equal(getters, 0); for (const previous of retained) { assert.equal(hash(signed(previous.result)), previous.digest); for (const file of previous.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  for (const c of checks) { let error; try { gpu.prepareNativeDirectionalLightShaderSource(c.value); } catch (e) { error = e; } assert.ok(error instanceof gpu.DirectionalLightShaderSourceError, c.name); assert.equal(error.code, c.code, c.name); assert.ok(error.message.length <= 1024);
    if (c.exactCause) { assert.notStrictEqual(error, c.exactCause); assert.strictEqual(error.cause, c.exactCause); }
    else if (c.providerCode) { assert.ok(error.cause instanceof (c.code === 'LIGHTS' ? gpu.NativeDirectionalLightsError : gpu.MeshMaterialError)); assert.equal(error.cause.code, c.providerCode, c.name); }
    else { assert.equal(error.cause, undefined); assert.equal(Object.hasOwn(error, 'cause'), false); }
    failures.push({ name: c.name, code: error.code, providerCode: error.cause?.code ?? null, causeName: error.cause?.name ?? null, exactReflectionCause: Boolean(c.exactCause), priorFilesRetained: true }); refused++; await retention(); }
  rows.push({ provider: provider.label, records, failures, noCallerFreeze: true });
}
for (let i = 0; i < rows[0].records.length; i++) assert.equal(rows[0].records[i].digest, rows[1].records[i].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const c of cfg.cases.filter(c=>c.provider===provider.label)){for(const file of c.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const request=JSON.parse(readFileSync(c.requestPath,'utf8')),before=signed(request),result=gpu.prepareNativeDirectionalLightShaderSource(request);assert.equal(signed(request),before);assert.equal(hash(signed(result)),c.digest);assert.deepEqual(result,JSON.parse(readFileSync(c.resultPath,'utf8')));assert.equal(result.shaders.vertex,readFileSync(c.vertexPath,'utf8'));assert.equal(result.shaders.fragment,readFileSync(c.fragmentPath,'utf8'));if(request.material){const sourceFile=c.files.find(f=>f.path.endsWith('.material.css'));assert.equal(request.material.material.source,readFileSync(sourceFile.path,'utf8'));}rows.push({provider:provider.label,name:c.name,digest:c.digest});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentPreparedAuthority:false,actualGL:false}));`;
const coldPath = resolve(output, 'cold-raw-directional-shader-requests.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, coldCases.length);
const report = { issue: 1479, stage: 'NATIVE_DIRECTIONAL_LIGHT_SHADER_SOURCE_CPU', parent, node: process.version, accepted, refused, getters, reflections, namespaceCount: namespace.length, namespace, parentRuntime, sourceGraph, rows, cold,
  ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), sixTypes, unchangedLeaves, oldBarrelPrefixAndManifestPreserved: true,
  defensiveShaderAndWholeResultOverflowForced: false, CPUReferenceOnly: true, actualGL: false, linkedShader: false, uniformUpload: false, frameAdmission: false, nativeTENJoin: false,
  support: 'Complete raw directional catalog and legacy material binding reconstruct trusted source plus explicit ordered ABI/execution; independent fragment literals and immutable parent vertex, signed originals/canonical material/effective disabled values, full-request/source/shader/result files and genuine cold reconstruction. No GL/pixel/photometric/Viewer/Render state or publication certificate.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ issue: 1479, accepted, refused, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
