import test from 'node:test';
import assert from 'node:assert/strict';
import { cad, BrepEditor, BrepError, ExtrudedProfileError, brepFromBody, checkBrep, assertValidBrep, extrudeProfileWithHoles, tessellateBrep, triangulatePolygonWithHoles } from '../dist/index.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => ({ kind: 'line', start: p }));
const circle = (cx, cy, r) => [{ kind: 'arc', start: [cx + r, cy], center: [cx, cy], direction: 'ccw' }];
const slot = (x0, x1, y, r) => [{ kind: 'line', start: [x0, y - r] }, { kind: 'arc', start: [x1, y - r], center: [x1, y], direction: 'ccw' }, { kind: 'line', start: [x1, y + r] }, { kind: 'arc', start: [x0, y + r], center: [x0, y], direction: 'ccw' }];
const ngon = (n, R) => Array.from({ length: n }, (_, i) => ({ kind: 'line', start: [R * Math.cos(2 * Math.PI * i / n), R * Math.sin(2 * Math.PI * i / n)] }));
const euler = ({ V, E, F, L, S }) => V - E + F - (L - F) - 2 * S; // = −2G

test('Euler operators change V, E, F, L, S as defined and keep Euler–Poincaré', () => {
  const ed = new BrepEditor('t');
  const r = ed.mvfs([0, 0, 0]); assert.deepEqual(ed.counts, { V: 1, E: 0, F: 1, L: 1, S: 1 });
  const a = ed.mev(r.loop, r.vertex, [1, 0, 0]); assert.deepEqual(ed.counts, { V: 2, E: 1, F: 1, L: 1, S: 1 });
  const b = ed.mev(r.loop, a.vertex, [1, 1, 0]); ed.mev(r.loop, b.vertex, [0, 1, 0]);
  assert.equal(euler(ed.counts), 0);
  const last = ed.loopVertices(r.loop).find(v => ed.vertices.get(v).point.join() === '0,1,0');
  ed.mef(ed.outOf(r.loop, last), ed.outOf(r.loop, r.vertex)); assert.deepEqual(ed.counts, { V: 4, E: 4, F: 2, L: 2, S: 1 });
  assert.equal(euler(ed.counts), 0);
  // A strut into the face and back out is removed by kemr as a ring: E −1, L +1, still genus 0.
  const bridge = ed.mev(r.loop, r.vertex, [0.5, 0.5, 0]); ed.kemr(bridge.edge);
  assert.deepEqual(ed.counts, { V: 5, E: 4, F: 2, L: 3, S: 1 }); assert.equal(euler(ed.counts), 0);
  assert.throws(() => ed.mef(ed.outOf(r.loop, r.vertex), ed.outOf(r.loop, r.vertex)), /two distinct coedges/);
});

test('profiles with holes extrude through Euler operators: genus = holes, no vertex caps', () => {
  const cases = [
    [{ outer: rect(0, 0, 80, 40), holes: [circle(20, 20, 6), circle(60, 20, 8)], heightMM: 5 }, { V: 16, E: 24, F: 10, L: 14, G: 2 }],
    [{ outer: rect(0, 0, 100, 50), holes: [slot(15, 45, 25, 6), rect(60, 10, 85, 40)], heightMM: 8, fromMM: 2 }, { V: 24, E: 36, F: 14, L: 18, G: 2 }],
    [{ outer: ngon(200, 50), heightMM: 3 }, { V: 400, E: 600, F: 202, L: 202, G: 0 }],
    [{ outer: [[0, 0], [30, 0], [30, 10], [10, 10], [10, 25], [0, 25]].map(p => ({ kind: 'line', start: p })), heightMM: 5 }, { V: 12, E: 18, F: 8, L: 8, G: 0 }],
    [{ outer: circle(0, 0, 20), holes: [circle(0, 0, 8)], heightMM: 4 }, { V: 8, E: 12, F: 6, L: 8, G: 1 }],
  ];
  for (const [input, expected] of cases) {
    const t = assertValidBrep(extrudeProfileWithHoles(input)).topology[0];
    assert.deepEqual({ V: t.vertices, E: t.edges, F: t.faces, L: t.loops, G: t.genus }, expected, JSON.stringify(expected));
  }
  const refused = input => { try { extrudeProfileWithHoles(input); return 'none'; } catch (e) { assert.ok(e instanceof ExtrudedProfileError); return e.message; } };
  assert.match(refused({ outer: rect(0, 0, 50, 50), holes: [circle(20, 25, 8), circle(28, 25, 8)], heightMM: 5 }), /overlap/);
  assert.match(refused({ outer: rect(0, 0, 50, 50), holes: [circle(48, 25, 8)], heightMM: 5 }), /not strictly inside/);
  assert.match(refused({ outer: rect(0, 0, 50, 50), heightMM: 0 }), /positive/);
});

