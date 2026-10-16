import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCurve, analyzeSurface, curveLength, directDisplay, directIGES, directOps, domainsOf, emptyDirect, geometryOf, importSource, type DirectGeometry } from '../src/engine/direct';

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
