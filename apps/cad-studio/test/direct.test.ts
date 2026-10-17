import test from 'node:test';
import { loadDirect } from '../src/engine/directModule';
import assert from 'node:assert/strict';
import { analyzeCurve, analyzeSurface, curveLength, directDisplay, directIGES, directOps, domainsOf, emptyDirect, geometryOf, importIGESFile, importSource, movePole, polesOf, type DirectGeometry } from '../src/engine/direct';

/** A `.barocad` study: an arc, a line above it and a bilinear panel. */
export const STUDY = `@model study {
  version: 0;
  length-unit: mm;
  @curve #arc { type: nurbs; degree: 2; knots: [0,0,0,1,1,1]; control-points: [[0,0,0],[10,10,0],[20,0,0]]; weights: [1,1,1]; }
  @curve #top { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[0,0,10],[20,0,10]]; weights: [1,1]; }
  @curve #base { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[0,5,0],[20,5,0]]; weights: [1,1]; }
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1; knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,-5],[0,20,-5]],[[20,0,-5],[20,20,-5]]]; weights: [[1,1],[1,1]];
  }
}`;
const byName = (d: DirectGeometry, suffix: string) => { const o = d.objects.find(x => x.name.endsWith(suffix) && !x.hidden); assert.ok(o, `no visible object ending ${suffix}: ${d.objects.map(x => x.name).join(', ')}`); return o.id; };

test('direct geometry: a .barocad source imports as curve and surface objects that display', () => {
  const d = importSource(emptyDirect(), STUDY, 'study');
  assert.deepEqual(d.objects.map(o => o.name), ['study · arc', 'study · top', 'study · base', 'study · panel']);
  const shown = directDisplay(d);
  assert.deepEqual(shown.map(s => s.kind), ['curve', 'curve', 'curve', 'surface']);
  assert.equal(shown[0].positions.length, 127 * 6);
  assert.equal(shown[0].controls.length, 2 * 6, 'the control polygon');
  assert.ok(shown[3].indices!.length > 0 && shown[3].normals!.length === shown[3].positions.length);
  assert.deepEqual(domainsOf(d, d.objects[3].id), { kind: 'surface', u: [0, 1], v: [0, 1] });
  assert.throws(() => importSource(d, '@model x { version: 0; length-unit: mm; }', 'empty'), /no curves or surfaces|must contain geometry/);
});

test('direct geometry: curve tools split, reverse, join, refine and edit poles', () => {
  let d = importSource(emptyDirect(), STUDY, 'study');
  const arc = byName(d, 'arc');
  d = directOps.splitCurve(d, arc, 0.5);
  assert.equal(d.objects.find(o => o.id === arc)!.hidden, true, 'the original is hidden');
  const lower = byName(d, 'lower'), upper = byName(d, 'upper');
  const lo = geometryOf(d, d.objects.find(o => o.id === lower)!), hi = geometryOf(d, d.objects.find(o => o.id === upper)!);
  assert.ok(lo.kind === 'curve' && hi.kind === 'curve');
  assert.deepEqual(lo.controlPoints[0], [0, 0, 0]); assert.deepEqual(hi.controlPoints.at(-1), [20, 0, 0]);
  d = directOps.joinCurves(d, lower, upper);
  const joined = byName(d, 'Joined curve');
  d = directOps.reverseCurve(d, joined);
  const rev = geometryOf(d, d.objects.find(o => o.id === byName(d, 'reversed'))!);
  assert.ok(rev.kind === 'curve'); assert.deepEqual(rev.controlPoints[0], [20, 0, 0]);
  // Refinements keep the object, on a new source.
  const top = byName(d, 'top'), before = d.objects.find(o => o.id === top)!.source;
  d = directOps.insertCurveKnot(d, top, 0.25);
  const t = geometryOf(d, d.objects.find(o => o.id === top)!);
  assert.ok(t.kind === 'curve' && t.knots.length === 5); assert.notEqual(d.objects.find(o => o.id === top)!.source, before);
  d = directOps.editCurvePole(d, top, 0, { zMM: 12 });
  const edited = geometryOf(d, d.objects.find(o => o.id === top)!);
  assert.ok(edited.kind === 'curve'); assert.equal(edited.controlPoints[0][2], 12);
  d = directOps.curveInterval(d, top, 0.25, 1);
  assert.deepEqual(domainsOf(d, top), { kind: 'curve', t: [0.25, 1] });
});

