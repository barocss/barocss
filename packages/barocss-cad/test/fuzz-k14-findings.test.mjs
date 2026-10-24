import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });
/** Mesh edges (by position) not used exactly twice. */
function openEdges(mesh) {
  const P = mesh.positionsMM, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  return [...uses.values()].filter(n => n !== 2).length;
}
function check(name, tree, method) {
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), m = o.massProperties(1), q = oracle(tree, 256, 6);
  assert.equal(o.validate().valid, true, `${name}: valid`);
  assert.equal(openEdges(tessellateBrep(o.brep, { segmentsPerQuarter: 8 })), 0, `${name}: watertight`);
  if (method) assert.equal(m.method, method, name);
  assert.ok(Math.abs(m.volumeMM3 - q.volumeMM3) <= 3 * q.e + 1e-9, `${name}: ${m.volumeMM3} vs the oracle ${q.volumeMM3} ± ${q.e}`);
}

test('mass: a ball\'s face cut by two planes a few hundredths from its pole is integrated with its strips (L4 fuzz 20261025 case 24, D245)', () => {
  // (Its trim, steep in v beside the pole, bowed far from its chords: the domain covered three times the face, and the
  // B-rep went to the tessellation's route, 148 e off at 64 segments a quarter.)
  check('a ball less a closed shelled box', { op: 'difference', a: leaf('sphere', { r: 3.5 }, [], [-2.5, 0.5, 1.5]), b: leaf('hbox', { w: 3.215, d: 7.473, h: 6.643, t: 0.284, open: false }, [], [-2.952, 0.17, -2.819]) }, 'quadrature');
});

test('tessellation: a curved face\'s diagonal another face\'s mesh has too is bisected on the surface (L4 fuzz 20261025, D246)', () => {
  // (Each used a chord four times: 184's cylinder wall across a box's edge between two points where it leaves the wall;
  // 99's and 126's lenses, two faces between the same two trims triangulated alike.)
  check('184: a tilted cylinder less a tilted box', { op: 'difference', a: leaf('cyl', { r: 3.162, h: 7.523 }, [['x', 305.592]], [1.583, -2.754, -1.788]), b: leaf('box', { w: 3.434, d: 6.061, h: 7.049 }, [['y', 12.116], ['x', 317.818]], [0.527, -1.787, 2.356]) });
  check('99: a ball ∩ a tilted cylinder', { op: 'intersect', a: leaf('sphere', { r: 3.78 }, [['y', 328.805]], [1.176, -0.963, 0.902]), b: leaf('cone', { r1: 1, r2: 1, h: 2 }, [['x', 103.362], ['z', 336.216]], [-2.5, 1.5, 3]) });
  check('126: two cylinders cut from a cylinder, beside a box ∪ a ball less a cylinder', { op: 'union',
    a: { op: 'difference', a: { op: 'union', a: leaf('box', { w: 3.685, d: 3.02, h: 7.38 }, [['z', 193.677]], [1.591, -0.999, -2.665]), b: leaf('sphere', { r: 2.572 }, [['y', 27.948]], [1.344, 1.89, -2.881]) }, b: leaf('cyl', { r: 2.701, h: 3.458 }, [['y', 202.882], ['z', 243.416]], [-0.992, -1.185, 0.815]) },
    b: { op: 'difference', a: leaf('cyl', { r: 3.272, h: 6.528 }, [['y', 316.862]], [-1.425, 1.624, 1.65]), b: { op: 'union', a: leaf('cyl', { r: 3.075, h: 4.454 }, [['z', 73.076], ['z', 181.357]], [0.773, -0.676, -0.66]), b: leaf('cyl', { r: 3.097, h: 3.008 }, [['z', 6.248], ['x', 60.812]], [-1.853, 2.007, -0.285]) } } });
});

test('analytic Boolean: a cylinder tangent inside a skew one at a point, the wall touching itself there, is refused, typed (L4 fuzz 20261025 case 126, shrunk; D248)', () => {
  // (The axes 0.5 apart, the radii 3.5 and 3: their curve's loops meet at the touch, and the tilted wall's face passed
  // through it twice — a strict-invalid body, returned unchecked before. Empty a step either side along the normal: one
  // lump touching itself, D205's ruling.)
  const tree = { op: 'difference', a: leaf('cyl', { r: 3.5, h: 6.5 }, [['y', 316.862]], [-1.5, 1.5, 1.5]), b: leaf('cyl', { r: 3, h: 3 }, [], [-2, 2, -0.5]) };
  assert.throws(() => evaluateCadPart(documentOf(tree).document), e => e.code === 'GEOMETRY' && /touch at \(-2, 5, 2\.0336\), where their curve crosses itself/.test(e.message));
});

