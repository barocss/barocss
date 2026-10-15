import test from 'node:test';
import assert from 'node:assert/strict';
import {
  booleanCurveRegions, curveRegionArea, prismaticFromProfile, booleanPrismatic, prismaticVolume, prismaticContains, brepFromPrismatic,
  checkBrep, assertValidBrep, tessellateBrep, triangulatePolygonWithHoles,
} from '../dist/index.js';

const mulberry = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const L = (a, b) => ({ kind: 'line', a, b });
const circle2 = (cx, cy, r) => [{ kind: 'arc', c: [cx, cy], r, t0: 0, sweep: Math.PI }, { kind: 'arc', c: [cx, cy], r, t0: Math.PI, sweep: Math.PI }];
const rect2 = (x0, y0, x1, y1) => [L([x0, y0], [x1, y0]), L([x1, y0], [x1, y1]), L([x1, y1], [x0, y1]), L([x0, y1], [x0, y0])];
const slot2 = (x0, x1, y, r) => [L([x0, y - r], [x1, y - r]), { kind: 'arc', c: [x1, y], r, t0: -Math.PI / 2, sweep: Math.PI }, L([x1, y + r], [x0, y + r]), { kind: 'arc', c: [x0, y], r, t0: Math.PI / 2, sweep: Math.PI }];
const area = regions => regions.reduce((s, r) => s + curveRegionArea(r), 0);

const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
const circle = (cx, cy, r) => [{ kind: 'arc', start: [cx + r, cy], center: [cx, cy], direction: 'ccw' }];
const slot = (x0, x1, y, r) => [{ kind: 'line', start: [x0, y - r] }, { kind: 'arc', start: [x1, y - r], center: [x1, y], direction: 'ccw' }, { kind: 'line', start: [x1, y + r] }, { kind: 'arc', start: [x0, y + r], center: [x0, y], direction: 'ccw' }];
const box = (x0, y0, z0, x1, y1, z1) => prismaticFromProfile({ outer: rect(x0, y0, x1, y1), heightMM: z1 - z0, fromMM: z0 });
const cyl = (cx, cy, r, z0, z1) => prismaticFromProfile({ outer: circle(cx, cy, r), heightMM: z1 - z0, fromMM: z0 });
const U = (a, b) => booleanPrismatic(a, b, 'union'), D = (a, b) => booleanPrismatic(a, b, 'difference'), I = (a, b) => booleanPrismatic(a, b, 'intersection');

/** Signed mesh volume and whether every directed mesh edge is matched by as many reversed ones. */
function meshOf(brep, segmentsPerQuarter) {
  const m = tessellateBrep(brep, { segmentsPerQuarter }), p = m.positionsMM, ix = m.indices, he = new Map(), key = q => p[q * 3] + ',' + p[q * 3 + 1] + ',' + p[q * 3 + 2];
  let volume = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    volume += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
    for (let e = 0; e < 3; e++) { const k = key(ix[t + e]) + '>' + key(ix[t + (e + 1) % 3]); he.set(k, (he.get(k) ?? 0) + 1); }
  }
  const watertight = [...he].every(([k, n]) => { const [x, y] = k.split('>'); return he.get(y + '>' + x) === n; });
  return { volume, watertight };
}