test('direct geometry: surface tools split, extract, reverse, refine; curves make ruled and swept surfaces', () => {
  let d = importSource(emptyDirect(), STUDY, 'study');
  const panel = byName(d, 'panel');
  const iso = directOps.isoCurve(d, panel, 'u', 0.5);
  assert.ok(iso.objects.some(o => o.name.endsWith('u = 0.5')) && !iso.objects.find(o => o.id === panel)!.hidden);
  const split = directOps.splitSurface(d, panel, 'v', 0.25);
  assert.ok(byName(split, 'v lower') && byName(split, 'v upper'));
  const region = directOps.surfaceRegion(d, panel, [0.2, 0.8], [0, 0.5]);
  assert.deepEqual(domainsOf(region, byName(region, 'region')).kind, 'surface');
  const reversed = directOps.reverseSurface(d, panel, 'u');
  assert.ok(byName(reversed, 'u reversed'));
  d = directOps.insertSurfaceKnot(d, panel, 'u', 0.5);
  d = directOps.elevateDegree(d, panel, 'v');
  const s = geometryOf(d, d.objects.find(o => o.id === panel)!);
  assert.ok(s.kind === 'surface' && s.knotsU.length === 5 && s.degreeV === 2);
  d = directOps.editSurfacePole(d, panel, 0, 0, { zMM: 0 });
  const e = geometryOf(d, d.objects.find(o => o.id === panel)!);
  assert.ok(e.kind === 'surface'); assert.equal(e.controlPoints[0][0][2], 0);
  const ruled = directOps.ruledSurface(d, byName(d, 'base'), byName(d, 'top'));
  assert.equal(geometryOf(ruled, ruled.objects.find(o => o.id === byName(ruled, 'Ruled surface'))!).kind, 'surface');
  const swept = directOps.sweep(d, byName(d, 'arc'), byName(d, 'top'));
  assert.equal(geometryOf(swept, swept.objects.find(o => o.id === byName(swept, 'Swept surface'))!).kind, 'surface');
});

test('direct geometry: lengths, curvature and IGES', () => {
  const d = importSource(emptyDirect(), STUDY, 'study');
  assert.ok(Math.abs(curveLength(d, byName(d, 'top')) - 20) < 1e-9);
  // The arc's parabola: at its middle the tangent is along X and the radius (1/curvature) finite.
  const a = analyzeCurve(d, byName(d, 'arc'), 0.5);
  assert.ok(Math.abs(a.point[0] - 10) < 1e-9 && Math.abs(a.point[1] - 5) < 1e-9 && Math.abs(a.tangent[0] - 1) < 1e-9 && a.radius! > 0, JSON.stringify(a));
  assert.equal(analyzeCurve(d, byName(d, 'top'), 0.5).radius, null, 'a line has no radius');
  const s = analyzeSurface(d, byName(d, 'panel'), 0.5, 0.5);
  assert.ok(Math.abs(Math.abs(s.normal[2]) - 1) < 1e-12 && s.mean === 0 && s.gaussian === 0);
  const iges = directIGES(d, 'study');
  assert.match(iges, /^.{72}S {6}1/m);
  assert.equal((iges.match(/^ +12[68] /gm) ?? []).length >= 4, true, 'entity 126 curves and 128 surfaces');
});

