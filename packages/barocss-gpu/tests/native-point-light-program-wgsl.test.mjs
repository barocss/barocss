/** #1583 CPU/static evidence only. No WGSL parser, device compiler, GPU or pixels run. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const built = await build({ stdin: { contents: `export * from './src/native-point-lights.ts'; export * from './src/native-point-light-program-wgsl.ts'; export * from './src/mesh-material.ts'; export * from './src/mesh-material-wgsl.ts';`, resolveDir: root }, bundle: true, write: false, platform: 'node', format: 'esm' });
const api = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const point = (nodeId = 'red', extra = {}) => ({ nodeId, label: 'Light é', enabled: true, positionScene: [-0, 0, 2], colorLinearRGB: [1, 0, 0], intensity: 1, rangeScene: 4, ...extra });
const catalog = (lights = [point()]) => ({ format: 'barocss-gpu-native-point-lights', version: 0, profile: 'native-world-point-linear-v0', sourceId: 'scene', revision: 2, ambientStrength: .125, lights });
const prepare = lights => api.prepareNativePointLightProgramWGSL({ lights, material: null });
const code = expected => error => error.code === expected;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-12, `${actual} != ${expected}`);
// Independent mathematical reference: Math.hypot, not the shader's scaled implementation.
function reference(light, position, normal) {
  const delta = light.positionScene.map((x, i) => x - position[i]);
  const d = Math.hypot(...delta), n = Math.hypot(...normal);
  if (!light.enabled || d === 0 || d >= light.rangeScene || n === 0) return [0, 0, 0];
  const lambert = Math.max(0, delta.reduce((sum, x, i) => sum + x / d * normal[i] / n, 0));
  return light.colorLinearRGB.map(c => c * light.intensity * lambert * (1 - d / light.rangeScene) ** 2);
}
// Explicit CPU transcription of emitted intent. This is not execution/validation of WGSL.
function shaderIntent(light, position, normal) {
  const normalScale = Math.max(...normal.map(Math.abs));
  if (normalScale < 2 ** -126) return [0, 0, 0];
  const scaledNormal = normal.map(x => x / normalScale), norm = Math.sqrt(scaledNormal.reduce((a, x) => a + x*x, 0));
  const unitNormal = scaledNormal.map(x => x / norm);
  const delta = light.positionScene.map((x, i) => x - position[i]);
  const m = Math.max(...delta.map(Math.abs));
  if (m < 2 ** -126) return [0, 0, 0];
  const q = delta.map(x => x / m), s = Math.sqrt(q.reduce((a, x) => a + x*x, 0)), d = m*s;
  if (d >= light.rangeScene) return [0, 0, 0];
  const window = Math.max(1 - d / light.rangeScene, 0), diffuse = Math.max(q.reduce((a, x, i) => a + unitNormal[i]*x/s, 0), 0);
  return light.colorLinearRGB.map(c => c * light.intensity * diffuse * window*window);
}
test('catalog keeps original identity, signed values and independent immutable copies', () => {
  const input = catalog(), result = api.prepareNativePointLights(input);
  assert.ok(Object.is(result.catalog.lights[0].positionScene[0], -0));
  assert.ok(Object.isFrozen(result.catalog.lights[0].positionScene));
  input.lights[0].positionScene[2] = 9;
  assert.equal(result.execution[0].positionScene[2], 2);
  assert.notEqual(result.catalog.lights[0].positionScene, result.execution[0].positionScene);
  assert.deepEqual(api.prepareNativePointLights(catalog([])).execution, []);
  assert.equal(api.prepareNativePointLights(catalog(Array.from({ length: 4 }, (_, i) => point('p'+i)))).execution.length, 4);
});
test('analytic half-range, edge, outside, coincidence, back face and two colored lights', () => {
  const light = point();
  for (const [position, normal, expected] of [
    [[0,0,0],[0,0,1],.25], [[0,0,-2],[0,0,1],0], [[0,0,-3],[0,0,1],0],
    [[0,0,2],[0,0,1],0], [[0,0,0],[0,0,-1],0],
  ]) {
    const a = reference(light, position, normal), b = shaderIntent(light, position, normal);
    a.forEach((value, i) => close(value, b[i])); close(a[0], expected);
  }
  const lights = [light, point('green', { positionScene:[0,2,0], colorLinearRGB:[0,1,0], intensity:.5 })];
  const normal = [0,1,1];
  const sum = lights.map(l => shaderIntent(l,[0,0,0],normal)).reduce((a,b)=>a.map((x,i)=>x+b[i]),[.125,.125,.125]);
  close(sum[0], .125 + .25/Math.sqrt(2)); close(sum[1], .125+.125/Math.sqrt(2)); close(sum[2],.125);
  assert.deepEqual(shaderIntent(point('tiny',{positionScene:[1e-40,0,0]}),[0,0,0],[1,0,0]),[0,0,0]);
  assert.deepEqual(shaderIntent(light,[0,0,0],[0,0,1e-40]),[0,0,0]);
  const minimumNormal = 2 ** -126;
  close(shaderIntent(point('boundary',{positionScene:[minimumNormal,0,0]}),[0,0,0],[1,0,0])[0],1);
  assert.deepEqual(shaderIntent(point('below',{positionScene:[minimumNormal/2,0,0]}),[0,0,0],[1,0,0]),[0,0,0]);
  close(shaderIntent(light,[0,0,0],[0,0,minimumNormal])[0],.25);
  for (const normal of [[0,0,1e-30],[0,0,1e6]]) close(shaderIntent(light,[0,0,0],normal)[0],.25);
  assert.ok(shaderIntent(point('max',{positionScene:[1e6,1e6,1e6],rangeScene:1e6}),[-1e6,-1e6,-1e6],[1,1,1]).every(Number.isFinite));
});
test('fixed ABI, little-endian packing, padding, disabled slot and fresh arrays', () => {
  const input = catalog([point(),point('blue',{enabled:false,positionScene:[3,4,5],colorLinearRGB:[0,0,1],rangeScene:8})]);
  const p = prepare(input), view = new DataView(p.uniforms.lights.buffer);
  assert.deepEqual(p.abi.bindings.map(x => x.byteLength),[144,64,144,16]);
  assert.deepEqual(p.abi.lightSlots.map(x=>[x.positionRangeOffset,x.colorIntensityOffset]),[[16,32],[48,64]]);
  assert.equal(view.getFloat32(0,true),.125); assert.ok(Object.is(view.getFloat32(16,true),-0));
  assert.equal(view.getFloat32(24,true),2); assert.equal(view.getFloat32(28,true),4);
  assert.equal(view.getFloat32(32,true),1); assert.equal(view.getFloat32(44,true),1);
  assert.equal(view.getFloat32(60,true),8); assert.equal(view.getFloat32(76,true),0);
  assert.equal(p.originals.lights.lights[1].intensity,1);
  for (const i of [...Array.from({length:12},(_,i)=>i+4),...Array.from({length:64},(_,i)=>i+80)]) assert.equal(p.uniforms.lights[i],0);
  assert.equal(p.uniforms.material.byteLength,64); assert.ok(p.uniforms.material.every(x=>x===0));
  p.uniforms.lights[0]=255; assert.equal(prepare(input).uniforms.lights[0],0); assert.equal(p.execution.ambientStrength,.125);
});
test('emitted WGSL contains exact static ABI and bounded artistic law, no hidden conversion', () => {
  const p = prepare(catalog([point(),point('green')])), s=p.program.code;
  for (const token of ['positionRange: vec4<f32>','colorIntensity: vec4<f32>','@location(1) worldPosition','output.worldPosition = position;',
    'let q = delta / m;','let s = sqrt(dot(q, q));','let d = m * s;',
    'if (d >= slot.positionRange.w)', 'max(1.0 - d / slot.positionRange.w, 0.0)', 'let weight = window * window;',
    'let diffuse = max(dot(normal, direction), 0.0);', 'return slot.colorIntensity.xyz * slot.colorIntensity.w * diffuse * weight;', 'clamp(baseLinear * light, vec3<f32>(0.0), vec3<f32>(1.0))', 'pow(linearRadiance, vec3<f32>(1.0 / 2.2))','lightParams.slot[0]','lightParams.slot[1]',
    '@vertex fn vertexMain','@fragment fn fragmentMain','output.identity = drawParams.identity;']) assert.ok(s.includes(token),token);
  assert.match(s,/if \(m < 1\.1754943508222875e-38\)/);
  assert.match(s,/if \(normalScale < 1\.1754943508222875e-38\)/);
  for(let i=0;i<4;i++) assert.ok(s.includes(`@group(0) @binding(${i})`));
  assert.ok(!s.includes('lightParams.slot[2]')); assert.ok(!/1000|textureSample|inverseSquare/.test(s));
  assert.deepEqual(p.abi.colorTargets,['rgba8unorm','r32uint']); assert.equal(p.program.vertexEntryPoint,'vertexMain');
});
test('real legacy compiler/binder/lowerer retain source and resolved uniform bytes', () => {
  const source='/* original é */\r\n@shader #palette { @uniform amount:float(-0,1,.25); @fragment {color:mix(#000,#fff,amount);} }';
  const compiled=api.compileMeshMaterial(source); assert.equal(compiled.ok,true);
  const material={material:compiled.material,uniforms:{amount:-0}}, p=api.prepareNativePointLightProgramWGSL({lights:catalog(),material});
  const lower=api.lowerMeshMaterialWGSL(compiled.material);
  assert.ok(p.program.code.includes(lower.expression)); assert.equal(p.originals.material.material.source,source);
  assert.ok(Object.is(p.originals.material.uniforms.amount,-0));
  assert.equal(new DataView(p.uniforms.material.buffer).getFloat32(lower.uniformLayout[0].byteOffset,true),0);
  material.uniforms.amount=.9; assert.ok(Object.is(p.originals.material.uniforms.amount,-0));
});
test('bounded malformed catalog refusals do not invoke accessors or lose reflection cause', () => {
  for (const mutate of [c=>c.lights.push(...Array.from({length:4},(_,i)=>point('x'+i))),c=>c.lights.push(point()),
    c=>c.lights[0].rangeScene=0,c=>c.lights[0].rangeScene=1e7,c=>c.lights[0].positionScene[0]=Infinity,
    c=>c.lights[0].colorLinearRGB[0]=-1,c=>c.lights[0].extra=1,c=>delete c.lights[0].positionScene[1],
    c=>c.lights[0].positionScene=Object.assign([0,0,1],{extra:0}),c=>c.revision=-1,c=>c.profile='other',c=>Object.setPrototypeOf(c,{inherited:true}),c=>c[Symbol('hidden')]=1,c=>Object.defineProperty(c,'hidden',{value:1}),c=>c.lights=c]) {
    const c=catalog(); mutate(c); assert.throws(()=>api.prepareNativePointLights(c));
  }
  let gets=0;const c=catalog();Object.defineProperty(c.lights[0],'rangeScene',{get(){gets++;return 4;},enumerable:true});
  assert.throws(()=>prepare(c),code('LIGHTS'));assert.equal(gets,0);
  const cause={sentinel:true};const proxy=new Proxy(catalog(),{ownKeys(){throw cause;}});
  assert.throws(()=>api.prepareNativePointLights(proxy),e=>e.code==='INPUT'&&e.cause===cause);
  assert.throws(()=>prepare(proxy),e=>e.code==='LIGHTS'&&e.cause.cause===cause);
});
test('representation refusal, input/material boundaries and prior output retained', () => {
  const prior=prepare(catalog()), saved=Uint8Array.from(prior.uniforms.lights);
  const tiny=catalog();tiny.lights[0].positionScene[0]=Number.MIN_VALUE;
  assert.throws(()=>prepare(tiny),code('REPRESENTATION'));
  const tinyColor=catalog();tinyColor.lights[0].colorLinearRGB[0]=Number.MIN_VALUE;
  assert.throws(()=>prepare(tinyColor),code('REPRESENTATION'));
  assert.throws(()=>api.prepareNativePointLightProgramWGSL({lights:catalog(),material:null,extra:1}),code('INPUT'));
  assert.throws(()=>api.prepareNativePointLightProgramWGSL({lights:catalog(),material:{}}),code('MATERIAL'));
  assert.deepEqual(prior.uniforms.lights,saved);
});
test('public source exports and optionally emitted entry expose the same bounded producer', async () => {
  const index=await readFile(root+'src/index.ts','utf8');assert.ok(index.includes('prepareNativePointLights'));assert.ok(index.includes('prepareNativePointLightProgramWGSL'));
  if(process.env.POINT_LIGHT_EMITTED==='1') {
    const emitted=await import(new URL('../dist/index.js',import.meta.url));
    const a=prepare(catalog()),b=emitted.prepareNativePointLightProgramWGSL({lights:catalog(),material:null});
    assert.deepEqual(b,a);
  }
});
