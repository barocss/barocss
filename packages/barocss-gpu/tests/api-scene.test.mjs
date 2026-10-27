// R7, gpu's facade: an immutable scene whose .data is the plain description, shown in a Viewer through its public
// methods only. A Viewer stand-in records the calls (the browser check runs through the gpu lane's harness). The frame
// is Z-up as given: cad's facade's .meshes() goes in as it is — the match is by shape, with no conversion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, show, Scene, BarocssError, LINE_MATERIAL } from '../dist/api/index.js';
import { part } from '../../barocss-cad/dist/api/index.js';

const triangle = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] };

function stand() {
  const calls = [];
  return {
    calls, lights: null,
    clear() { calls.push(['clear']); },
    setBackground(b) { calls.push(['background', b]); },
    add(geometry, options) { calls.push(['add', geometry, options]); return {}; },
    fit() { calls.push(['fit']); },
  };
}

test('every method returns a new scene and leaves the old one as it was; .data is plain', () => {
  const empty = scene(), one = empty.add(triangle, { color: '#c8ccd2' });
  assert.ok(one instanceof Scene);
  assert.equal(empty.data.meshes.length, 0);
  assert.equal(one.data.meshes.length, 1);
  const lit = one.light({ kind: 'directional', direction: [0, 0, -1] }).background('transparent');
  assert.equal(one.data.lights, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(lit.data)), { frame: 'z-up', meshes: [{ ...triangle, material: { color: '#c8ccd2' } }], lights: [{ kind: 'directional', direction: [0, 0, -1] }], background: 'transparent' });
});

test('show() clears, sets the lights and background, adds each mesh under its key, and fits — public methods only', () => {
  const viewer = stand();
  const view = scene().add([{ ...triangle, key: 'a' }], { color: '#ff0000' }).light({ kind: 'point', position: [0, 0, 5] }).background('#202020');
  show(viewer, view);
  assert.deepEqual(viewer.calls.map(c => c[0]), ['clear', 'background', 'add', 'fit']);
  assert.deepEqual(viewer.lights, [{ kind: 'point', position: [0, 0, 5] }]);
  const [, geometry, options] = viewer.calls[2];
  assert.deepEqual(geometry, triangle);
  assert.deepEqual(options, { material: { color: '#ff0000' }, name: 'a' });
});

test('cad\'s facade meshes go in as they are, byte for byte (no axis conversion)', () => {
  const bracket = part('bracket').box({ w: 80, d: 40, h: 10 }).hole(b => b.faces().facing('+z'), { d: 8, x: 20, y: 20 });
  const meshes = bracket.meshes(), viewer = stand();
  show(viewer, scene().add(meshes));
  const added = viewer.calls.filter(c => c[0] === 'add');
  assert.equal(added.length, meshes.length);
  assert.equal(added[0][1].positions, meshes[0].positions, 'the same array, not a converted copy');
  assert.equal(added[0][2].name, meshes[0].key);
});

test('refusals are typed', () => {
  const refusal = f => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const e1 = refusal(() => scene().add({ positions: [0, 0] }));
  assert.ok(e1 instanceof BarocssError); assert.equal(e1.code, 'MESH_INVALID');
  const e2 = refusal(() => scene().add({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 5] }));
  assert.equal(e2.code, 'MESH_INVALID');
  const e3 = refusal(() => scene().light({ kind: 'ambient' }));
  assert.equal(e3.code, 'LIGHT_INVALID');
});

// R7.5b: materials by id, display lines, a camera view.
test('materials by id: a scene material registered under a part\'s material id, found by the mesh that names it', () => {
  const look = { color: '#c9ccd1', metallic: 1, roughness: 0.35 };
  const view = scene().material('al6061', look).add([{ ...triangle, key: 'a', material: 'al6061' }, { ...triangle, key: 'b', material: 'pla' }]);
  // (The id stays in the data, JSON-plain; a mesh naming a material the scene doesn't have gets none.)
  assert.deepEqual(view.data.meshes.map(m => m.material), ['al6061', undefined]);
  assert.deepEqual(view.data.materials, { al6061: look });
  const viewer = stand();
  show(viewer, view);
  assert.deepEqual(viewer.calls.filter(c => c[0] === 'add').map(c => c[2]), [{ material: look, name: 'a' }, { name: 'b' }]);
  // (An id given to add() must be registered.)
  assert.throws(() => scene().add(triangle, 'steel'), e => e instanceof BarocssError && e.code === 'MATERIAL_UNKNOWN');
});

test('display lines: a facade mesh\'s lines drawn as line geometry when asked, its triangles as they were', () => {
  const lines = new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]);
  const plain = scene().add({ ...triangle, key: 'a', lines });
  assert.equal(plain.data.meshes.length, 1);
  assert.equal('lines' in plain.data.meshes[0], false, 'lines never reach GeometryInput, whose edges are segment ids');
  const drawn = scene().add({ ...triangle, key: 'a', lines }, undefined, { lines: true });
  assert.deepEqual(drawn.data.meshes.map(m => [m.key, m.topology ?? 'triangles']), [['a', 'triangles'], ['a/lines', 'lines']]);
  assert.equal(drawn.data.meshes[1].positions, lines);
  assert.deepEqual(drawn.data.meshes[1].material, LINE_MATERIAL);
  const part2 = part('p').box({ w: 10, d: 10, h: 10 }).meshes()[0];
  // (A box's 12 edges, one segment each.)
  assert.equal(part2.lines.length, 12 * 6);
});

test('a camera view: the direction and up kept, fit() framing the scene from it', () => {
  const camera = { position: [4, -6, 4], target: [1, 2, 3], up: [0, 0, 1], projection: 'perspective', fovY: 40 };
  const viewer = { ...stand(), camera };
  show(viewer, scene().add(triangle).camera('top', { projection: 'orthographic' }));
  assert.deepEqual(camera.position, [1, 2, 4]);
  assert.deepEqual(camera.up, [0, 1, 0]);
  assert.equal(camera.projection, 'orthographic');
  assert.equal(viewer.calls.at(-1)[0], 'fit');
  const iso = scene().camera('iso').data.camera;
  assert.deepEqual(iso.direction.map(v => +v.toFixed(12)), [1, -1, 1].map(v => +(v / Math.sqrt(3)).toFixed(12)));
  assert.throws(() => scene().camera({ direction: [0, 0, 1] }), e => e.code === 'CAMERA_INVALID');
  assert.throws(() => scene().camera('sideways'), e => e.code === 'CAMERA_INVALID');
});