test('direct geometry: move, rotate and scale in place; duplicate and rename', () => {
  let d = importSource(emptyDirect(), STUDY, 'study');
  const top = byName(d, 'top');
  d = directOps.move(d, [top], [0, 0, 5]);
  let g = geometryOf(d, d.objects.find(o => o.id === top)!);
  assert.ok(g.kind === 'curve'); assert.deepEqual(g.controlPoints, [[0, 0, 15], [20, 0, 15]]);
  d = directOps.rotate(d, [top], 'z', 90);
  g = geometryOf(d, d.objects.find(o => o.id === top)!);
  assert.ok(g.kind === 'curve' && Math.abs(g.controlPoints[0][0] - 10) < 1e-9 && Math.abs(g.controlPoints[0][1] + 10) < 1e-9, JSON.stringify(g.controlPoints));
  d = directOps.scale(d, [top], 0.5);
  g = geometryOf(d, d.objects.find(o => o.id === top)!);
  assert.ok(g.kind === 'curve' && Math.abs(Math.hypot(g.controlPoints[1][1] - g.controlPoints[0][1], g.controlPoints[1][0] - g.controlPoints[0][0]) - 10) < 1e-9);
  d = directOps.duplicate(d, [top]);
  assert.equal(d.objects.at(-1)!.name, 'study · top copy');
  d = directOps.rename(d, d.objects.at(-1)!.id, 'rail');
  assert.equal(d.objects.at(-1)!.name, 'rail');
  assert.throws(() => directOps.scale(d, [top], 0), /positive/);
});

test('direct geometry: a loft through three curves of one degree and knots', () => {
  let d = importSource(emptyDirect(), STUDY, 'study');
  const base = byName(d, 'base');
  d = directOps.duplicate(d, [base]);
  const lifted = d.objects.at(-1)!.id;
  d = directOps.move(d, [lifted], [0, 10, 6]);
  d = directOps.loft(d, [base, lifted, byName(d, 'top')]);
  const s = geometryOf(d, d.objects.find(o => o.id === byName(d, 'Lofted surface'))!);
  assert.ok(s.kind === 'surface' && s.degreeV === 2, JSON.stringify(s.kind));
  assert.throws(() => directOps.loft(d, [base]), /2 to 15/);
});

test('IGES: written curves and surfaces read back as the same geometry; a file it cannot read is refused', () => {
  const d = importSource(emptyDirect(), STUDY, 'study'), iges = directIGES(d);
  const r = importIGESFile(emptyDirect(), iges, 'study 2');
  assert.deepEqual([r.curves, r.surfaces], [3, 1]);
  assert.equal(r.direct.objects.length, 4);
  const a = geometryOf(d, d.objects[0]), b = geometryOf(r.direct, r.direct.objects[0]);
  assert.deepEqual(b.kind === 'curve' && b.controlPoints, a.kind === 'curve' && a.controlPoints);
  assert.throws(() => importIGESFile(emptyDirect(), 'not an iges file', 'x'), /cannot be read/);
});

test('direct: a curve raised a degree keeps its shape; a surface shows isocurves of both families', () => {
  const d = importSource(emptyDirect(), STUDY, 'study'), arc = byName(d, 'arc');
  const before = analyzeCurve(d, arc, 0.3).point, up = directOps.elevateCurveDegree(d, arc), g = geometryOf(up, up.objects.find(o => o.id === arc)!);
  assert.ok(g.kind === 'curve' && g.degree === 3);
  const after = analyzeCurve(up, arc, 0.3).point;
  assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]) < 1e-9);
  const panel = directDisplay(d).find(x => x.kind === 'surface')!;
  assert.equal(panel.isos!.length, 16 * 32 * 6, 'eight u and eight v lines of 32 segments');
});

