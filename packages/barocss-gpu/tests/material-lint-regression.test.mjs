import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileMeshMaterial, lowerMeshMaterial, validateMeshMaterialIR, compileEngineUVMaterial, lowerEngineUVMaterial } from '../dist/index.js';

// Regression boundary for #1670: valid typed lowering must still succeed after
// eliminating the material input-switch fallthrough and empty-interface lint.
test('valid material is validated and lowered without changing its source', () => {
  const source = '@shader #solid { @fragment { color: #204080; } }';
  const compiled = compileMeshMaterial(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  if (!compiled.ok) return;
  const validated = validateMeshMaterialIR(compiled.material);
  assert.deepEqual(validated, compiled.material);
  const lowered = lowerMeshMaterial(validated);
  assert.match(lowered.expression, /^clamp\(/);
  assert.ok(lowered.expression.includes('vec3('));
  assert.equal(validated.source, source);
});

test('material IR validation accepts cross-runtime color roundoff only', () => {
  const source = '@shader #first { @uniform amount:float(0,1,.25); @fragment { color:mix(#123456,#ABCDEF,amount); } }';
  const compiled = compileMeshMaterial(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  if (!compiled.ok) return;

  const saved = structuredClone(compiled.material);
  saved.expression.args[0].linear = [
    0.002932318323938363,
    0.030256518852388652,
    0.09151835299891947,
  ];
  saved.expression.args[1].linear = [
    0.41514809165590655,
    0.6186857274987796,
    0.8671355375209047,
  ];
  assert.deepEqual(validateMeshMaterialIR(saved), compiled.material);

  const tamperedNumber = structuredClone(saved);
  tamperedNumber.expression.args[0].linear[0] += 1e-6;
  assert.throws(() => validateMeshMaterialIR(tamperedNumber), /Material IR does not match/);

  const tamperedShape = structuredClone(saved);
  tamperedShape.expression.args[0].hex = '#123457';
  assert.throws(() => validateMeshMaterialIR(tamperedShape), /Material IR does not match/);

  const tamperedMin = structuredClone(compiled.material);
  tamperedMin.uniforms[0].min += 5e-16;
  assert.throws(() => validateMeshMaterialIR(tamperedMin), /Material IR does not match/);

  const tamperedMax = structuredClone(compiled.material);
  tamperedMax.uniforms[0].max -= 5e-16;
  assert.throws(() => validateMeshMaterialIR(tamperedMax), /Material IR does not match/);

  const tamperedDefault = structuredClone(compiled.material);
  tamperedDefault.uniforms[0].default += 5e-16;
  assert.throws(() => validateMeshMaterialIR(tamperedDefault), /Material IR does not match/);

  const tamperedVersion = structuredClone(compiled.material);
  tamperedVersion.version += 5e-16;
  assert.throws(() => validateMeshMaterialIR(tamperedVersion), /Material IR does not match/);

  const floatSource = '@shader #floaty { @fragment { color: mix(#000000,#FFFFFF,.25); } }';
  const floatCompiled = compileMeshMaterial(floatSource);
  assert.equal(floatCompiled.ok, true, JSON.stringify(floatCompiled));
  if (!floatCompiled.ok) return;
  const tamperedFloat = structuredClone(floatCompiled.material);
  tamperedFloat.expression.args[2].value += 5e-16;
  assert.throws(() => validateMeshMaterialIR(tamperedFloat), /Material IR does not match/);
});

// This input variant previously fell through to sample lowering; cover the
// intended UV lowering path rather than testing only a constant color.
test('UV material input lowers to the declared interpolant', () => {
  const source = '@shader #uvtest { @fragment { color: mix(#000000,#FFFFFF,clamp(uv_u,0,1)); } }';
  const compiled = compileEngineUVMaterial(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  if (!compiled.ok) return;
  const lowered = lowerEngineUVMaterial(compiled.material);
  assert.equal(lowered.inputDeclarations, 'in vec2 v_engine_uv;');
  assert.match(lowered.expression, /v_engine_uv\.x/);
  assert.ok(!lowered.expression.includes('mat_s_0'));
});