test('line + arc Booleans: tangency, touching, concentric and identical inputs', () => {
  const pi = Math.PI, cases = [
    ['external tangency', circle2(0, 0, 5), circle2(10, 0, 5), 'union', 50 * pi, 2],
    ['internal tangency', circle2(0, 0, 5), circle2(2, 0, 3), 'difference', 16 * pi, 1],
    ['line tangent to circle', rect2(-5, 5, 5, 8), circle2(0, 0, 5), 'union', 30 + 25 * pi, 2],
    ['concentric ring', circle2(0, 0, 5), circle2(0, 0, 3), 'difference', 16 * pi, 1],
    ['identical circles', circle2(1, 1, 4), circle2(1, 1, 4), 'intersection', 16 * pi, 1],
    ['identical difference', circle2(1, 1, 4), circle2(1, 1, 4), 'difference', 0, 0],
    ['slot over its own end cap', slot2(0, 10, 0, 2), circle2(10, 0, 2), 'union', 40 + 4 * pi, 1],
    ['slot minus a tangent rectangle', slot2(0, 10, 0, 2), rect2(0, 0, 10, 5), 'difference', 20 + 4 * pi, 1],
    ['lens', circle2(0, 0, 5), circle2(6, 0, 5), 'intersection', 2 * (25 * Math.acos(3 / 5) - 3 * 4), 1],
  ];
  for (const [name, a, b, op, expected, count] of cases) {
    const r = booleanCurveRegions([a], [b], op);
    assert.ok(Math.abs(area(r) - expected) < 1e-9 * Math.max(1, expected), `${name}: ${area(r)} vs ${expected}`);
    assert.equal(r.length, count, name);
  }
  // A hole tangent inside its boundary stays one region with one hole.
  const holed = booleanCurveRegions([circle2(0, 0, 5)], [circle2(2, 0, 3)], 'difference');
  assert.equal(holed[0].holes.length, 0, 'the tangent hole opens into the boundary (one crescent ring)');
  const inner = booleanCurveRegions([circle2(0, 0, 5)], [circle2(1, 0, 3)], 'difference');
  assert.equal(inner[0].holes.length, 1);
});

test('random line + arc Booleans: area identities and point classification', () => {
  const rnd = mulberry(17), g = grid => grid ? Math.round(rnd() * 20 - 10) : rnd() * 20 - 10;
  const shape = grid => {
    const k = Math.floor(rnd() * 3), r = grid ? 1 + Math.floor(rnd() * 6) : 1 + rnd() * 6;
    if (k === 0) return { ring: circle2(g(grid), g(grid), r), area: Math.PI * r * r };
    if (k === 1) { const x = g(grid), y = g(grid), w = grid ? 1 + Math.floor(rnd() * 10) : 1 + rnd() * 10, h = grid ? 1 + Math.floor(rnd() * 10) : 1 + rnd() * 10; return { ring: rect2(x, y, x + w, y + h), area: w * h }; }
    const x = g(grid), y = g(grid), l = grid ? 1 + Math.floor(rnd() * 8) : 1 + rnd() * 8; return { ring: slot2(x, x + l, y, r), area: 2 * r * l + Math.PI * r * r };
  };
  const at = (s, u) => s.kind === 'line' ? [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u] : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep * u), s.c[1] + s.r * Math.sin(s.t0 + s.sweep * u)];
  const sample = ring => ring.flatMap(s => { const n = s.kind === 'line' ? 1 : 400; return Array.from({ length: n }, (_, k) => at(s, k / n)); });
  const pip = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const inR = (p, regions) => regions.some(r => pip(p, sample(r.outer)) && !r.holes.some(h => pip(p, sample(h))));
  const near = (p, rings) => rings.flat().some(s => s.kind === 'line'
    ? (() => { const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]], t = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * d[0] + (p[1] - s.a[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2))); return Math.hypot(s.a[0] + d[0] * t - p[0], s.a[1] + d[1] * t - p[1]) < 1e-3; })()
    : Math.abs(Math.hypot(p[0] - s.c[0], p[1] - s.c[1]) - s.r) < 1e-3);
  for (let k = 0; k < 160; k++) {
    const grid = k % 2 === 0, a = shape(grid), b = shape(grid), R = {};
    for (const op of ['union', 'intersection', 'difference', 'xor']) R[op] = booleanCurveRegions([a.ring], [b.ring], op);
    const tol = 1e-9 * 400;
    assert.ok(Math.abs(area(R.union) - (a.area + b.area - area(R.intersection))) < tol, `union ${k}`);
    assert.ok(Math.abs(area(R.difference) - (a.area - area(R.intersection))) < tol, `difference ${k}`);
    assert.ok(Math.abs(area(R.xor) - (area(R.union) - area(R.intersection))) < tol, `xor ${k}`);
    for (let s = 0; s < 12; s++) {
      const p = [rnd() * 40 - 20, rnd() * 40 - 20]; if (near(p, [a.ring, b.ring])) continue;
      const inA = pip(p, sample(a.ring)), inB = pip(p, sample(b.ring));
      assert.equal(inR(p, R.union), inA || inB, `U ${k}`); assert.equal(inR(p, R.intersection), inA && inB, `I ${k}`);
      assert.equal(inR(p, R.difference), inA && !inB, `D ${k}`); assert.equal(inR(p, R.xor), inA !== inB, `X ${k}`);
    }
  }
});

