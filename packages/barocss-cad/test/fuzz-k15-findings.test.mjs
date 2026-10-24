import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep, evaluateCadPart, tessellateBrep } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';
import { intersectSegments } from '../dist/brep/curved-arrangement.js';

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
  return o;
}

test('checker: a face wrapping most of its full-turn surface, its gap beside the domain\'s middle, keeps its sense (L4 fuzz 20261025 #62, D257)', () => {
  // (The cylinder piece crossed its frame's ±π cut, so its surface spans the whole turn and the face's 6° gap lies at
  // u 0.31. The sense check took the normal at the domain's middle, 68° from the gap: the loop's vector area, which
  // points away from the gap, came out against it.)
  const piece = { op: 'difference', a: leaf('cyl', { r: 2.5, h: 6.5 }, [['x', 222.022], ['y', 71.768]], [2, -1.5, -1.5]), b: leaf('box', { w: 3.5, d: 6.5, h: 3.5 }, [], [0.5, -2, 0]) };
  const o = check('(a tilted cylinder less a box) in a linear pattern of 3, then of 2', { pattern: { kind: 'linear', axis: 'y', spacing: 8.505, count: 2 }, child: { pattern: { kind: 'linear', axis: 'y', spacing: 3.859, count: 3 }, child: piece } }, 'quadrature');
  // A loop that does run the wrong way is still found: each face turned over is refused, apart from the wrapping one,
  // whose vector area agrees with its normal at the domain's middle only when it is wrong (open: D257).
  const passed = [];
  for (const f of o.brep.faces) {
    const flipped = { ...o.brep, faces: o.brep.faces.map(g => g === f ? { ...g, sense: g.sense === 'forward' ? 'reversed' : 'forward' } : g) };
    if (!checkBrep(flipped).issues.some(i => i.startsWith(`orientation: face ${f.id} `))) passed.push(f.id);
  }
  assert.equal(o.brep.faces.length, 37);
  assert.deepEqual(passed, ['n0_body0/s0/f23']);
});

test('analytic Boolean: a cut running along a face\'s edge for most of its length keeps its part across the face (L4 fuzz 20261026 #184, D258)', () => {
  // (Copy 2's floor line z = −2 crosses copy 1's tilted end cap: across the wall's foot, then along the cap's own floor
  // edge. Its points at 0.2, 0.5 and 0.8 lay on that edge, so it was dropped whole, and the cap's strip inside copy 2's
  // floor slab stayed joined to the wall's end above it: 13 edges used once.)
  const copy = { op: 'intersect', a: leaf('hbox', { w: 7.5, d: 4.5, h: 4.5, t: 0.5, open: true }, [['z', 182.42]], [2.5, 2.5, -2.5]), b: leaf('cyl', { r: 4, h: 5 }, [['y', 82.248], ['z', 171.992]], [0, -0.5, -2.5]) };
  check('(an open shelled box ∩ a tilted cylinder) in a circular pattern of 2', { pattern: { kind: 'circular', axis: 'z', deg: 50.872, count: 2, pivot: [-2.905, 2.651, 0] }, child: copy }, 'quadrature');
});

test('curves: a crossing just inside a curve\'s end, where the chords meet past it, is found (L4 fuzz 20261026 #184, D259)', () => {
  // (A circle r 4 as a general curve, 64 chords, its chords up to 4.8e-3 inside it; a line 1 mm long coming in from outside
  // at 30° ends 2e-3 past where it crosses the circle. The chords' lines meet beyond the line's end, so Newton started at
  // its end, where the forward difference collapsed to nothing: no step, and the crossing was lost.)
  const circle = { kind: 'curve', f: t => [4 * Math.cos(t), 4 * Math.sin(t)], t0: 0, t1: 2 * Math.PI };
  for (const at of [0.05, 0.3, 1.0, 2.0]) {
    const x = [4 * Math.cos(at), 4 * Math.sin(at)], n = [Math.cos(at), Math.sin(at)], t = [-n[1], n[0]], d = [-0.5 * n[0] + 0.866 * t[0], -0.5 * n[1] + 0.866 * t[1]];
    const line = { kind: 'line', a: [x[0] - d[0], x[1] - d[1]], b: [x[0] + 2e-3 * d[0], x[1] + 2e-3 * d[1]] };
    const found = intersectSegments(circle, line, 1e-6);
    assert.equal(found.length, 1, `crossing at ${at}: ${JSON.stringify(found)}`);
    assert.ok(Math.hypot(found[0][0] - x[0], found[0][1] - x[1]) <= 1e-6, `crossing at ${at}`);
    assert.equal(intersectSegments(line, circle, 1e-6).length, 1, `crossing at ${at}, the other way round`);
  }
});