test('direct: stretch by axis and shear copy the geometry by the affine map about its centre', () => {
  const d = importSource(emptyDirect(), STUDY, 'study'), top = byName(d, 'top');
  const s = directOps.stretch(d, [top], [2, 1, 1]), g = geometryOf(s, s.objects.find(o => o.id === top)!);
  assert.ok(g.kind === 'curve'); assert.deepEqual(g.controlPoints.map(p => p.map(v => Math.round(v * 1e9) / 1e9)), [[-10, 0, 10], [30, 0, 10]]);
  // The panel (z = −5, centre x = 10) sheared z += 0.5 (x − 10): its x = 0 edge to z = −10, its x = 20 edge to 0.
  const panel = byName(d, 'panel'), sh = directOps.shear(d, [panel], 'z', 'x', 0.5), q = geometryOf(sh, sh.objects.find(o => o.id === panel)!);
  assert.ok(q.kind === 'surface'); assert.deepEqual(q.controlPoints.flat().map(p => Math.round(p[2] * 1e9) / 1e9), [-10, -10, 0, 0]);
  assert.throws(() => directOps.shear(d, [panel], 'x', 'x', 1), /two different axes/);
});

test('direct: a loft through curves of different degrees and knots makes them alike first', async () => {
  const { evaluateSurface } = await import('@barocss/cad');
  let d = importSource(emptyDirect(), STUDY, 'study');
  const arc = byName(d, 'arc'), top = byName(d, 'top');
  d = directOps.insertCurveKnot(d, top, 0.25);
  const out = directOps.loft(d, [arc, top]), s = geometryOf(out, out.objects.at(-1)!);
  assert.ok(s.kind === 'surface');
  // The surface runs through both sections: at v = 0 the arc, at v = 1 the line.
  for (const t of [0.1, 0.5, 0.8]) {
    const a = analyzeCurve(d, arc, t).point, b = analyzeCurve(d, top, t).point, p = evaluateSurface(s, t, 0), q = evaluateSurface(s, t, 1);
    assert.ok(Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) < 1e-9 && Math.hypot(q[0] - b[0], q[1] - b[1], q[2] - b[2]) < 1e-9, `t ${t}`);
  }
  assert.equal(d.objects.length + 1, out.objects.length, 'the sections themselves are left as they were');
});

test('curves made in the studio: a sketch outline, a circle and model edges as exact curves', async () => {
  const { outlineCurve, circleCurve, edgeCurve, curvesSource } = await import('../src/engine/curveSource');
  const { xyPlane } = await import('../src/sketch/plane');
  const { evaluateDoc } = await import('../src/engine/evaluate');
  const { rectanglePart, withNode } = await import('../src/engine/doc');
  const t = Math.tan(Math.PI / 8), plane = xyPlane(5);
  // 20 × 10 with one R2 corner (a quarter arc), closed; and a Ø8 circle.
  const outline = outlineCurve(plane, [[0, 0], [18, 0], [20, 2], [20, 10], [0, 10]], [0, t, 0, 0, 0], true);
  const d = importSource(emptyDirect(), curvesSource('made', [outline, circleCurve(plane, [10, 5], 4)]), 'made');
  const [o, c] = d.objects.map(x => x.id);
  assert.ok(Math.abs(curveLength(d, o) - (18 + Math.PI + 8 + 20 + 10)) < 1e-3, String(curveLength(d, o)));
  assert.ok(Math.abs(curveLength(d, c) - 8 * Math.PI) < 1e-3);
  assert.ok(Math.abs(analyzeCurve(d, c, 0).point[2] - 5) < 1e-12, 'on the plane');
  // A box edge and a hole's rim.
  let doc = rectanglePart(32, 32, 8); doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [16, 16], radius: 4 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const m = r.bodies[0].mesh, straight = m.edges.find(e => e.straight)!.index, rim = m.edges.find(e => !e.straight)!.index;
  const e = importSource(emptyDirect(), curvesSource('edges', [edgeCurve(m, straight)!, edgeCurve(m, rim)!]), 'edges');
  assert.equal(curveLength(e, e.objects[0].id), 32);
  // (The rim is two half circles, each an edge.)
  assert.ok(Math.abs(curveLength(e, e.objects[1].id) - 4 * Math.PI) < 1e-4, `half the rim, as an arc: ${curveLength(e, e.objects[1].id)}`);
});

