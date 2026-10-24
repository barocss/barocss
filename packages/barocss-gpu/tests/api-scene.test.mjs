// R7, gpu's facade: an immutable scene whose .data is the plain description, shown in a Viewer through its public
// methods only. A Viewer stand-in records the calls (the browser check through the gpu lane's harness comes once the
// coordinate frame is settled). cad's facade's .meshes() goes in as it is: the match is by shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, show, Scene, BarocssError } from '../dist/api/index.js';
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
  assert.deepEqual(JSON.parse(JSON.stringify(lit.data)), { meshes: [{ ...triangle, material: { color: '#c8ccd2' } }], lights: [{ kind: 'directional', direction: [0, 0, -1] }], background: 'transparent' });
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
  const bracket = part('bracket').box(80, 40, 10).hole({ at: [20, 20], diameterMM: 8 });
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