test('prismatic Booleans give valid B-reps with exact volumes, curved walls and pcurves', () => {
  const pi = Math.PI, plate = box(0, 0, 0, 40, 30, 5);
  const cases = [
    // name, solid, volume, [shells, faces, genus] per body
    ['plate', plate, 6000, [[1, 6, 0]]],
    ['through hole', D(plate, cyl(20, 15, 4, -1, 6)), 6000 - 80 * pi, [[1, 8, 1]]],
    ['boss', U(plate, cyl(10, 10, 3, 5, 8)), 6000 + 27 * pi, [[1, 9, 0]]],
    ['counterbore', D(D(plate, cyl(30, 15, 6, 2, 6)), cyl(30, 15, 3, -1, 6)), 6000 - 36 * pi * 3 - 9 * pi * 2, [[1, 11, 1]]],
    ['slot pocket', D(plate, prismaticFromProfile({ outer: slot(10, 25, 15, 3), heightMM: 3, fromMM: 2 })), 6000 - (90 + 9 * pi) * 3, [[1, 11, 0]]],
    ['cavity', D(box(0, 0, 0, 30, 30, 30), box(10, 10, 10, 20, 20, 20)), 26000, [[2, 12, 0]]],
    ['cylindrical cavity', D(box(0, 0, 0, 30, 30, 30), cyl(15, 15, 5, 10, 20)), 27000 - 250 * pi, [[2, 10, 0]]],
    ['island in a cavity', U(D(box(0, 0, 0, 30, 30, 30), box(5, 5, 5, 25, 25, 25)), box(10, 10, 10, 20, 20, 20)), 20000, [[2, 12, 0], [1, 6, 0]]],
    ['torus-shaped void', U(D(box(0, 0, 0, 30, 30, 30), box(5, 5, 5, 25, 25, 25)), cyl(15, 15, 3, 0, 30)), 19000 + 180 * pi, [[2, 14, 1]]],
    ['tube', D(cyl(0, 0, 10, 0, 10), cyl(0, 0, 6, -1, 11)), 640 * pi, [[1, 6, 1]]],
    ['crescent (internal tangency)', D(cyl(0, 0, 5, 0, 4), cyl(2, 0, 3, -1, 5)), 64 * pi, [[1, 6, 0]]],
    ['cut into two bodies', D(box(0, 0, 0, 30, 10, 5), box(10, -5, -1, 20, 15, 6)), 1000, [[1, 6, 0], [1, 6, 0]]],
    ['stacked equal sections merge', U(box(0, 0, 0, 10, 10, 5), box(0, 0, 5, 10, 10, 9)), 900, [[1, 6, 0]]],
    // Touching only along a line or at a point: separate bodies, never a non-manifold edge or vertex.
    ['edge touch', U(box(0, 0, 0, 10, 10, 5), box(10, 0, 5, 20, 10, 10)), 1000, [[1, 6, 0], [1, 6, 0]]],
    ['point touch', U(box(0, 0, 0, 10, 10, 5), box(10, 10, 5, 20, 20, 10)), 1000, [[1, 6, 0], [1, 6, 0]]],
    ['tangent cylinders', U(cyl(0, 0, 5, 0, 4), cyl(10, 0, 5, 0, 4)), 200 * pi, [[1, 4, 0], [1, 4, 0]]],
  ];
  for (const [name, solid, volume, bodies] of cases) {
    assert.ok(Math.abs(prismaticVolume(solid) - volume) < 1e-9 * volume, `${name}: ${prismaticVolume(solid)} vs ${volume}`);
    const brep = brepFromPrismatic(solid, { id: 'p' }), report = assertValidBrep(brep);
    assert.deepEqual(report.topology.map(t => [t.shells, t.faces, t.genus]).sort(), [...bodies].sort(), name);
    assert.ok(brep.coedges.every(c => c.pcurve), `${name}: every coedge has a pcurve`);
    assert.equal(checkBrep(brep, { pcurveSamples: 17 }).valid, true, name);
    const coarse = meshOf(brep, 8), fine = meshOf(brep, 64);
    assert.ok(coarse.watertight && fine.watertight, `${name}: watertight`);
    assert.ok(Math.abs(fine.volume - volume) < 2e-3 * volume, `${name}: mesh volume ${fine.volume}`);
    assert.ok(Math.abs(fine.volume - volume) <= Math.abs(coarse.volume - volume) + 1e-9, `${name}: mesh volume converges`);
  }
  assert.ok(brepFromPrismatic(U(plate, cyl(10, 10, 3, 5, 8))).faces.some(f => f.surface.degreeU === 2), 'cylinder walls are curved faces');
});