test('tessellation: an edge run into a face and straight back (a spur) bounds nothing (L4 fuzz 20261025 case 120, D247)', () => {
  // (Two equal balls a pattern apart meet in the plane of a shelled box's wall; the union kept that edge with the face on
  // both sides, and its ring stacked triangles of no area there, each chord used once.)
  check('120: a ball less an open shell less a cylinder, twice 4 apart', { pattern: { kind: 'linear', axis: 'x', spacing: -4, count: 2 },
    child: { op: 'difference', a: { op: 'difference', a: leaf('sphere', { r: 4 }, [], [2, 0, 3]), b: leaf('hbox', { w: 7, d: 7, h: 3, t: 0.5, open: true }, [], [0, -2, -1]) }, b: leaf('cyl', { r: 3, h: 5 }, [], [-2, 1, -1]) } });
});

test('analytic Boolean: a curve passing 0.02 mm from a ball\'s pole is mapped into its domain there (L4 fuzz 20261024 #138, D250)', () => {
  // (The curve's domain map, 128 samples and Hermite pieces, overshot in u beside the pole, where u turns fast, and
  // looped there: refused before, an edge used once by the pole.)
  const tree = { op: 'union', a: { op: 'union', a: leaf('cyl', { r: 3.809, h: 2.265 }, [['y', 307.579], ['y', 104.626]], [-1.73, -1.993, -1.374]), b: leaf('hbox', { w: 6, d: 3.5, h: 6.5, t: 0.5, open: true }, [['z', 351.163]], [-1.5, 0.5, -1]) }, b: leaf('sphere', { r: 3.253 }, [], [-0.354, -2.217, -2.675]) };
  check('a tilted cylinder ∪ an open shell ∪ a ball', tree, 'quadrature');
});

test('curves: a long cut ending a tolerance short of one segment at both ends ends on it at both (L4 fuzz 20261025 #170, D251)', () => {
  // (A ball turned 90° about its own axis twice, then that twice about another: the two balls' circle crosses each one's
  // patch seam at points both seams pass through, and the cut stopped 9.5e-6 short of the seam at both. The first end's
  // join split the seam there, and the second end was kept from the seam's part beside the first: the face was not
  // divided, an edge used once.)
  const tree = { pattern: { kind: 'circular', axis: 'z', deg: 90, count: 2, pivot: [-1, -1, 0] }, child: { pattern: { kind: 'circular', axis: 'z', deg: 90, count: 2, pivot: [-3, -1, 0] }, child: leaf('sphere', { r: 4 }, [], [-3, -1, 0]) } };
  check('two balls a quarter turn apart, each its own copy turned', tree, 'quadrature');
});

test('analytic Boolean: coplanar pieces joined keep a piece whose ring its face\'s arrangement closed to a few tolerances (L4 fuzz 20261026 #112, D252)', () => {
  // (A closed shelled box ∪ a ball, twice 42.55° apart: the first box's wall keeps a piece inside the second copy's
  // cavity, its ring closed to 6.7e-6 where a cut's loose end was joined. Uniting the wall's pieces dropped it.)
  const tree = { pattern: { kind: 'circular', axis: 'z', deg: 42.553, count: 2, pivot: [-1.676, 0.052, 0] }, child: { op: 'union', a: leaf('hbox', { w: 4.068, d: 4.757, h: 4.846, t: 0.979, open: false }, [], [-1.18, -0.846, -1.263]), b: leaf('sphere', { r: 3.382 }, [['y', 230.956]], [1.486, -1.115, -0.023]) } };
  check('a closed shelled box ∪ a ball, twice', tree, 'quadrature');
});

test('curves: loose ends a traced curve\'s tolerance apart, or from a traced segment, join there (L4 fuzz 20261025 #148, D255)', () => {
  // (A box less (a cylinder ∩ a ball): the cylinder's rulings in the box's face, clipped against its traced trim with the
  // ball, ended 1e-4 short of the ball's arc that goes on there, and the ball's arc 1e-4 short of that trim: neither face
  // was divided, an edge used once.)
  const tree = { op: 'difference', a: leaf('box', { w: 5.475, d: 6.17, h: 5.025 }, [['x', 253.346]], [2.391, -2.406, 2.043]), b: { op: 'intersect', a: leaf('cyl', { r: 2.604, h: 6.96 }, [['x', 64.373]], [0.686, -1.385, -1.555]), b: leaf('sphere', { r: 3.147 }, [], [2.471, -2.206, -0.044]) } };
  check('a box less a cylinder ∩ a ball', tree, 'quadrature');
});
