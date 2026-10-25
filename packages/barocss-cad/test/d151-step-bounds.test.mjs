import test from 'node:test';
import assert from 'node:assert/strict';
import { throatedWormWheel, exportStep, stepValidationProperties, sewSolid, tessellateBrep, evaluateSurface, checkBrep } from '../dist/index.js';

// D151 (queue item 4, D137): STEP export of the 724-face throated wheel took about 20 s, 14 s of it a tessellation at 16
// segments a quarter (770k triangles) made only for the bounding-box validation property. The box is now taken without a
// mesh (edges, planar faces by their edges, whole patches by their exact extremes). Oracles: the export's time against its
// old cost; the box against an independent maximum of a bicubic face, which a mesh's vertices fall short of.

const W = { axialModule: 3, starts: 2, diameter: 44, hand: 'right', length: 60, form: 'ZA' };
const meshBox = (brep, q) => { const P = tessellateBrep(brep, { segmentsPerQuarter: q }).positions, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); } return { lo, hi }; };

test('D151: the 724-face throated wheel exports in a few seconds (was about 20 s), its box the mesh\'s (here every extreme is on an edge)', () => {
  const { brep } = throatedWormWheel({ worm: W, teeth: 30, faceWidth: 20, boreDiameter: 20 }, { id: 's' });
  assert.equal(brep.faces.length, 724);
  const t0 = performance.now(), text = exportStep([brep], { name: 'wheel' }), ms = performance.now() - t0;
  // (About 2.2 s alone: the mass and area quadrature 1.9 s of it, the box 0.1 s; the tessellation alone was 14 s, the export
  // 17.6 s at the previous HEAD. 8.5 s inside the parallel kernel suite, hence the budget.)
  assert.ok(ms < 12000, `${Math.round(ms)} ms`);
  const box = stepValidationProperties(text).box, mesh = meshBox(brep, 4);
  for (let k = 0; k < 3; k++) {
    assert.ok(box.min[k] <= mesh.lo[k] + 1e-9 && box.max[k] >= mesh.hi[k] - 1e-9, 'the box holds the mesh');
    assert.ok(Math.abs(box.max[k] - [50.82869134389, 50.74811298242, 20][k]) <= 1e-9 && Math.abs(box.min[k] - [-50.82869134389, -50.74811298242, 0][k]) <= 1e-9, `axis ${k}: ${box.min[k]} … ${box.max[k]}`);
  }
});

test('D151: a bicubic face\'s highest point inside the patch — the STEP box has it exactly, where a mesh\'s vertices fall short', () => {
  // A 40 × 30 block whose top is a bicubic Bézier patch with an uneven bump (edges straight at z 10).
  const zs = [[10, 10, 10, 10], [10, 16, 14, 10], [10, 12, 11, 10], [10, 10, 10, 10]];
  const top = { kind: 'surface', id: 't', degreeU: 3, degreeV: 3, knotsU: [0, 0, 0, 0, 1, 1, 1, 1], knotsV: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: zs.map((r, i) => r.map((z, j) => [40 * i / 3, 30 * j / 3, z])), weights: zs.map(r => r.map(() => 1)) };
  const bil = (a, b, c, d) => ({ kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[a, b], [c, d]], weights: [[1, 1], [1, 1]] });
  const brep = sewSolid({ id: 'n', surfaces: [top, bil([0, 0, 0], [40, 0, 0], [0, 30, 0], [40, 30, 0]), bil([0, 0, 0], [0, 0, 10], [40, 0, 0], [40, 0, 10]), bil([40, 0, 0], [40, 0, 10], [40, 30, 0], [40, 30, 10]), bil([40, 30, 0], [40, 30, 10], [0, 30, 0], [0, 30, 10]), bil([0, 30, 0], [0, 30, 10], [0, 0, 0], [0, 0, 10])] });
  assert.equal(checkBrep(brep).valid, true);
  // The highest point by a 401 × 401 grid and Newton on the gradient of z (central differences), written here.
  const z = (u, v) => evaluateSurface(top, u, v)[2];
  let bu = 0, bv = 0, bz = -Infinity; for (let i = 0; i <= 400; i++) for (let j = 0; j <= 400; j++) { const w = z(i / 400, j / 400); if (w > bz) { bz = w; bu = i / 400; bv = j / 400; } }
  for (let it = 0; it < 30; it++) {
    const h = 1e-5, zu = (z(bu + h, bv) - z(bu - h, bv)) / (2 * h), zv = (z(bu, bv + h) - z(bu, bv - h)) / (2 * h);
    const zuu = (z(bu + h, bv) - 2 * z(bu, bv) + z(bu - h, bv)) / (h * h), zvv = (z(bu, bv + h) - 2 * z(bu, bv) + z(bu, bv - h)) / (h * h), zuv = (z(bu + h, bv + h) - z(bu + h, bv - h) - z(bu - h, bv + h) + z(bu - h, bv - h)) / (4 * h * h), det = zuu * zvv - zuv * zuv;
    bu -= (zvv * zu - zuv * zv) / det; bv -= (zuu * zv - zuv * zu) / det;
  }
  const highest = z(bu, bv);
  const box = stepValidationProperties(exportStep([brep])).box, mesh = meshBox(brep, 16);
  assert.ok(Math.abs(box.max[2] - highest) <= 1e-9, `${box.max[2]} vs ${highest} at (${bu}, ${bv})`);
  assert.ok(highest - mesh.hi[2] > 1e-7, `the mesh's vertices fall short: ${mesh.hi[2]} against ${highest}`);
  assert.deepEqual([box.min, box.max.slice(0, 2)].map(p => p.map(x => +x.toFixed(9))), [[0, 0, 0], [40, 30]]);
});
