import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrep, lineCurve, checkBrep, evaluateCadPart, checkOutput } from '../dist/index.js';

// A sheet of one planar face bounded by line edges through `pts` (in order), on the plane z = 0 unless `surface` is given.
function sheet(pts, { surface, tol } = {}) {
  const vertices = pts.map((p, k) => ({ id: `v${k}`, point: p }));
  const edges = pts.map((p, k) => ({ id: `e${k}`, curve: lineCurve(`e${k}`, p, pts[(k + 1) % pts.length]), vertices: [`v${k}`, `v${(k + 1) % pts.length}`] }));
  const plane = surface ?? { kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-20, -20, 0], [-20, 20, 0]], [[20, -20, 0], [20, 20, 0]]], weights: [[1, 1], [1, 1]] };
  return buildBrep({ source: { family: 'test', id: 's' }, vertices, edges, ...(tol ? { tolerance: tol } : {}),
    bodies: [{ id: 'b', kind: 'sheet', shells: [{ id: 's', closed: false, faces: [{ id: 'f', surface: plane, sense: 'forward', loops: [{ kind: 'outer', uses: edges.map(e => ({ edge: e.id, sense: 'forward' })) }] }] }] }] });
}
const square = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]];

test('strict L0: a clean sheet and the corpus\'s models pass; the default check stays as it was', () => {
  const r = checkBrep(sheet(square), { strict: true });
  assert.equal(r.valid, true, r.issues[0]); assert.equal(r.maximumEdgeSurfaceGap, 0);
  const box = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'c', kind: 'extrude', sketch: 's', height: 10 }] }).outputs[0].brep;
  assert.equal(checkBrep(box, { strict: true }).valid, true);
  assert.equal(checkBrep(box).maximumEdgeSurfaceGap, 0, 'not measured unless strict');
});

test('strict L0: an edge off its face\'s surface, a crossing loop, a sliver and a blown-up tolerance are each reported', () => {
  // The face's plane lifted 0.5 mm: every edge is off it.
  const lifted = { kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-20, -20, 0.5], [-20, 20, 0.5]], [[20, -20, 0.5], [20, 20, 0.5]]], weights: [[1, 1], [1, 1]] };
  const off = checkBrep(sheet(square, { surface: lifted }), { strict: true });
  assert.ok(off.issues.some(i => /^geometry: edge e\d is 5\.00e-1 mm off the surface of face \S*f$/.test(i)), off.issues[0]);
  assert.ok(Math.abs(off.maximumEdgeSurfaceGap - 0.5) < 1e-12);
  // A bow tie: its loop crosses itself.
  const bow = checkBrep(sheet([[0, 0, 0], [10, 10, 0], [10, 0, 0], [0, 10, 0]]), { strict: true });
  assert.ok(bow.issues.some(i => /loops cross or touch/.test(i)), bow.issues.join('; '));
  // 10 mm long, 1e-9 mm wide.
  const sliver = checkBrep(sheet([[0, 0, 0], [10, 0, 0], [10, 1e-9, 0], [0, 1e-9, 0]], { tol: 1e-7 }), { strict: true });
  assert.ok(sliver.issues.some(i => /is a sliver/.test(i)), sliver.issues.join('; '));
  // A tolerance of 1 mm on a 10 mm sheet (the cap: 1e-3 of the size).
  const loose = checkBrep(sheet(square, { tol: 1 }), { strict: true });
  assert.ok(loose.issues.some(i => /^tolerance: edge e0 tolerance 1 mm is past the cap/.test(i)), loose.issues.join('; '));
  for (const r of [off, bow, sliver, loose]) assert.equal(r.valid, false);
});

// A sheet on z = 0 bounded by `parts`, each a line (its two points) or an arc ({ r, from, to } in degrees about the
// origin, one rational quadratic span per at most 90°); consecutive parts share their ends.
function curvedSheet(parts) {
  const at = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180), 0];
  const curve = (id, p) => {
    if (Array.isArray(p)) return lineCurve(id, p[0], p[1]);
    const spans = Math.ceil(Math.abs(p.to - p.from) / 90), dt = (p.to - p.from) / spans, w = Math.cos(Math.abs(dt) * Math.PI / 360), cp = [at(p.r, p.from)], wt = [1], knots = [0, 0, 0];
    for (let k = 0; k < spans; k++) { cp.push(at(p.r / w, p.from + dt * (k + 0.5)), at(p.r, p.from + dt * (k + 1))); wt.push(w, 1); if (k < spans - 1) knots.push((k + 1) / spans, (k + 1) / spans); }
    return { kind: 'curve', id, degree: 2, knots: [...knots, 1, 1, 1], controlPoints: cp, weights: wt };
  };
  const curves = parts.map((p, k) => curve(`e${k}`, p)), vertices = curves.map((c, k) => ({ id: `v${k}`, point: c.controlPoints[0] }));
  const edges = curves.map((c, k) => ({ id: `e${k}`, curve: c, vertices: [`v${k}`, `v${(k + 1) % curves.length}`] }));
  const plane = { kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-20, -20, 0], [-20, 20, 0]], [[20, -20, 0], [20, 20, 0]]], weights: [[1, 1], [1, 1]] };
  return buildBrep({ source: { family: 'test', id: 's' }, vertices, edges,
    bodies: [{ id: 'b', kind: 'sheet', shells: [{ id: 's', closed: false, faces: [{ id: 'f', surface: plane, sense: 'forward', loops: [{ kind: 'outer', uses: edges.map(e => ({ edge: e.id, sense: 'forward' })) }] }] }] }] });
}
const deg = (r, d) => [r * Math.cos(d * Math.PI / 180), r * Math.sin(d * Math.PI / 180), 0];