test('random prismatic Booleans: volume identities, point classification, valid watertight B-reps', () => {
  const rnd = mulberry(5), ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const prism = () => {
    const k = ri(0, 2), z0 = ri(-3, 3), h = ri(1, 5);
    const outer = k === 0 ? circle(ri(-6, 6), ri(-6, 6), ri(1, 6)) : k === 1 ? (() => { const x = ri(-8, 4), y = ri(-8, 4); return rect(x, y, x + ri(1, 8), y + ri(1, 8)); })() : (() => { const x = ri(-6, 3); return slot(x, x + ri(1, 5), ri(-5, 5), ri(1, 3)); })();
    return prismaticFromProfile({ outer, heightMM: h, fromMM: z0 });
  };
  let built = 0;
  for (let k = 0; k < 90; k++) {
    let A = prism(); const B = prism();
    if (rnd() < 0.5) A = booleanPrismatic(A, prism(), rnd() < 0.5 ? 'union' : 'difference');
    const R = { union: U(A, B), intersection: I(A, B), difference: D(A, B) }, V = prismaticVolume;
    assert.ok(Math.abs(V(R.union) + V(R.intersection) - V(A) - V(B)) < 1e-8, `U+I ${k}`);
    assert.ok(Math.abs(V(R.difference) + V(R.intersection) - V(A)) < 1e-8, `D+I ${k}`);
    for (let s = 0; s < 10; s++) {
      const p = [rnd() * 24 - 12 + 1e-4, rnd() * 24 - 12 + 1e-4, rnd() * 12 - 4 + 1e-4], a = prismaticContains(A, p), b = prismaticContains(B, p);
      assert.equal(prismaticContains(R.union, p), a || b, `U ${k}`); assert.equal(prismaticContains(R.intersection, p), a && b, `I ${k}`);
    }
    for (const [op, solid] of Object.entries(R)) {
      if (!solid.slabs.length) continue;
      const brep = brepFromPrismatic(solid, { id: 'r' });
      assert.equal(checkBrep(brep).valid, true, `${op} ${k}`);
      const mesh = meshOf(brep, 64);
      assert.ok(mesh.watertight, `${op} ${k} watertight`);
      assert.ok(Math.abs(mesh.volume - V(solid)) < 2e-3 * V(solid) + 1e-9, `${op} ${k} mesh volume`);
      built++;
    }
  }
  assert.ok(built > 150, String(built));
});