/** Watertight (every directed edge once, with its opposite) and the mesh's signed volume. */
function closedVolume(mesh) {
  const p = mesh.positionsMM, I = mesh.indices, key = i => `${p[3 * i]},${p[3 * i + 1]},${p[3 * i + 2]}`, directed = new Map(); let vol = 0;
  for (let t = 0; t < I.length; t += 3) {
    const k = [key(I[t]), key(I[t + 1]), key(I[t + 2])];
    for (let e = 0; e < 3; e++) { const d = k[e] + '>' + k[(e + 1) % 3]; directed.set(d, (directed.get(d) ?? 0) + 1); }
    const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    vol += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  for (const [d, n] of directed) { const [x, y] = d.split('>'); assert.equal(n, 1, d); assert.equal(directed.get(y + '>' + x), 1, 'open ' + d); }
  return vol;
}

test('B-rep tessellation is watertight, outward and converges to the exact volume — for every family', () => {
  const m = make => { const x = cad.model(); return brepFromBody(make(x).bodies.b); };
  const cases = [
    [m(x => x.build({ b: x.sketch.rectangle({ width: 20, height: 20 }).extrude(20) })), 8000, 1e-12],
    [m(x => x.build({ b: x.sketch.rectangle({ width: 64, height: 32 }).extrude(8).hole({ center: [32, 16], radius: 4 }) })), (64 * 32 - Math.PI * 16) * 8, 1e-4],
    [m(x => x.build({ b: x.sketch.circle({ center: [0, 0], radius: 5 }).extrude(10) })), Math.PI * 250, 1e-3],
    [m(x => { const a = x.sketch.rectangle({ width: 16, height: 16 }).extrude(16), b = x.sketch.rectangle({ min: [16, 0], max: [32, 8] }).extrude(16); return x.build({ b: a.union(b) }); }), 4096 + 2048, 1e-12],
    [m(x => x.build({ b: x.sketch.loop(slot(0, 40, 0, 6)).extrude(5) })), (480 + Math.PI * 36) * 5, 1e-3],
    [extrudeProfileWithHoles({ outer: rect(0, 0, 80, 40), holes: [circle(20, 20, 6), circle(60, 20, 8)], heightMM: 5 }), (3200 - Math.PI * 100) * 5, 1e-4],
    [extrudeProfileWithHoles({ outer: rect(0, 0, 100, 50), holes: [slot(15, 45, 25, 6), rect(60, 10, 85, 40)], heightMM: 8 }), (5000 - 360 - Math.PI * 36 - 750) * 8, 1e-4],
  ];
  for (const [brep, exact, tolerance] of cases) {
    const mesh = tessellateBrep(brep, { segmentsPerQuarter: 32 }), vol = closedVolume(mesh);
    assert.ok(Math.abs(vol - exact) / exact < tolerance, `${brep.source.family}: ${vol} vs ${exact}`);
    assert.equal(mesh.faces.length, brep.faces.length); assert.equal(mesh.edges.length, brep.edges.length);
    assert.equal(mesh.normals.length, mesh.positionsMM.length);
  }
  // Finer sampling converges: the cylinder's relative error falls ~16× from 8 to 32 per quarter.
  const cyl = cases[2][0], e8 = Math.abs(closedVolume(tessellateBrep(cyl, { segmentsPerQuarter: 8 })) - Math.PI * 250), e32 = Math.abs(closedVolume(tessellateBrep(cyl, { segmentsPerQuarter: 32 })) - Math.PI * 250);
  assert.ok(e8 / e32 > 12, `${e8} / ${e32}`);
});

test('planar triangulation with many holes covers exactly the face area', () => {
  const outer = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const holes = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { const x = 10 + i * 18, y = 12 + j * 22; holes.push([[x, y], [x, y + 8], [x + 8, y + 8], [x + 8, y]]); }
  const pts = [...outer, ...holes.flat()], tris = triangulatePolygonWithHoles(outer, holes);
  const area = tris.reduce((s, [a, b, c]) => s + ((pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0])) / 2, 0);
  assert.ok(Math.abs(area - (10000 - 20 * 64)) < 1e-9, String(area));
  assert.ok(tris.every(([a, b, c]) => ((pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0])) > 0));
});

test('faces the tessellator cannot handle yet are refused, not guessed', () => {
  const brep = structuredClone(extrudeProfileWithHoles({ outer: slot(0, 40, 0, 6), heightMM: 5 }));
  const curved = brep.faces.find(f => f.surface.degreeU === 2);
  brep.loops.find(l => l.id === curved.loops[0]).coedges.splice(1, 0, 'extra');
  assert.throws(() => tessellateBrep(brep), e => e instanceof BrepError && /planar and ruled/.test(e.message));
  assert.equal(checkBrep(extrudeProfileWithHoles({ outer: slot(0, 40, 0, 6), heightMM: 5 })).valid, true);
});