test('strict L0: a strip thinner than a curve\'s chord sagitta is not a crossing; a line across an arc still is (D191)', () => {
  // A 0.01 mm strip inside a quarter arc of radius 10: its 9-sample chords dip 0.048 mm inside the arc, across the
  // inner arc's samples (taken at other angles), though the edges themselves are 0.01 mm apart (L4 fuzz 83, 93).
  const strip = checkBrep(curvedSheet([{ r: 10, from: 0, to: 90 }, [deg(10, 90), deg(9.99, 85)], { r: 9.99, from: 85, to: 5 }, [deg(9.99, 5), deg(10, 0)]]), { strict: true });
  assert.equal(strip.valid, true, strip.issues.join('; '));
  // A line from the arc's end across it, out to (8, 8) and back: the loop crosses itself at (4.7, 8.8).
  const across = checkBrep(curvedSheet([{ r: 10, from: 0, to: 90 }, [deg(10, 90), [8, 8, 0]], [[8, 8, 0], deg(10, 0)]]), { strict: true });
  assert.ok(across.issues.some(i => /loops cross or touch/.test(i)), across.issues.join('; '));
});

// A sheet on z = 0: `points` its vertices, `loops` each a list of vertex indices (the first outer, the rest holes),
// joined by lines.
function loopSheet(points, loops) {
  const vertices = points.map((p, k) => ({ id: `v${k}`, point: [...p, 0] })), edges = [];
  const uses = loops.map(l => l.map((v, k) => { const w = l[(k + 1) % l.length], id = `e${edges.length}`; edges.push({ id, curve: lineCurve(id, [...points[v], 0], [...points[w], 0]), vertices: [`v${v}`, `v${w}`] }); return { edge: id, sense: 'forward' }; }));
  const plane = { kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-20, -20, 0], [-20, 20, 0]], [[20, -20, 0], [20, 20, 0]]], weights: [[1, 1], [1, 1]] };
  return buildBrep({ source: { family: 'test', id: 's' }, vertices, edges,
    bodies: [{ id: 'b', kind: 'sheet', shells: [{ id: 's', closed: false, faces: [{ id: 'f', surface: plane, sense: 'forward', loops: uses.map((u, k) => ({ kind: k ? 'inner' : 'outer', uses: u })) }] }] }] });
}

test('strict L0: a loop through one vertex twice, or a hole touching its outer loop at a shared vertex, is a face (D194)', () => {
  const touch = /loops cross or touch/;
  // Two triangles meeting at v0 (5, 5), one loop through it twice: the crescent ring's shape (prismatic solids).
  const eight = checkBrep(loopSheet([[5, 5], [0, 0], [10, 0], [10, 10], [0, 10]], [[0, 1, 2, 0, 3, 4]]), { strict: true });
  assert.equal(eight.valid, true, eight.issues.join('; '));
  // A square with a triangular hole whose corner is v1 (5, 0), a vertex of the square's side.
  const hole = checkBrep(loopSheet([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10], [4, 3], [6, 3]], [[0, 1, 2, 3, 4], [1, 5, 6]]), { strict: true });
  assert.equal(hole.valid, true, hole.issues.join('; '));
  // Still touches: the loop crossing itself at v0 (its two passes alternate about it); the hole's corner a vertex of its
  // own at the same point (identity decides, never nearness); the hole's corner inside the square's side; v0 passed
  // three times.
  for (const [name, b] of [
    ['crossing at a vertex', loopSheet([[5, 5], [0, 0], [10, 0], [10, 10], [0, 10]], [[0, 1, 2, 0, 4, 3]])],
    ['a distinct vertex at the point', loopSheet([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10], [4, 3], [6, 3], [5, 0]], [[0, 1, 2, 3, 4], [7, 5, 6]])],
    ['inside a segment', loopSheet([[0, 0], [10, 0], [10, 10], [0, 10], [4, 3], [6, 3], [5, 0]], [[0, 1, 2, 3], [6, 4, 5]])],
    ['three passes', loopSheet([[5, 5], [0, 0], [4, 0], [6, 0], [10, 0], [10, 10], [0, 10]], [[0, 1, 2, 0, 3, 4, 0, 5, 6]])],
  ]) { const r = checkBrep(b, { strict: true }); assert.ok(r.issues.some(i => touch.test(i)), `${name}: ${r.issues.join('; ')}`); }
});

test('strict L0 at a pole: an edge along a sphere patch\'s meridian from its pole is on it (no false gap)', () => {
  // Every edge of a box filleted all round: the corner balls' patches have poles; their edges lie on them exactly.
  const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
  const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
  const edges = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name);
  const r = checkOutput(evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: 2 }])).outputs[0]);
  assert.equal(r.valid, true, r.issues[0]); assert.ok(r.maximumEdgeSurfaceGap < 1e-8, `${r.maximumEdgeSurfaceGap}`);
});
