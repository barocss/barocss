// gpu's object facade (`@barocss/gpu/api`, experimental, R7): an immutable scene of meshes, lights and a background, its
// `.data` the plain description. `show(viewer, scene)` needs a browser with WebGPU, so this sample stops at `.data`. The
// Object API page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { scene, BarocssError } from '@barocss/gpu/api';
import { part } from '@barocss/cad/api';
// #endregion import

test('a scene of the bracket: its data plain, Z-up, the meshes as the part gave them', () => {
  // #region scene
  const bracket = part('bracket').box(80, 40, 10).hole({ at: [20, 20], diameterMM: 8 });
  const view = scene()
    .add(bracket.meshes(), { color: '#c8ccd2', roughness: 0.5 })
    .light({ kind: 'directional', direction: [-0.4, 0.6, -1] })
    .background('#ffffff');

  const data = view.data;
  assert.equal(data.frame, 'z-up');                         // CAD coordinates as given, no conversion
  assert.equal(data.meshes.length, 1);
  assert.ok(data.meshes[0].positions instanceof Float64Array);  // typed arrays only in the meshes
  assert.deepEqual(data.lights, [{ kind: 'directional', direction: [-0.4, 0.6, -1] }]);
  // show(viewer, view) clears the viewer, sets its lights and background, adds each mesh and fits the view.
  // #endregion scene
  assert.deepEqual([...data.meshes[0].positions], [...bracket.meshes()[0].positions]);   // byte for byte
});

test('immutable, and a mesh that is not one refused', () => {
  // #region refusals
  const empty = scene(), lit = empty.light({ kind: 'directional', direction: [0, 0, -1] });
  assert.equal(empty.data.lights, undefined);               // the first scene is unchanged
  assert.equal(lit.data.lights.length, 1);
  assert.throws(() => scene().add({ positions: new Float64Array([0, 0]) }),
    e => e instanceof BarocssError && e.code === 'MESH_INVALID');
  // #endregion refusals
});
