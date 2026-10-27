// G5 (the old review's G5 and fuzz R2): the viewer's material colours by the exact sRGB decode — the viewer encodes sRGB
// exactly, so an authored #808080 shows as #808080 as a plain material colour does — while the language's other backends
// keep their gamma-2.2 pair; and a literal that is not an f32 (nonzero but zero as one) refused at compile time for both
// backends, the viewer's entry returning a diagnostic rather than throwing.
import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMeshMaterial, compileNativeSurfaceUV01Material } from '../dist/material/mesh-material.js';
import { lowerMeshMaterialWGSL } from '../dist/material/mesh-material-wgsl.js';
import { materialShader } from '../dist/material/material-viewer.js';
import { srgbToLinear } from '../dist/viewer/math.js';

const literals = text => [...text.matchAll(/vec3<f32>\(([^)]*)\)/g)].map(m => m[1].split(',').map(x => parseFloat(x)));
const srgbByte = l => Math.round((l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255);

test('G5 a material colour in the viewer: the exact sRGB decode of its hex, so it encodes back to its own bytes; other backends keep gamma 2.2', () => {
  for (const hex of ['#808080', '#1a2b3c', '#ff7f00', '#000000', '#ffffff', '#0a0a0a']) {
    const r = materialShader(`@shader #c { @fragment { color:${hex}; } }`);
    assert.ok(r.ok);
    const [lin] = literals(r.shader.expression), bytes = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    lin.forEach((l, k) => assert.ok(Math.abs(l - srgbToLinear(bytes[k] / 255)) < 1e-7, `${hex}[${k}] ${l}`));
    assert.deepEqual(lin.map(srgbByte), bytes, `${hex} back to its bytes`);
  }
  // The language's own lowering (its GLSL and older WGSL renderers, which encode with 1/2.2): unchanged.
  const c = compileMeshMaterial('@shader #c { @fragment { color:#808080; } }');
  assert.ok(Math.abs(literals(lowerMeshMaterialWGSL(c.material).expression)[0][0] - Math.pow(128 / 255, 2.2)) < 1e-7);
  // A surface-uv material too.
  const uv = materialShader('@shader #r { @fragment { color:mix(#808080,#ffffff,surface_u01); } }');
  assert.ok(uv.ok && uv.usesUV);
  assert.ok(Math.abs(literals(uv.shader.expression)[0][0] - srgbToLinear(128 / 255)) < 1e-7);
});

test('G5 a literal that is no f32 (nonzero, zero as one) refused at compile time, for both backends; the viewer answers with a diagnostic', () => {
  for (const x of ['1e-50', '-1e-46', '1e-46']) {
    const src = `@shader #x { @fragment { color:mix(#000000,#ffffff,${x}); } }`, c = compileMeshMaterial(src);
    assert.equal(c.ok, false, x); assert.equal(c.diagnostics[0].code, 'RANGE');
    assert.equal(compileNativeSurfaceUV01Material(src.replace('#x', '#y')).ok, false);
    const v = materialShader(src);
    assert.equal(v.ok, false); assert.equal(v.diagnostics[0].code, 'RANGE');
  }
  // Representable ones (a subnormal, a small normal, zero) still compile and lower on both.
  for (const x of ['1e-40', '1e-38', '0', '0.5']) {
    const c = compileMeshMaterial(`@shader #x { @fragment { color:mix(#000000,#ffffff,${x}); } }`);
    assert.ok(c.ok, x); assert.doesNotThrow(() => lowerMeshMaterialWGSL(c.material));
  }
});
