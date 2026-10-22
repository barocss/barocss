// G18.2: the repeating UV profile's WGSL lowering and the viewer's shader material for it — no device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileEngineUVRepeatingMaterial, lowerEngineUVRepeatingMaterial, lowerEngineUVRepeatingMaterialWGSL, materialShader, uvRepeatingShader } from '../dist/index.js';

const weave = `@shader #woven_grid {
  @uniform density: float(2,12,6);
  @uniform warp: float(0,1,.85);
  @let u: float(fract(uv_u));
  @let v: float(fract(uv_v));
  @let threads: color(mix(#091B2A,#D39C64,u*warp));
  @fragment { color: mix(threads,#58C5CF,fract(v*density)); }
}`;

test('G18.2 a repeating UV material lowered to WGSL: the GLSL lowering\'s tree, engine_uv, the 64-byte slot', () => {
  const c = compileEngineUVRepeatingMaterial(weave); assert.ok(c.ok);
  const w = lowerEngineUVRepeatingMaterialWGSL(c.material), g = lowerEngineUVRepeatingMaterial(c.material);
  assert.equal(w.profile, 'engine-opaque-uv-repeating-fragment-wgsl-v0');
  assert.deepEqual(w.input, { name: 'engine_uv', type: 'vec2<f32>', domain: 'engine-uv-repeating' });
  assert.deepEqual(w.uniformLayout.map(u => [u.name, u.access]), [['density', 'materialParams.slot[0].x'], ['warp', 'materialParams.slot[0].y']]);
  // The same operations in the same order: fract and the two mixes, the uv components, the clamp round it.
  assert.equal((w.expression.match(/fract\(/g) ?? []).length, (g.expression.match(/fract\(/g) ?? []).length);
  assert.equal((w.expression.match(/material_mix\(/g) ?? []).length, (g.expression.match(/mix\(/g) ?? []).length);
  assert.match(w.expression, /engine_uv\.x/); assert.match(w.expression, /engine_uv\.y/);
  assert.match(w.expression, /^clamp\(.*,vec3<f32>\(0\.0\),vec3<f32>\(1\.0\)\)$/);
  // Colour literals: the language's gamma-2.2 decode by default (the GLSL lowering's), the exact sRGB decode for the viewer.
  const srgb = lowerEngineUVRepeatingMaterialWGSL(c.material, { srgb: true });
  assert.notEqual(srgb.expression, w.expression);
  assert.ok(Object.isFrozen(w) && Object.isFrozen(w.uniformLayout));
});

test('G18.2 the viewer\'s shader material for it: uvs read as engine_uv, uniforms clamped into the slot; refusals typed', () => {
  const r = materialShader(weave, { density: 40 });
  assert.ok(r.ok); assert.equal(r.usesUV, true);
  assert.deepEqual(r.shader.aliases, { native_surface_uv01: 'uv', engine_uv: 'uv' });
  assert.deepEqual([...r.shader.params].slice(0, 2), [12, 0.85], 'density clamped to its maximum');
  const c = compileEngineUVRepeatingMaterial(weave); assert.ok(c.ok);
  assert.deepEqual([...uvRepeatingShader(c.material, { warp: 0.5 }).params].slice(0, 2), [6, 0.5]);
  // Not f32: refused where the source compiles (RANGE), and so by materialShader — its profile's diagnostic, not the mesh one's.
  for (const k of ['0.' + '0'.repeat(45) + '1', '1' + '0'.repeat(39)]) {
    const s = `@shader #t { @uniform s: float(0,1,.5); @fragment { color: mix(#000000,#ffffff,clamp(uv_u*${k},0,1)*s); } }`;
    const m = materialShader(s);
    assert.equal(m.ok, false); assert.equal(m.diagnostics[0].code, 'RANGE');
  }
  // An IR that is not the compiler's is refused by the reconstruction (the same as the GLSL lowering).
  assert.throws(() => lowerEngineUVRepeatingMaterialWGSL({ ...c.material, expression: { kind: 'float', type: 'float', value: 1e-50 } }));
});