test('caps whose curves are tangent inside each other tessellate watertight (found by fuzzing)', () => {
  const slotP = (x0, x1, y, r, z0, z1) => prismaticFromProfile({ outer: slot(x0, x1, y, r), heightMM: z1 - z0, fromMM: z0 });
  const cases = [
    // A circle internally tangent to a slot's end arc, and the slot's side line tangent there too.
    I(U(cyl(2, -3, 3, 0, 3), slotP(2, 3, -2, 2, 0, 4)), slotP(-1, 4, 2, 3, 1, 5)),
    U(U(cyl(2, -3, 3, 0, 3), slotP(2, 3, -2, 2, 0, 4)), slotP(-1, 4, 2, 3, 1, 5)),
    // A disc over a smaller disc tangent inside it: the cap is a disc with a tangent hole.
    U(cyl(-2, 0, 5, 2, 6), cyl(-2, 3, 2, 1, 6)),
    // A slot end tangent inside a large circle one level down.
    U(slotP(-4, -2, 3, 1, -1, 4), cyl(-6, 0, 6, -3, -1)),
  ];
  for (const [k, solid] of cases.entries()) {
    const brep = brepFromPrismatic(solid); assert.equal(checkBrep(brep).valid, true, String(k));
    for (const q of [2, 8, 16, 64]) assert.ok(meshOf(brep, q).watertight, `case ${k} at ${q} per quarter`);
  }
});

test('arcs tangent inside each other sample on one angular grid: crescents of any extent stay watertight', () => {
  // A crescent (r 5 minus an internally tangent r 3) cut by a line through a point of each circle, so
  // the two arcs leaving the tangent point have unrelated sweeps (previously unequal chord steps).
  const crescent = (ti, to) => {
    const p = [2 + 3 * Math.cos(ti), 3 * Math.sin(ti)], q = [5 * Math.cos(to), 5 * Math.sin(to)], d = [q[0] - p[0], q[1] - p[1]];
    const P1 = [p[0] - 10 * d[0], p[1] - 10 * d[1]], P2 = [q[0] + 10 * d[0], q[1] + 10 * d[1]], f = 20 / Math.hypot(...d), n = [-d[1] * f, d[0] * f];
    const cutter = prismaticFromProfile({ outer: [P1, P2, [P2[0] + n[0], P2[1] + n[1]], [P1[0] + n[0], P1[1] + n[1]]].map(start => ({ kind: 'line', start })), heightMM: 6, fromMM: -1 });
    return brepFromPrismatic(D(D(cyl(0, 0, 5, 0, 4), cyl(2, 0, 3, -1, 5)), cutter));
  };
  assert.ok(meshOf(crescent(0.54, 0.40), 2).watertight, 'the configuration that failed before');
  for (let ti = 0.3; ti < 2.6; ti += 0.23) for (let to = 0.2; to < 1.8; to += 0.19) {
    if (5 * Math.sin(to) <= 3 * Math.sin(ti) + 0.05) continue;
    const brep = crescent(ti, to); for (const q of [2, 8]) assert.ok(meshOf(brep, q).watertight, `${ti} ${to} ${q}`);
  }
});

test('triangulation accepts holes touching the boundary and zero-width spikes', () => {
  // A square with a square hole touching its right edge at one point.
  const tris = triangulatePolygonWithHoles([[0, 0], [10, 0], [10, 5], [10, 10], [0, 10]], [[[5, 3], [10, 5], [5, 7], [3, 5]].reverse()]);
  const pts = [[0, 0], [10, 0], [10, 5], [10, 10], [0, 10], ...[[5, 3], [10, 5], [5, 7], [3, 5]].reverse()];
  const signed = tris.reduce((s, [a, b, c]) => s + ((pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0])) / 2, 0);
  assert.ok(Math.abs(signed - (100 - 14)) < 1e-9, String(signed));
  assert.ok(tris.every(([a, b, c]) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]) >= -1e-12), 'no inverted triangle');
  // A spike: the ring runs out to (8, 5) and straight back.
  const spike = [[0, 0], [6, 0], [6, 5], [8, 5], [6, 5], [6, 10], [0, 10]], st = triangulatePolygonWithHoles(spike, []);
  assert.ok(st.some(t => t.includes(3)), 'the spike tip stays in the mesh as a degenerate triangle');
  assert.ok(Math.abs(st.reduce((s, [a, b, c]) => s + ((spike[b][0] - spike[a][0]) * (spike[c][1] - spike[a][1]) - (spike[b][1] - spike[a][1]) * (spike[c][0] - spike[a][0])) / 2, 0) - 60) < 1e-9);
});
