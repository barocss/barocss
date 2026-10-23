// @barocss/gpu's CPU side, which runs without a GPU: the scene language compiled (the Render tab's props) and an authored
// @shader material lowered to the viewer's shader. The viewer itself needs a browser with WebGPU. The gpu page includes
// the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGpu, materialShader } from '@barocss/gpu';

test('a scene compiled; a scene the language does not have refused with where', () => {
  // #region scene
  // The Render tab's props: a plinth under the part.
  const props = compileGpu({ kind: 'scene', source: `@scene props {
  version: 0;
  box #plinth;
}
#plinth { size: 9 .4 6; translate: 3.2 -.25 -1.6; color: #6d727a; }` });
  assert.equal(props.ok, true);

  const cone = compileGpu({ kind: 'scene', source: '@scene s {\n  version: 0;\n  cone #c;\n}\n' });
  assert.equal(cone.ok, false);
  assert.deepEqual(cone.diagnostics[0], { code: 'VALIDATION', severity: 'error', message: 'Unsupported scene declaration',
    range: { start: 27, end: 31, line: 3, column: 3 } });
  // #endregion scene
});

test('an @shader material lowered to WGSL with its uniforms', () => {
  // #region shader
  const paint = materialShader(`@shader #paint {
  @uniform amount: float(0, 1, .35);
  @fragment { color: mix(#d0643c, #3c78b4, amount); }
}`);
  assert.equal(paint.ok, true);
  assert.deepEqual(paint.uniforms, [{ name: 'amount', min: 0, max: 1, default: 0.35, index: 0 }]);
  assert.equal(paint.usesUV, false);
  assert.match(paint.shader.declarations, /fn material_mix/);   // WGSL the viewer draws with
  // #endregion shader
});
