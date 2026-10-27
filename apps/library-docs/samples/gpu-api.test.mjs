// gpu's object facade (`@barocss/gpu/api`): an immutable scene of meshes, lights and a background, materials by id,
// display lines and a camera view, its `.data` the plain description. `show(viewer, scene)` needs a browser with WebGPU,
// so this sample stops at `.data`. The Object API page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { scene, LINE_MATERIAL, BarocssError } from '@barocss/gpu/api';
import { part } from '@barocss/cad/api';
import { part as studioPart } from '@barocss/cad-model/api';
// #endregion import

test('a scene of the bracket: its data plain, Z-up, the meshes as the part gave them', () => {
  // #region scene
  const bracket = part('bracket')
    .box({ w: 80, d: 40, h: 10 })
    .hole(body => body.faces().facing('+z'), { d: 8, x: 20, y: 20 });
  const view = scene()
    .add(bracket.meshes(), { color: '#c8ccd2', roughness: 0.5 })
    .light({ kind: 'directional', direction: [-0.4, 0.6, -1] })
    .background('#ffffff');

  const data = view.data;
  assert.equal(data.frame, 'z-up');                         // CAD coordinates as given, no conversion
  assert.equal(data.meshes.length, 1);
  assert.ok(data.meshes[0].positions instanceof Float32Array);  // typed arrays only in the meshes (Float32, the common shape)
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

test('a studio part shown in its material, with its display lines, from the iso view', () => {
  // #region looks
  const plate = studioPart('plate').box({ w: 60, d: 40, h: 8 }).material('al6061');
  const view = scene()
    .material('al6061', { color: '#b8bcc2', metallic: 1, roughness: 0.35 })   // a look for the part's material id
    .add(plate.meshes(), undefined, { lines: true })   // each mesh in the look its body names, and its lines
    .camera('iso', { projection: 'orthographic' });

  const { meshes, materials, camera } = view.data;
  assert.deepEqual(meshes.map(m => [m.key, m.topology ?? 'triangles', m.material]),
    [['b1', 'triangles', 'al6061'], ['b1/lines', 'lines', LINE_MATERIAL]]);
  assert.deepEqual(Object.keys(materials), ['al6061']);   // the ids stay in the data; show() resolves them
  assert.deepEqual(camera.up, [0, 0, 1]);
  // #endregion looks
  assert.throws(() => scene().add(plate.meshes(), 'pla'), e => e instanceof BarocssError && e.code === 'MATERIAL_UNKNOWN');
  assert.throws(() => scene().camera('sideways'), e => e instanceof BarocssError && e.code === 'CAMERA_INVALID');
});
