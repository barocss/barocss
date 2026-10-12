/** #1578 ONE source/emitted/types/raw-file/cold qualifier. Node22 after GPU build.
 * node examples/gpu-scene/native-directional-light-program-wgsl-flow.mjs --output ABS_FRESH
 * CPU reference arithmetic is not GPU compilation, upload, rendered pixels or frame admission.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import ts from 'typescript';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = resolve(repo, 'packages/barocss-gpu');
const base = '5ee1e4819326a857e095262b47fca90e354fbebe';
const additions = ['NativeDirectionalLightProgramWGSLError', 'prepareNativeDirectionalLightProgramWGSL'];
const eightTypes = ['NativeDirectionalLightProgramWGSLCode', 'NativeDirectionalLightProgramWGSLRequest', 'NativeDirectionalLightProgramWGSLSlot', 'NativeDirectionalLightProgramWGSLExecution', 'NativeDirectionalLightProgramWGSLABI', 'NativeDirectionalLightProgramWGSLProgram', 'NativeDirectionalLightProgramWGSLUniforms', 'PreparedNativeDirectionalLightProgramWGSL'];
const hash = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trimEnd();
const parentFile = name => execFileSync('git', ['show', base + ':' + name], { cwd: repo, encoding: 'utf8' });
function signed(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return Array.isArray(value) ? '[' + value.map(signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}';
}
const clone = value => JSON.parse(signed(value));
function keys(value, expected) { assert.deepEqual(Object.keys(value).sort(), [...expected].sort()); }
function frozen(value) { if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, output = new Set()) { if (value && typeof value === 'object' && !output.has(value)) { output.add(value); if (ArrayBuffer.isView(value)) output.add(value.buffer); else Object.values(value).forEach(child => refs(child, output)); } return output; }
function independent(left, right) { const all = refs(right); for (const value of refs(left)) assert.ok(!all.has(value)); }
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-14, `${a} != ${b}`); }
function compile(gpu, source) { const result = gpu.compileMeshMaterial(source); assert.equal(result.ok, true, JSON.stringify(result)); return result.material; }
const materialSource = '/* Original é😀 / signed -0 source */\r\n@shader #palette { @uniform amount:float(-0,1,.25); @fragment {color:mix(#000,#fff,amount);} }\r\n';
const constantSource = '@shader #constant { @fragment {color:#fff;} }';
const sixteenSource = '@shader #sixteen {' + Array.from({ length: 16 }, (_, i) => `@uniform u${i}:float(0,1,${i / 16});`).join('') + '@fragment {color:mix(#000,#fff,u15);} }';
const materialExpression = 'clamp(material_mix(vec3<f32>(0.00000000e+0f,0.00000000e+0f,0.00000000e+0f),vec3<f32>(1.00000000e+0f,1.00000000e+0f,1.00000000e+0f),materialParams.slot[0].x),vec3<f32>(0.0),vec3<f32>(1.0))';
const constantExpression = 'clamp(vec3<f32>(1.00000000e+0f,1.00000000e+0f,1.00000000e+0f),vec3<f32>(0.0),vec3<f32>(1.0))';
// Independently literal complete module and terms. No production emitter/lowerer generates expectations.
const terms = [
  '  light += lightParams.slot[0].color.xyz * lightParams.slot[0].directionIntensity.w * max(dot(normalizedWorldNormal, lightParams.slot[0].directionIntensity.xyz), 0.0);',
  '  light += lightParams.slot[1].color.xyz * lightParams.slot[1].directionIntensity.w * max(dot(normalizedWorldNormal, lightParams.slot[1].directionIntensity.xyz), 0.0);',
  '  light += lightParams.slot[2].color.xyz * lightParams.slot[2].directionIntensity.w * max(dot(normalizedWorldNormal, lightParams.slot[2].directionIntensity.xyz), 0.0);',
  '  light += lightParams.slot[3].color.xyz * lightParams.slot[3].directionIntensity.w * max(dot(normalizedWorldNormal, lightParams.slot[3].directionIntensity.xyz), 0.0);',
];
function expectedProgram(count, kind) { return `struct MaterialParams {
  slot: array<vec4<f32>, 4>,
}
struct FrameParams {
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
  color: vec4<f32>,
}
struct LightSlot {
  directionIntensity: vec4<f32>,
  color: vec4<f32>,
}
struct LightParams {
  ambientStrength: f32,
  padding0: f32,
  padding1: f32,
  padding2: f32,
  slot: array<LightSlot, 4>,
}
struct DrawParams {
  identity: u32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
}
@group(0) @binding(0) var<uniform> frameParams: FrameParams;
@group(0) @binding(1) var<uniform> materialParams: MaterialParams;
@group(0) @binding(2) var<uniform> lightParams: LightParams;
@group(0) @binding(3) var<uniform> drawParams: DrawParams;
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldNormal: vec3<f32>,
}
@vertex fn vertexMain(
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
) -> VertexOutput {
  var output: VertexOutput;
  let clip = frameParams.projection * frameParams.view * vec4<f32>(position, 1.0);
  output.position = vec4<f32>(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
  output.worldNormal = normal;
  return output;
}
fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {
  let t = clamp(ratio, 0.0, 1.0);
  return a * (1.0 - t) + b * t;
}
struct FragmentOutput {
  @location(0) color: vec4<f32>,
  @location(1) identity: u32,
}
@fragment fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  let normalizedWorldNormal = normalize(input.worldNormal);
  var light = vec3<f32>(lightParams.ambientStrength);
${terms.slice(0, count).join('\n')}
  let baseLinear = ${kind === 'null' ? 'pow(frameParams.color.xyz, vec3<f32>(2.2))' : kind === 'constant' ? constantExpression : kind === 'sixteen' ? materialExpression.replace('slot[0].x', 'slot[3].w') : materialExpression};
  let linearRadiance = clamp(baseLinear * light, vec3<f32>(0.0), vec3<f32>(1.0));
  var output: FragmentOutput;
  output.color = vec4<f32>(pow(linearRadiance, vec3<f32>(1.0 / 2.2)), 1.0);
  output.identity = drawParams.identity;
  return output;
}
`; }
const catalog = { format: 'barocss-gpu-native-directional-lights', version: 0, profile: 'native-world-directional-linear-v0', sourceId: 'signed-light-study', revision: -0, ambientStrength: .1,
  lights: [{ nodeId: 'red-key', label: 'Red é😀', enabled: true, directionScene: [2, -0, 0], colorLinearRGB: [1, -0, 0], intensity: .5 }, { nodeId: 'blue-fill', label: 'Blue\nFill', enabled: true, directionScene: [0, -0, 4], colorLinearRGB: [-0, 0, 1], intensity: .25 }] };
