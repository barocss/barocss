import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep, massPropertiesOf, checkOutput } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });
/** Mesh edges (by position) not used exactly twice. */
function openEdges(mesh) {
  const P = mesh.positions, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  return [...uses.values()].filter(n => n !== 2).length;
}
function check(name, tree, method) {
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), m = massPropertiesOf(o), q = oracle(tree, 256, 6);
  assert.equal(checkOutput(o).valid, true, `${name}: valid`);
  assert.equal(openEdges(tessellateBrep(o.brep, { segmentsPerQuarter: 8 })), 0, `${name}: watertight`);
  if (method) assert.equal(m.method, method, name);
  assert.ok(Math.abs(m.volume - q.volumeMM3) <= 3 * q.e + 1e-9, `${name}: ${m.volume} vs the oracle ${q.volumeMM3} ± ${q.e}`);
  return o;
}

test('part model: a Boolean feature joins its tool parts without uniting the first with itself (L4 fuzz 20261025 #49, D260)', () => {
  // (The tool's parts were reduced from the first part over every part, the first included: each union, difference and
  // intersection began with tool ∪ tool. 49's inner union, its curve split into micro edges up a ruling where it runs
  // along it, built; united with itself it was refused, an edge used 4 times.)
  const tree = { op: 'union', a: leaf('cyl', { r: 4, h: 3.5 }, [], [-1, 0.5, -1]),
    b: { op: 'union', a: leaf('cyl', { r: 3.188, h: 4.588 }, [], [1.181, -1.081, -2.413]), b: leaf('cyl', { r: 3.623, h: 3.785 }, [['y', 346.031], ['y', 315.62]], [2.709, -1.728, 0.498]) } };
  check('a cylinder ∪ (a cylinder ∪ a tilted cylinder)', tree, 'quadrature');
  const { document } = documentOf(tree), profile = evaluateCadPart(document, undefined, { profile: true }).profile;
  for (const f of document.features.filter(f => f.kind === 'union')) assert.equal(profile[f.id].calls.booleans, 1, `${f.id}: one Boolean`);
});

test('analytic Boolean: a march past a ball\'s pole is cut back to it before the pole ends it (L4 fuzz 20261024 #154, D269)', () => {
  // (The ball's pole lies on the rounded box's edge between its top and its round; the ball's curve with the round runs
  // into it and the march stopped 4.4e-4 past it. The pole put after that made a hook: the cut's nearest point to its own
  // end lay 1.8e-4 off, its end lay on no edge, and the round's piece there was dropped. Box ∪ ball was refused; with the
  // self-union gone (D260) the part model takes that order.)
  check('a ball\'s pole on a rounded box\'s top edge', { op: 'union', a: leaf('sphere', { r: 3 }, [], [-2, -1, -2]), b: leaf('rbox', { w: 3, d: 5, h: 5, r: 1 }, [['y', 270]], [-1, -2, -2]) });
});

test('tessellation: a face whose loop touches its domain\'s side, with a hole beside it, is triangulated (L4 fuzz 20261023 #110, D270)', () => {
  // (A ball through a cylinder's wall line and bottom plane: the wall's piece and the ball's face each have a cut loop
  // touching their domain's side at a point. The Boolean's shell volume took the pinch only without holes; the
  // tessellation met the point twice a few ulps apart, its iso runs snapped each on its own, and ear clipping found no ear.)
  check('(a cylinder ∪ a ball) less a cylinder', { op: 'difference', a: { op: 'union', a: leaf('cyl', { r: 1, h: 4 }, [], [-2, 2, 2]), b: leaf('sphere', { r: 2 }, [['y', 90]], [-2, 3, 2]) }, b: leaf('cyl', { r: 3, h: 8 }, [['x', 180]], [-2, -1, 1]) });
});