test('direct: a curve\'s crossings with a plane; two surfaces\' intersection curve; a point in or out of a body', async () => {
  const { curvePlaneCrossings, surfaceIntersection } = await import('../src/engine/direct');
  const { pointInBody } = await import('../src/app/measure');
  const { evaluateDoc } = await import('../src/engine/evaluate');
  const { rectanglePart } = await import('../src/engine/doc');
  const d = importSource(emptyDirect(), STUDY, 'study'), arc = byName(d, 'arc');
  // The arc (0,0)…(20,0), bulging to y = 5 at x = 10: X = 10 once, Y = 2 twice, Y = 9 never.
  const one = curvePlaneCrossings(d, arc, 'x', 10);
  assert.equal(one.length, 1); assert.ok(Math.abs(one[0].point[1] - 5) < 1e-9);
  assert.equal(curvePlaneCrossings(d, arc, 'y', 2).length, 2); assert.equal(curvePlaneCrossings(d, arc, 'y', 9).length, 0);
  // The panel (z = −5) and a wall at y = 10 from z = −10 to 0: they meet along y = 10, z = −5, 20 long.
  const wall = `@model wall { version: 0; length-unit: mm; @surface #w { type: nurbs; degree-u: 1; degree-v: 1; knots-u: [0,0,1,1]; knots-v: [0,0,1,1]; control-points: [[[0,10,-10],[0,10,0]],[[20,10,-10],[20,10,0]]]; weights: [[1,1],[1,1]]; } }`;
  const both = importSource(d, wall, 'wall'), m = surfaceIntersection(both, byName(both, 'panel'), byName(both, 'w'));
  assert.equal(m.count, 1);
  const cut = m.direct.objects.at(-1)!.id;
  assert.ok(Math.abs(curveLength(m.direct, cut) - 20) < 1e-6, String(curveLength(m.direct, cut)));
  assert.ok(Math.abs(analyzeCurve(m.direct, cut, 0.5 * (domainsOf(m.direct, cut) as { t: [number, number] }).t[1]).point[2] + 5) < 1e-6);
  assert.throws(() => surfaceIntersection(both, byName(both, 'panel'), byName(both, 'panel')), /cannot be intersected|do not meet/);
  const r = evaluateDoc(rectanglePart(10, 10, 10), 1); assert.ok(r.ok);
  assert.deepEqual([[5, 5, 5], [20, 5, 5], [10, 5, 5]].map(p => pointInBody(r.bodies[0].mesh, p as [number, number, number])), ['inside', 'outside', 'boundary']);
});

test('direct geometry: poles listed by key and moved one at a time', () => {
  let d = importSource(emptyDirect(), STUDY, 'study');
  const arc = byName(d, 'arc'), panel = byName(d, 'panel');
  assert.deepEqual(polesOf(d, arc).map(p => p.key), ['0', '1', '2']);
  assert.deepEqual(polesOf(d, panel).map(p => p.key), ['0,0', '0,1', '1,0', '1,1']);
  d = movePole(d, arc, '1', [10, 15, 2]);
  assert.deepEqual(polesOf(d, arc)[1].at, [10, 15, 2]);
  d = movePole(d, panel, '1,1', [20, 20, 3]);
  assert.deepEqual(polesOf(d, panel).map(p => p.at[2]), [-5, -5, -5, 3]);
});

test('Sweep along a picked curve: the newest sketch carried along it, a bent rod of the area times the path', async () => {
  // (The app loads the direct tools with the document's direct geometry; here, before the command asks.)
  await loadDirect();
  const { commands } = await import('../src/app/commands');
  const { evaluateDoc } = await import('../src/engine/evaluate');
  const { emptyDoc, withNode, featureLabel } = await import('../src/engine/doc');
  const w = Math.SQRT1_2, direct = importSource(emptyDirect(), `@model bend { version: 0; length-unit: mm;
  @curve #quarter { type: nurbs; degree: 2; knots: [0,0,0,1,1,1]; control-points: [[20,0,0],[20,0,20],[0,0,20]]; weights: [1,${w},1]; } }`, 'bend');
  const doc = { ...withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 }), direct };
  const sweep = commands.find(c => c.id === 'sweep-curve')!, ctx = { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, direct: [] as string[] };
  assert.match((sweep.available(ctx) as { reason: string }).reason, /Pick one curve/);
  const picked = { ...ctx, direct: [direct.objects[0].id] };
  assert.equal(sweep.available(picked).ok, true);
  const next = sweep.build!(picked, sweep.defaults!(picked)), r = evaluateDoc(next, 1);
  assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const want = Math.PI * 4 * Math.PI / 2 * 20;
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - want) / want < 0.01, String(r.bodies[0].volumeMM3));
  assert.equal(featureLabel(next.nodes[1], 1, next.nodes), 'Sweep along bend · quarter');
});