const unit = [1, -0, 0], blueUnit = [0, -0, 1];
function fixtures(gpu) {
  const request = (lights = catalog, values = {}, kind = 'palette') => ({ lights: clone(lights), material: kind === 'null' ? null : { material: clone(compile(gpu, kind === 'constant' ? constantSource : materialSource)), uniforms: values } });
  const make = (name, input, directions, kind = 'palette', amount = .25) => ({ name, input, directions, kind, amount });
  const edit = clone(catalog); edit.revision = 1; edit.lights[0].directionScene = [0, 3, 0]; edit.lights[0].colorLinearRGB = [.2, .7, .4]; edit.lights[0].intensity = .75;
  const disable = clone(catalog); disable.revision = 2; disable.lights[0].enabled = false; disable.lights[0].intensity = Number.MIN_VALUE;
  const allDisabled = clone(catalog); allDisabled.lights.forEach(light => { light.enabled = false; });
  const remove = clone(catalog); remove.revision = 3; remove.lights.shift();
  const reorder = clone(catalog); reorder.revision = 4; reorder.lights.reverse();
  const four = clone(catalog); four.ambientStrength = 1; four.lights.push({ nodeId: 'white-a', label: 'A', enabled: true, directionScene: [1, 0, 1], colorLinearRGB: [1, 1, 1], intensity: 1 }, { nodeId: 'white-b', label: 'B', enabled: true, directionScene: [1, 0, 1], colorLinearRGB: [1, 1, 1], intensity: 1 });
  const tiny = clone(catalog); tiny.lights = [{ ...tiny.lights[0], directionScene: [Number.MIN_VALUE, -0, 0] }];
  const signedIR = request(); signedIR.material.material.uniforms[0].min = -0; signedIR.material.material.expression.args[0].linear[0] = -0;
  const sixteen = { lights: clone(catalog), material: { material: clone(compile(gpu, sixteenSource)), uniforms: { u15: .75 } } };
  const signedLight = clone(catalog); signedLight.ambientStrength = -0; signedLight.lights[0].intensity = -0;
  const plainNull = Object.assign(Object.create(null), request(catalog, {}, 'null')); plainNull.lights = Object.assign(Object.create(null), plainNull.lights);
  return [make('default_two', request(), [unit, blueUnit]), make('override_075', request(catalog, { amount: .75 }), [unit, blueUnit], 'palette', .75),
    make('signed_override', request(catalog, { amount: -0 }), [unit, blueUnit], 'palette', 0), make('rounding_override', request(catalog, { amount: .1 }), [unit, blueUnit], 'palette', .1),
    make('direction_color_intensity_edit', request(edit), [[0, 1, 0], blueUnit]), make('disable_preserves_slot', request(disable), [unit, blueUnit]),
    make('all_disabled_ambient', request(allDisabled), [unit, blueUnit]), make('remove_compacts', request(remove), [blueUnit]), make('reorder_remaps', request(reorder), [blueUnit, unit]),
    make('null_two', request(catalog, {}, 'null'), [unit, blueUnit], 'null'), make('zero_null', request({ ...catalog, lights: [] }, {}, 'null'), [], 'null'),
    make('one_subnormal_original', request(tiny, {}, 'null'), [unit], 'null'), make('four_saturates', request(four, {}, 'constant'), [unit, blueUnit, [Math.SQRT1_2, 0, Math.SQRT1_2], [Math.SQRT1_2, 0, Math.SQRT1_2]], 'constant'),
    make('signed_executed_zero', request(signedLight), [unit, blueUnit]), make('signed_original_IR', signedIR, [unit, blueUnit]), make('sixteen_material_values', sixteen, [unit, blueUnit], 'sixteen'), make('null_prototype_root', plainNull, [unit, blueUnit], 'null')];
}
function verify(result, c) {
  const raw = c.input, lights = raw.lights.lights;
  keys(result, ['format', 'version', 'profile', 'originals', 'execution', 'abi', 'program', 'uniforms']);
  assert.equal(result.format, 'barocss-gpu-native-directional-light-program-wgsl'); assert.equal(result.version, 0); assert.equal(result.profile, 'native-world-directional-linear-mesh-opaque-wgsl-v0');
  keys(result.originals, ['lights', 'material']); assert.equal(signed(result.originals), signed(raw));
  keys(result.execution, ['ambientStrength', 'lights', 'materialUniforms']); keys(result.abi, ['vertexBuffers', 'bindings', 'lightSlots', 'materialUniforms', 'colorTargets', 'depth']);
  keys(result.program, ['code', 'vertexEntryPoint', 'fragmentEntryPoint']); keys(result.uniforms, ['material', 'lights']);
  assert.deepEqual(result.program, { code: expectedProgram(lights.length, c.kind), vertexEntryPoint: 'vertexMain', fragmentEntryPoint: 'fragmentMain' });
  assert.deepEqual(result.abi.vertexBuffers, [{ slot: 0, shaderLocation: 0, arrayStride: 12, format: 'float32x3' }, { slot: 1, shaderLocation: 1, arrayStride: 12, format: 'float32x3' }]);
  assert.deepEqual(result.abi.bindings, [{ group: 0, binding: 0, byteLength: 144, visibility: 'vertex-fragment' }, { group: 0, binding: 1, byteLength: 64, visibility: 'fragment' }, { group: 0, binding: 2, byteLength: 144, visibility: 'fragment' }, { group: 0, binding: 3, byteLength: 16, visibility: 'fragment' }]);
  assert.deepEqual(result.abi.colorTargets, ['rgba8unorm', 'r32uint']); assert.deepEqual(result.abi.depth, { format: 'depth24plus', writeEnabled: true, compare: 'less' });
  const expectedExecution = { ambientStrength: Math.fround(raw.lights.ambientStrength), lights: lights.map((light, index) => ({ nodeId: light.nodeId, index, unitDirection: c.directions[index].map(Math.fround), colorLinearRGB: light.colorLinearRGB.map(Math.fround), intensity: light.enabled ? Math.fround(light.intensity) : 0 })), materialUniforms: c.kind === 'palette' ? [{ name: 'amount', index: 0, byteOffset: 0, value: Math.fround(c.amount) }] : c.kind === 'sixteen' ? Array.from({ length: 16 }, (_, i) => ({ name: 'u' + i, index: i, byteOffset: 4 * i, value: i === 15 ? .75 : i / 16 })) : [] };
  assert.deepEqual(result.execution, expectedExecution);
  assert.deepEqual(result.abi.lightSlots, lights.map((light, index) => ({ nodeId: light.nodeId, index, directionIntensityOffset: [16, 48, 80, 112][index], colorOffset: [32, 64, 96, 128][index] })));
  assert.deepEqual(result.abi.materialUniforms, c.kind === 'palette' ? [{ name: 'amount', index: 0, byteOffset: 0 }] : c.kind === 'sixteen' ? Array.from({ length: 16 }, (_, i) => ({ name: 'u' + i, index: i, byteOffset: 4 * i })) : []);
  // Separate Buffer implementation and explicit slot positions; inspect every padding/unused byte.
  const expectedMaterial = Buffer.alloc(64), expectedLights = Buffer.alloc(144); expectedLights.writeFloatLE(raw.lights.ambientStrength, 0);
  if (c.kind === 'palette') expectedMaterial.writeFloatLE(c.amount, 0);
  if (c.kind === 'sixteen') for (let i = 0; i < 16; i++) expectedMaterial.writeFloatLE(i === 15 ? .75 : i / 16, i * 4);
  lights.forEach((light, index) => { const directionOffset = [16, 48, 80, 112][index], colorOffset = [32, 64, 96, 128][index]; c.directions[index].forEach((n, axis) => expectedLights.writeFloatLE(n, directionOffset + axis * 4)); expectedLights.writeFloatLE(light.enabled ? light.intensity : 0, directionOffset + 12); light.colorLinearRGB.forEach((n, axis) => expectedLights.writeFloatLE(n, colorOffset + axis * 4)); });
  assert.ok(result.uniforms.material instanceof Uint8Array); assert.ok(result.uniforms.lights instanceof Uint8Array);
  assert.deepEqual(Buffer.from(result.uniforms.material), expectedMaterial); assert.deepEqual(Buffer.from(result.uniforms.lights), expectedLights);
  if (c.name === 'default_two') {
    assert.equal(expectedMaterial.toString('hex'), '0000803e' + '00'.repeat(60));
    assert.equal(expectedLights.toString('hex'), 'cdcccc3d' + '00'.repeat(12) + '0000803f00000080000000000000003f0000803f000000800000000000000000' + '00000000000000800000803f0000803e00000080000000000000803f00000000' + '00'.repeat(64));
  }
  assert.equal((result.program.code.match(/normalize\(/g) ?? []).length, 1); assert.equal((result.program.code.match(/light \+=/g) ?? []).length, lights.length);
  assert.ok(!/\b(for|while|loop)\b|@location\(2\)|texture|sampler/.test(result.program.code));
  for (const light of lights) assert.ok(!result.program.code.includes(light.nodeId));
  frozen(result); independent(result, raw); independent(result.originals, result.execution); independent(result.execution, result.abi); independent(result.uniforms.material, result.uniforms.lights);
  assert.ok(!Object.isFrozen(raw)); assert.ok(!Object.isFrozen(result.uniforms.material));
  assert.ok(result.program.code.length <= 65536 && Buffer.byteLength(result.program.code) <= 65536);
}
// This CPU-only reference uses independently specified normal, base and two scalar contributions.
function cpuReference() {
  const ambient = Math.fround(.1), normal = Math.SQRT1_2;
  const light = [ambient + .5 * normal, ambient, ambient + .25 * normal];
  const linear = light.map(n => .25 * n), encoded = linear.map(n => n ** (1 / 2.2));
  near(light[0], .4535533920833899); near(light[1], .10000000149011612); near(light[2], .276776696786753);
  const saturated = [1.2, 1.1, 2].map(n => Math.min(1, .75 * n));
  assert.deepEqual(saturated, [.8999999999999999, .8250000000000001, 1]); assert.notDeepEqual(saturated, [1.2, 1.1, 2].map(n => .75 * Math.min(1, n)));
  near(encoded[0] ** 2.2, linear[0]);
  return { CPUReferenceOnly: true, light, linear, encoded, postProductSaturation: saturated, renderedPixels: false };
}
async function writeArtifact(path, data) { await writeFile(path, data, { flag: 'wx' }); return { path, bytes: Buffer.byteLength(data), sha256: hash(data) }; }
const ordinaryProjection = result => Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'uniforms'));

assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4);
if (process.argv[2] === '--cold') {
  const cfg = JSON.parse(await readFile(process.argv[3], 'utf8')), rows = [];
  for (const provider of cfg.providers) {
    const gpu = await import(pathToFileURL(provider.path).href);
    for (const file of cfg.cases.filter(c => c.provider === provider.label)) {
      const raw = JSON.parse(await readFile(file.rawPath, 'utf8'));
      if (raw.material) {
        const source = await readFile(file.sourcePath, 'utf8'); assert.equal(raw.material.material.source, source);
        const reconstructed = compile(gpu, source); assert.deepEqual(JSON.parse(JSON.stringify(reconstructed)), JSON.parse(JSON.stringify(raw.material.material)));
      }
      // Resolve independent fixtures by name; no parent output, program, execution or bytes is authority.
      const c = fixtures(gpu).find(c => c.name === file.name); assert.ok(c); assert.equal(signed(raw), signed(c.input)); c.input = raw;
      const result = gpu.prepareNativeDirectionalLightProgramWGSL(raw); verify(result, c);
      rows.push({ provider: provider.label, name: c.name, independentlyChecked: true });
    }
  }
  console.log(JSON.stringify({ pid: process.pid, ppid: process.ppid, rows, parentPreparedAuthority: false, device: false }));
} else {
  assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
  const output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
  const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
  assert.deepEqual(manifest, JSON.parse(parentFile('packages/barocss-gpu/package.json')));
  const oldBarrel = parentFile('packages/barocss-gpu/src/index.ts');
  const parse = text => ts.createSourceFile('index.ts', text, ts.ScriptTarget.Latest, true);
  const exported = (text, types) => parse(text).statements.filter(ts.isExportDeclaration).filter(n => n.exportClause && ts.isNamedExports(n.exportClause)).flatMap(n => n.exportClause.elements.filter(e => Boolean(n.isTypeOnly || e.isTypeOnly) === types).map(e => e.name.text)).sort();
  const barrel = await readFile(resolve(pkg, 'src/index.ts'), 'utf8'); assert.ok(barrel.startsWith(oldBarrel));
  assert.deepEqual(exported(barrel, true), [...exported(oldBarrel, true), ...eightTypes].sort());
  assert.deepEqual(exported(barrel, false), [...exported(oldBarrel, false), ...additions].sort());
  const ordinary = resolve(output, 'ordinary-public.mjs');
  const bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
  const sourceGraph = Object.keys(bundle.metafile.inputs); assert.ok(sourceGraph.some(path => path.endsWith('/native-directional-light-program-wgsl.ts'))); assert.ok(!sourceGraph.some(path => /barocss-(cad|gpu)\/dist\//.test(path)));
  const providers = [{ label: 'source', path: ordinary }, { label: 'emitted', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
  const namespace = [...exported(oldBarrel, false), ...additions].sort();
  const unchanged = ['native-directional-lights.ts', 'native-directional-light-shader-source.ts', 'directional-light-shader-body.ts', 'mesh-material.ts', 'mesh-material-wgsl.ts', 'mesh-shaders.ts', 'mesh-lighting.ts', 'mesh-renderer.ts', 'primitive-scene-renderer.ts'];
  const preparationSource = await readFile(resolve(pkg, 'src/native-directional-light-program-wgsl.ts'), 'utf8');
  const calls = new Map();
  const visitCalls = node => { if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.set(node.expression.text, (calls.get(node.expression.text) ?? 0) + 1); ts.forEachChild(node, visitCalls); };
  visitCalls(parse(preparationSource));
  for (const name of ['prepareNativeDirectionalLights', 'validateMeshMaterialBinding', 'lowerMeshMaterialWGSL']) assert.equal(calls.get(name), 1);
  assert.equal(calls.has('compileMeshMaterial'), false); assert.equal(calls.has('prepareNativeDirectionalLightShaderSource'), false);
  const unchangedBlobs = [];
  for (const name of unchanged) { const path = 'packages/barocss-gpu/src/' + name, text = await readFile(resolve(repo, path), 'utf8'); assert.equal(text, parentFile(path)); unchangedBlobs.push({ path, sha256: hash(text) }); }
  // No tracked changes anywhere except the frozen five paths; this also covers every backend/frame leaf.
  const allowed = ['packages/barocss-gpu/src/native-directional-light-program-wgsl.ts', 'packages/barocss-gpu/src/directional-light-program-wgsl-body.ts', 'packages/barocss-gpu/src/index.ts', 'packages/barocss-gpu/README.md', 'examples/gpu-scene/native-directional-light-program-wgsl-flow.mjs'].sort();
  const changed = [...new Set([...git(['diff', '--name-only', base]).split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).split('\n')].filter(Boolean))].sort(); assert.deepEqual(changed, allowed);
  const dts = await readFile(resolve(pkg, 'dist/index.d.ts'), 'utf8'); for (const name of [...additions, ...eightTypes]) assert.ok(new RegExp('\\b' + name + '\\b').test(dts));
  const consumerPath = resolve(output, 'declaration-consumer.mts'), publicPath = resolve(pkg, 'dist/index.js').replaceAll('\\', '/');
  const consumer = `import {prepareNativeDirectionalLightProgramWGSL, NativeDirectionalLightProgramWGSLError, prepareNativeDirectionalLights, prepareNativeDirectionalLightShaderSource, lowerMeshMaterialWGSL, validateMeshMaterialIR} from ${JSON.stringify(publicPath)};\nimport type {${eightTypes.join(',')}, PreparedNativeDirectionalLights, PreparedDirectionalLightShaderSource, LoweredMeshMaterialWGSL, MeshMaterialIR} from ${JSON.stringify(publicPath)};\nconst prepare: (input: unknown) => PreparedNativeDirectionalLightProgramWGSL = prepareNativeDirectionalLightProgramWGSL;\nconst catalog: (input: unknown) => PreparedNativeDirectionalLights = prepareNativeDirectionalLights;\nconst glsl: (input: unknown) => PreparedDirectionalLightShaderSource = prepareNativeDirectionalLightShaderSource;\nconst lower: (input: unknown) => LoweredMeshMaterialWGSL = lowerMeshMaterialWGSL;\nconst binding: (input: unknown) => MeshMaterialIR = validateMeshMaterialIR;\ntype API = [NativeDirectionalLightProgramWGSLCode, NativeDirectionalLightProgramWGSLRequest, NativeDirectionalLightProgramWGSLSlot, NativeDirectionalLightProgramWGSLExecution, NativeDirectionalLightProgramWGSLABI, NativeDirectionalLightProgramWGSLProgram, NativeDirectionalLightProgramWGSLUniforms, PreparedNativeDirectionalLightProgramWGSL];\nconst error = new NativeDirectionalLightProgramWGSLError('REPRESENTATION','test');\nconst code: NativeDirectionalLightProgramWGSLCode = error.code;\n// @ts-expect-error the exact five-code union excludes RANGE\nconst invalidCode: NativeDirectionalLightProgramWGSLCode = 'RANGE';\n${eightTypes.map(name => '// @ts-expect-error type-only export is not a runtime value\nvoid ' + name + ';').join('\n')}\nvoid [prepare,catalog,glsl,lower,binding,code,invalidCode]; export type {API};\n`;
  await writeArtifact(consumerPath, consumer);
  execFileSync(process.execPath, [resolve(repo, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', consumerPath], { cwd: repo, encoding: 'utf8' });
  let accepted = 0, refused = 0, getterCount = 0; const rows = [], coldCases = [];
  for (const provider of providers) {
    const gpu = await import(pathToFileURL(provider.path).href); assert.deepEqual(Object.keys(gpu).sort(), namespace);
    for (const name of eightTypes) assert.ok(!Object.hasOwn(gpu, name)); assert.ok(!Object.hasOwn(gpu, 'directionalLightProgramWGSLBody'));
    const records = [], retained = [];
    for (const c of fixtures(gpu)) {
      const before = signed(c.input), result = gpu.prepareNativeDirectionalLightProgramWGSL(c.input); verify(result, c); assert.equal(signed(c.input), before);
      for (const prior of retained) independent(result, prior.result);
      const prefix = resolve(output, provider.label + '.' + c.name), rawPath = prefix + '.raw.json', sourcePath = c.input.material ? prefix + '.material.css' : null;
      const files = [await writeArtifact(rawPath, before + '\n'), await writeArtifact(prefix + '.wgsl', result.program.code), await writeArtifact(prefix + '.material.bin', result.uniforms.material), await writeArtifact(prefix + '.lights.bin', result.uniforms.lights), await writeArtifact(prefix + '.ordinary.json', signed(ordinaryProjection(result)) + '\n')];
      if (sourcePath) files.push(await writeArtifact(sourcePath, c.input.material.material.source));
      const record = { provider: provider.label, name: c.name, rawPath, sourcePath, files }; records.push(record); coldCases.push({ provider: provider.label, name: c.name, rawPath, sourcePath });
      retained.push({ result, projection: signed(ordinaryProjection(result)), material: Buffer.from(result.uniforms.material), lights: Buffer.from(result.uniforms.lights), files }); accepted++;
    }
    assert.equal(retained[0].result.program.code, retained[1].result.program.code);
    assert.deepEqual(retained[0].result.originals.material.uniforms, {}); assert.ok(Object.is(retained[2].result.originals.material.uniforms.amount, -0)); assert.ok(Object.is(retained[2].result.execution.materialUniforms[0].value, 0));
    const mutable = gpu.prepareNativeDirectionalLightProgramWGSL(fixtures(gpu)[0].input), mutableProjection = signed(ordinaryProjection(mutable)); mutable.uniforms.material.fill(255); mutable.uniforms.lights.fill(17); assert.equal(signed(ordinaryProjection(mutable)), mutableProjection); verify(gpu.prepareNativeDirectionalLightProgramWGSL(fixtures(gpu)[0].input), fixtures(gpu)[0]);
    const request = () => clone(fixtures(gpu)[0].input), bad = (name, edit, code, providerCode) => { const input = request(); edit(input); return { name, input, code, providerCode }; };
    const checks = [
      { name: 'null_request', input: null, code: 'INPUT' }, { name: 'missing_material', input: { lights: catalog }, code: 'INPUT' },
      bad('extra_program', r => r.program = 'caller WGSL', 'INPUT'), bad('hidden_request', r => Object.defineProperty(r, 'material', { value: null, enumerable: false }), 'INPUT'),
      bad('symbol_request', r => r[Symbol('x')] = 0, 'INPUT'), { name: 'foreign_request', input: runInNewContext('({lights:null, material:null})'), code: 'INPUT' },
      bad('root_getter', r => Object.defineProperty(r, 'material', { enumerable: true, get() { getterCount++; return undefined; } }), 'INPUT'),
      bad('prepared_catalog', r => r.lights = gpu.prepareNativeDirectionalLights(r.lights), 'LIGHTS', 'INPUT'), { name: 'prepared_program', input: retained[0].result, code: 'INPUT' },
      bad('catalog_profile', r => r.lights.profile = 'wrong', 'LIGHTS', 'VERSION'), bad('duplicate_id', r => r.lights.lights[1].nodeId = 'red-key', 'LIGHTS', 'IDENTITY'),
      bad('fifth_disabled', r => r.lights.lights.push(...[2, 3, 4].map(i => ({ ...clone(catalog.lights[0]), nodeId: 'extra-' + i, enabled: false }))), 'LIGHTS', 'BUDGET'),
      bad('catalog_getter', r => Object.defineProperty(r.lights, 'ambientStrength', { enumerable: true, get() { getterCount++; return undefined; } }), 'LIGHTS', 'INPUT'),
      bad('catalog_hidden', r => Object.defineProperty(r.lights, 'revision', { value: 0, enumerable: false }), 'LIGHTS', 'INPUT'),
      bad('catalog_symbol', r => r.lights[Symbol()] = 0, 'LIGHTS', 'INPUT'), bad('catalog_foreign', r => r.lights = runInNewContext('({})'), 'LIGHTS', 'INPUT'),
      bad('material_getter', r => Object.defineProperty(r.material, 'uniforms', { enumerable: true, get() { getterCount++; return undefined; } }), 'MATERIAL'),
      bad('material_hidden', r => Object.defineProperty(r.material, 'uniforms', { value: {}, enumerable: false }), 'MATERIAL'), bad('material_symbol', r => r.material[Symbol()] = 0, 'MATERIAL'),
      bad('material_foreign', r => r.material = runInNewContext('({})'), 'MATERIAL'), bad('material_null_prototype', r => r.material = Object.assign(Object.create(null), r.material), 'MATERIAL'),
      bad('material_cycle', r => r.material.uniforms = r.material, 'MATERIAL'), bad('material_nan', r => r.material.uniforms.amount = NaN, 'MATERIAL'),
      bad('material_extra_array_key', r => r.material.material.uniforms.extra = 1, 'MATERIAL'), bad('material_sparse_array', r => delete r.material.material.uniforms[0], 'MATERIAL'),
      bad('material_depth', r => { let value = 0; for (let i = 0; i < 25; i++) value = { child: value }; r.material.uniforms = value; }, 'MATERIAL'),
      bad('material_excess_record', r => r.material.uniforms = Object.fromEntries(Array.from({ length: 17 }, (_, i) => ['u' + i, 0])), 'MATERIAL'),
      bad('material_excess_array', r => r.material.material.uniforms = Array(257).fill(0), 'MATERIAL'),
      bad('material_forged_IR', r => r.material.material.expression = { kind: 'color', type: 'color', hex: '#FFFFFF', linear: [1, 1, 1] }, 'MATERIAL', 'IR'),
      bad('material_profile', r => r.material.material.profile = 'native-uv', 'MATERIAL', 'IR'),
      bad('material_unknown_uniform', r => r.material.uniforms.other = .5, 'MATERIAL', 'UNIFORM'), bad('material_range', r => r.material.uniforms.amount = 2, 'MATERIAL', 'UNIFORM'),
      bad('underflow_ambient', r => r.lights.ambientStrength = Number.MIN_VALUE, 'REPRESENTATION'), bad('underflow_color_disabled', r => { r.lights.lights[0].enabled = false; r.lights.lights[0].colorLinearRGB[1] = Number.MIN_VALUE; }, 'REPRESENTATION'),
      bad('underflow_enabled_intensity', r => r.lights.lights[0].intensity = Number.MIN_VALUE, 'REPRESENTATION'),
      bad('underflow_normalized_component', r => r.lights.lights[0].directionScene = [1, 1e-50, 0], 'REPRESENTATION'), bad('underflow_override', r => r.material.uniforms.amount = Number.MIN_VALUE, 'REPRESENTATION'),
      bad('material_before_representation', r => { r.material.uniforms.other = .5; r.lights.ambientStrength = Number.MIN_VALUE; }, 'MATERIAL', 'UNIFORM'),
      bad('catalog_before_material', r => { r.lights.profile = 'wrong'; Object.defineProperty(r.material, 'uniforms', { get() { getterCount++; return undefined; } }); }, 'LIGHTS', 'VERSION'),
    ];
    // Actual legacy admission makes f32 overflow unreachable: literals/inserted coefficients <=1000.
    const overflowSource = '@shader #overflow { @fragment {color:mix(#000,#fff,1e39);} }';
    const overflow = gpu.compileMeshMaterial(overflowSource); assert.equal(overflow.ok, false); assert.equal(overflow.diagnostics[0].code, 'RANGE');
    checks.push(bad('overflow_source_refused_before_lowering', r => r.material.material.source = overflowSource, 'MATERIAL', 'IR'));
    for (const [name, source] of [
      ['lowerer_literal_underflow', '@shader #tiny { @fragment {color:mix(#000,#fff,1e-50);} }'],
      ['lowerer_default_underflow', '@shader #tiny { @uniform amount:float(0,1,1e-50); @fragment {color:mix(#000,#fff,amount);} }'],
      ['lowerer_bound_underflow', '@shader #tiny { @uniform amount:float(1e-50,1,.5); @fragment {color:mix(#000,#fff,amount);} }'],
    ]) checks.push(bad(name, r => r.material = { material: compile(gpu, source), uniforms: {} }, 'MATERIAL', 'RANGE'));
    const actualUV = gpu.compileEngineUVMaterial('@shader #uv { @fragment {color:mix(#000,#fff,clamp(uv_u,0,1));} }'); assert.equal(actualUV.ok, true);
    checks.push(bad('actual_engine_uv_profile', r => r.material.material = actualUV.material, 'MATERIAL', 'IR'));
    checks.push(bad('snapshot_visited_values', r => r.material.uniforms = Array.from({ length: 32 }, () => Array(256).fill(0)), 'MATERIAL'));
    checks.push(bad('material_missing_field', r => delete r.material.uniforms, 'MATERIAL', 'INPUT'));
    const reserved = compile(gpu, '@shader #reserved { @uniform __proto__:float(0,1,.5); @fragment {color:mix(#000,#fff,__proto__);} }');
    checks.push(bad('reserved_missing_own_value', r => r.material = { material: reserved, uniforms: Object.fromEntries([['__proto__', .75]]) }, 'MATERIAL'));
    const marker = new gpu.NativeDirectionalLightProgramWGSLError('BUDGET', 'caller marker');
    for (const [name, cause] of [['marker', marker], ['undefined', undefined]]) {
      for (const operation of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) {
        checks.push({ name: `root_reflection_${operation}_${name}`, input: new Proxy(request(), { [operation]() { throw cause; } }), code: 'INPUT', reflection: true, cause });
        checks.push(bad(`material_reflection_${operation}_${name}`, r => r.material = new Proxy(r.material, { [operation]() { throw cause; } }), 'MATERIAL'));
        Object.assign(checks.at(-1), { reflection: true, cause });
      }
    }
    const failures = [];
    for (const c of checks) {
      let error; try { gpu.prepareNativeDirectionalLightProgramWGSL(c.input); } catch (e) { error = e; }
      assert.ok(error instanceof gpu.NativeDirectionalLightProgramWGSLError, c.name); assert.equal(error.code, c.code, c.name); assert.ok(error.message.length <= 1024); assert.equal(error.name, 'NativeDirectionalLightProgramWGSLError');
      if (c.reflection) { assert.ok(Object.hasOwn(error, 'cause')); assert.strictEqual(error.cause, c.cause); assert.notStrictEqual(error, c.cause); }
      else if (c.providerCode) { assert.ok(Object.hasOwn(error, 'cause')); assert.ok(error.cause instanceof (c.code === 'LIGHTS' ? gpu.NativeDirectionalLightsError : gpu.MeshMaterialError)); assert.equal(error.cause.code, c.providerCode, c.name); if (c.code === 'MATERIAL') { assert.ok(Number.isInteger(error.cause.start)); assert.ok(Number.isInteger(error.cause.end)); } }
      else assert.equal(Object.hasOwn(error, 'cause'), false, c.name);
      assert.equal(getterCount, 0); failures.push({ name: c.name, code: error.code, providerCode: error.cause?.code ?? null, ownCause: Object.hasOwn(error, 'cause') }); refused++;
      for (const prior of retained) { assert.equal(signed(ordinaryProjection(prior.result)), prior.projection); assert.deepEqual(Buffer.from(prior.result.uniforms.material), prior.material); assert.deepEqual(Buffer.from(prior.result.uniforms.lights), prior.lights); }
    }
    for (const prior of retained) for (const file of prior.files) assert.equal(hash(await readFile(file.path)), file.sha256);
    rows.push({ provider: provider.label, records, failures });
  }
  const coldPath = resolve(output, 'cold-config.json'); await writeArtifact(coldPath, JSON.stringify({ providers, cases: coldCases }));
  const coldStdout = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--cold', coldPath], { cwd: repo, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  await writeArtifact(resolve(output, 'cold.stdout'), coldStdout); const cold = JSON.parse(coldStdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, accepted);
  const result = { issue: 1578, stage: 'TRUSTED_WGSL_PROGRAM_AND_UPLOAD_BYTES_CPU_ONLY', base, nativeHeadAtRun: git(['rev-parse', 'HEAD']), node: process.version, accepted, refused, getterCount, namespace, additions, eightTypes, changed, unchangedBlobs, sourceGraph, rows, cold, CPUReference: cpuReference(), declarationConsumer: { passed: true, sha256: hash(consumer) }, defensiveUnreachableBudgetsForced: false, lowererF32Overflow: 'UNREACHABLE: unchanged compiler caps literals and generated coefficients at 1000, intermediates at 1e6; actual 1e39 source RANGE refusal retained before lowerer',
    UNRUN: ['GPU shader compilation', 'bind/upload', 'device pixels', 'physical identity picking', 'frame replacement/refusal retention/loss/disposal', 'original-source/TEN/current-display join', 'Viewer/Render light Add/Edit/Remove/history/Save/Open/re-edit/second Save'],
    support: 'Complete trusted WGSL, original signed raw source, derived f32 execution and explicit LE upload bytes. Frame144 and draw16 bytes remain future host responsibility. Existing backends and admission unchanged. No device, frame, pixel, photometric, publication or default-readiness claim.' };
  const receipt = await writeArtifact(resolve(output, 'actual-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1578, accepted, refused, getterCount, runtimeAdditions: additions.length, typeAdditions: eightTypes.length, coldRows: cold.rows.length, receipt, device: false }));
}