test('trim by a loop: a circle above the panel cuts a hole (or keeps the disc); the support stays whole', () => {
  const w = Math.SQRT1_2, r = 4, c = [10, 10], ring = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0]];
  const circle = `@model ring { version: 0; length-unit: mm;
  @curve #circle { type: nurbs; degree: 2; knots: [0,0,0,0.25,0.25,0.5,0.5,0.75,0.75,1,1,1]; control-points: [${ring.map(([x, y]) => `[${c[0] + r * x},${c[1] + r * y},3]`).join(',')}]; weights: [${ring.map((_, k) => k % 2 ? w : 1).join(',')}]; }
  @curve #shifted { type: nurbs; degree: 2; knots: [0,0,0,0.25,0.25,0.5,0.5,0.75,0.75,1,1,1]; control-points: [${ring.map(([x, y]) => `[${c[0] + 3 + r * x},${c[1] + r * y},3]`).join(',')}]; weights: [${ring.map((_, k) => k % 2 ? w : 1).join(',')}]; }
  @curve #open { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[2,2,0],[8,8,0]]; weights: [1,1]; }
  @curve #eight { type: nurbs; degree: 1; knots: [0,0,0.25,0.5,0.75,1,1]; control-points: [[5,5,0],[15,15,0],[15,5,0],[5,15,0],[5,5,0]]; weights: [1,1,1,1,1]; }
}`;
  const d = importSource(importSource(emptyDirect(), STUDY, 'study'), circle, 'ring'), panel = byName(d, 'panel');
  const area = (dd: DirectGeometry) => { const s = directDisplay(dd).find(x => x.id === panel)!, p = s.positions, i = s.indices!; let a = 0;
    for (let t = 0; t < i.length; t += 3) { const A = [0, 1, 2].map(k => p[i[t] * 3 + k]), B = [0, 1, 2].map(k => p[i[t + 1] * 3 + k] - A[k]), C = [0, 1, 2].map(k => p[i[t + 2] * 3 + k] - A[k]); a += Math.hypot(B[1] * C[2] - B[2] * C[1], B[2] * C[0] - B[0] * C[2], B[0] * C[1] - B[1] * C[0]) / 2; }
    return a; };
  const hole = directOps.trimByCurve(d, panel, byName(d, 'circle'));
  assert.equal(hole.objects.find(o => o.id === panel)!.trims!.length, 1);
  assert.equal(hole.objects.find(o => o.id === panel)!.source, d.objects.find(o => o.id === panel)!.source, 'the support surface is unchanged');
  assert.ok(Math.abs(area(hole) - (400 - Math.PI * 16)) < 0.5, `hole: ${area(hole)}`);
  const disc = directOps.trimByCurve(d, panel, byName(d, 'circle'), 'inside');
  assert.ok(Math.abs(area(disc) - Math.PI * 16) < 0.5, `disc: ${area(disc)}`);
  assert.ok(Math.abs(area(directOps.untrim(hole, panel)) - 400) < 1e-6);
  assert.throws(() => directOps.trimByCurve(d, panel, byName(d, 'open')), /does not close/);
  assert.throws(() => directOps.trimByCurve(d, panel, byName(d, 'eight')), /crosses itself/);
  assert.throws(() => directOps.trimByCurve(hole, panel, byName(d, 'shifted')), /crosses an earlier trim/);
});
