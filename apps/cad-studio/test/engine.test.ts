import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, stepFor } from '../src/engine/evaluate';
import { importStep, checkBrep, brepMassProperties } from '@barocss/cad';
import { cylinderPart, emptyDoc, featureLabel, leafBodies, loftTop, prefixDoc, rectanglePart, starterDoc, withNode } from '../src/engine/doc';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';

// Signed volume of a closed, outward-wound triangle mesh.
function signedVolume(mesh: DisplayMesh) {
  let v = 0; const p = mesh.positions, i = mesh.indices;
  for (let t = 0; t < i.length; t += 3) {
    const a = i[t] * 3, b = i[t + 1] * 3, c = i[t + 2] * 3;
    v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return v;
}

test('box part evaluates to one outward mesh with 6 faces and 12 edges', () => {
  const r = evaluateDoc(rectanglePart(64, 32, 8), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  const m = r.bodies[0].mesh;
  assert.equal(m.faces.length, 6);
  assert.equal(m.edges.length, 12);
  assert.ok(Math.abs(signedVolume(m) - 64 * 32 * 8) < 1e-6);
  assert.deepEqual(m.bounds, { min: [0, 0, 0], max: [64, 32, 8] });
  assert.ok(m.edges.every(e => e.straight && e.axis));
});

test('starter plate with a hole shows a curved wall and the hole edges', () => {
  const r = evaluateDoc(starterDoc(), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const m = r.bodies[0].mesh;
  assert.ok(m.faces.some(f => f.kind === 'curved'));
  const expected = 64 * 32 * 8 - Math.PI * 16 * 8;
  assert.ok(Math.abs(signedVolume(m) - expected) / expected < 0.01, String(signedVolume(m)));
  assert.ok(m.edges.length >= 14);
});

test('cylinder part meshes caps and a smooth side without side seams', () => {
  const r = evaluateDoc(cylinderPart(10, 20), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const m = r.bodies[0].mesh;
  assert.equal(m.faces.filter(f => f.kind === 'plane').length, 2);
  assert.equal(m.edges.length, 2);
});

test('union of two boxes meshes the orthogonal result', () => {
  let doc = rectanglePart(40, 10, 6);
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 30] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 6 });
  assert.equal(leafBodies(doc.nodes).length, 2);
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  const v = signedVolume(r.bodies[0].mesh);
  assert.ok(Math.abs(v - (40 * 10 * 6 + 10 * 20 * 6)) < 1e-6, String(v));
  // An L-shaped prism: top, bottom and six sides; six edges on each cap and six verticals.
  assert.equal(r.bodies[0].mesh.faces.length, 8);
  assert.equal(r.bodies[0].mesh.edges.length, 18);
});

test('a pattern is one output holding the original and its copies; rollback evaluates a prefix', () => {
  let doc = rectanglePart(20, 10, 5);
  doc = withNode(doc, { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 30, count: 3 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  assert.ok(Math.abs(signedVolume(r.bodies[0].mesh) - 3000) < 1e-6);
  assert.equal(r.bodies[0].mesh.bounds.max[0], 80);
  const rolled = evaluateDoc(prefixDoc(doc, 2), 2);
  assert.ok(rolled.ok);
  assert.equal(rolled.bodies.length, 1);
});

test('kernel refusals come back as plain-language errors', () => {
  // A hole crossing the plate's edge is a notch; one that misses the plate is refused.
  const notch = evaluateDoc(withNode(rectanglePart(100, 60, 5), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [2, 30], radius: 4 }), 1);
  assert.ok(notch.ok && notch.bodies[0].volumeMM3! < 30000);
  const r = evaluateDoc(withNode(rectanglePart(100, 60, 5), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [200, 30], radius: 4 }), 1);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.error.title, /misses the body/);
    assert.match(r.error.detail, /misses the target/);
  }
});

test('B-rep part model: Boolean chains, holes on results, and name-based fillets that survive edits', () => {
  // Plate ∪ boss ∪ second boss, a hole through the result, then the plate's corner rounded by name.
  let doc = rectanglePart(60, 40, 8);
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [15, 20], radius: 6 });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 10, from: 8 });
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [35, 10], max: [50, 30] });
  doc = withNode(doc, { kind: 'extrude', sketch: 5, height: 6, from: 8 });
  doc = withNode(doc, { kind: 'union', left: { node: 4, side: 'solid' }, right: { node: 6, side: 'solid' } });
  doc = withNode(doc, { kind: 'hole', parent: { node: 7, side: 'solid' }, center: [15, 20], radius: 3 });
  const before = evaluateDoc(doc, 1);
  assert.ok(before.ok, JSON.stringify(!before.ok && before.error));
  const mesh = before.bodies[0].mesh, corner = mesh.edges.find(e => e.axis === 'z' && e.a[0] === 60 && e.a[1] === 0)!;
  assert.deepEqual(corner.names, ['n1.side0|n1.side1']);
  assert.ok(mesh.faces.some(f => f.name === 'n8.side0' && f.kind === 'curved'), 'the hole wall is one named face');
  doc = withNode(doc, { kind: 'fillet', parent: { node: 8, side: 'solid' }, edges: corner.names, radius: 5 });
  const filleted = evaluateDoc(doc, 2);
  assert.ok(filleted.ok, JSON.stringify(!filleted.ok && filleted.error));
  const exact = 60 * 40 * 8 + Math.PI * 36 * 10 + 15 * 20 * 6 - Math.PI * 9 * 18 - (25 - 25 * Math.PI / 4) * 8;
  assert.ok(Math.abs(filleted.bodies[0].volumeMM3! - exact) < 1e-6, String(filleted.bodies[0].volumeMM3));
  // A wider, thicker plate: the fillet still finds its edge by name.
  const edited = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...n, max: [90, 40] } : i === 1 ? { ...n, height: 12 } : n) as typeof doc.nodes };
  const after = evaluateDoc(edited, 3);
  assert.ok(after.ok, JSON.stringify(!after.ok && after.error));
  assert.ok(after.bodies[0].mesh.faces.some(f => f.name === 'n9.face'));
});

test('side holes along X and Y, and a pin along X joined to the plate (plane + cylinder Booleans)', () => {
  let doc = rectanglePart(60, 30, 12);
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [15, 6], radius: 3, axis: 'x' });
  doc = withNode(doc, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [45, 6], radius: 2, axis: 'y', side: 'min', depth: 10 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const [body] = r.bodies, exact = 60 * 30 * 12 - Math.PI * 9 * 60 - Math.PI * 4 * 10;
  assert.equal(body.family, 'curved');
  assert.ok(Math.abs(body.volumeMM3! - exact) < 2e-4 * exact, String(body.volumeMM3));
  assert.ok(Math.abs(signedVolume(body.mesh) - exact) / exact < 5e-3);
  assert.ok(body.mesh.faces.some(f => f.name === 'n2.side0' && f.kind === 'curved'), 'the cross hole wall is one named face');
});

test('a side hole drilled across a round boss (quartic trims) and through a plate turned 30°', () => {
  let doc = rectanglePart(60, 30, 10);
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [30, 15], radius: 8 });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 14, from: 10 });
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  doc = withNode(doc, { kind: 'hole', parent: { node: 4, side: 'solid' }, center: [15, 18], radius: 3, axis: 'x' });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  // Removed: the x-cylinder (r 3) inside the boss (r 8): ∫ 2√(9 − y²) · 2√(64 − y²) dy over |y| ≤ 3.
  let crossed = 0; for (let i = 0, n = 4000; i < n; i++) { const y = -3 + 6 * (i + 0.5) / n; crossed += 2 * Math.sqrt(9 - y * y) * 2 * Math.sqrt(64 - y * y) * 6 / n; }
  const exact = 60 * 30 * 10 + Math.PI * 64 * 14 - crossed;
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - exact) < 3e-4 * exact, String(r.bodies[0].volumeMM3));
  let turned = rectanglePart(40, 20, 10);
  turned = withNode(turned, { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis: 'z', angleDegrees: 30 });
  turned = withNode(turned, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [10, 5], radius: 2, axis: 'x' });
  const t = evaluateDoc(turned, 2);
  assert.ok(t.ok, JSON.stringify(!t.ok && t.error));
  assert.ok(t.bodies[0].volumeMM3! < 8000);
});

test('fillets and chamfers on any edge: a box top edge, a hole rim picked by one arc, a chamfered rim', () => {
  const corner = (r: number) => r * r * (1 - Math.PI / 4), k = (10 - 3 * Math.PI) / (12 - 3 * Math.PI);
  const box = rectanglePart(20, 10, 5);
  const top = evaluateDoc(withNode(box, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 2 }), 1);
  assert.ok(top.ok, JSON.stringify(!top.ok && top.error));
  assert.ok(Math.abs(top.bodies[0].volumeMM3! - (1000 - corner(2) * 20)) < 1e-4 * 1000, String(top.bodies[0].volumeMM3));
  assert.ok(top.bodies[0].mesh.faces.some(f => f.kind === 'curved' && /n2\.face/.test(f.name)), 'the fillet face is named by its feature');
  // The starter plate's hole: its rim is two arcs; either one names the whole circle.
  const plate = starterDoc(), probe = evaluateDoc(plate, 2);
  assert.ok(probe.ok);
  const rim = probe.ok && probe.bodies[0].mesh.edges.find(e => !e.straight && e.names.some(n => /n1\.top/.test(n) && /n2\./.test(n)))!;
  assert.ok(rim, 'a rim arc');
  const base = 64 * 32 * 8 - Math.PI * 16 * 8;
  const filleted = evaluateDoc(withNode(plate, { kind: 'fillet', parent: { node: 2, side: 'solid' }, edges: rim.names, radius: 1 }), 3);
  assert.ok(filleted.ok, JSON.stringify(!filleted.ok && filleted.error));
  assert.ok(Math.abs(filleted.bodies[0].volumeMM3! - (base - 2 * Math.PI * (4 + k) * corner(1))) < 1e-4 * base, String(filleted.bodies[0].volumeMM3));
  const chamfered = evaluateDoc(withNode(plate, { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edges: rim.names, distance: 1 }), 4);
  assert.ok(chamfered.ok, JSON.stringify(!chamfered.ok && chamfered.error));
  assert.ok(Math.abs(chamfered.bodies[0].volumeMM3! - (base - 2 * Math.PI * (4 + 1 / 3) * 0.5)) < 1e-4 * base, String(chamfered.bodies[0].volumeMM3));
  // A fillet as large as a boss is refused in plain words.
  let boss = withNode(rectanglePart(20, 20, 4), { kind: 'sketch', profile: 'circle', center: [10, 10], radius: 3 });
  boss = withNode(boss, { kind: 'extrude', sketch: 2, height: 5, from: 4 });
  boss = withNode(boss, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const bossRim = (() => { const r = evaluateDoc(boss, 5); return r.ok ? r.bodies[0].mesh.edges.find(e => !e.straight && e.names.some(n => /n3\.top/.test(n)))!.names : []; })();
  const full = evaluateDoc(withNode(boss, { kind: 'fillet', parent: { node: 4, side: 'solid' }, edges: bossRim, radius: 3 }), 6);
  assert.equal(full.ok, false);
  if (!full.ok) assert.match(full.error.title, /as large as the circle/);
});

test('shell: an open box from its top face, exact and still upright; a too-thick wall is refused plainly', () => {
  const box = rectanglePart(40, 30, 20);
  const r = evaluateDoc(withNode(box, { kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: 2, open: ['n1.top'] }), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies[0].family, 'upright');
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - (24000 - 36 * 26 * 18)) < 1e-6, String(r.bodies[0].volumeMM3));
  assert.ok(r.bodies[0].mesh.faces.some(f => /n2\.in\./.test(f.name)), 'inner walls are named');
  assert.equal(featureLabel(withNode(box, { kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: 2, open: [] }).nodes[2], 2, []), 'Shell 2');
  const thick = evaluateDoc(withNode(box, { kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: 20, open: ['n1.top'] }), 2);
  assert.equal(thick.ok, false);
  if (!thick.ok) assert.match(thick.error.title, /too thick/);
});

test('extrude with draft: the walls lean in, the volume is exact, the label shows the angle', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 10, draft: 5 });
  const r = evaluateDoc(doc, 1), d = 10 * Math.tan(5 * Math.PI / 180), exact = 10 * (1200 - 70 * d + 4 * d * d / 3);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - exact) < 1e-6 * exact, String(r.bodies[0].volumeMM3));
  assert.equal(featureLabel(doc.nodes[1], 1, doc.nodes), 'Extrude 10 · 5°');
});

test('a STEP file opens as a body: its faces named, features work on it', () => {
  const text = stepFor(rectanglePart(40, 30, 10), 'plate');
  assert.ok('text' in text);
  if (!('text' in text)) return;
  let doc = withNode(emptyDoc(), { kind: 'import', name: 'plate', step: text.text });
  doc = withNode(doc, { kind: 'hole', parent: { node: 0, side: 'solid' }, center: [20, 15], radius: 4 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - (12000 - Math.PI * 160)) < 2e-4 * 12000, String(r.bodies[0].volumeMM3));
  assert.ok(r.bodies[0].mesh.faces.some(f => /^n0\.n1\.top$/.test(f.name)), r.bodies[0].mesh.faces.map(f => f.name).join(' '));
  assert.equal(featureLabel(doc.nodes[0], 0, doc.nodes), 'Import plate');
  const bad = evaluateDoc(withNode(emptyDoc(), { kind: 'import', name: 'x', step: 'not a step file' }), 2);
  assert.equal(bad.ok, false);
});

test('STEP export of the whole part: every body in one exact file that reads back', () => {
  let doc = starterDoc();
  doc = withNode(doc, { kind: 'linear-pattern', parent: { node: 2, side: 'solid' }, axis: 'x', spacing: 80, count: 2 });
  const r = stepFor(doc, 'plate');
  assert.ok('text' in r, JSON.stringify(r));
  if (!('text' in r)) return;
  assert.equal((r.text.match(/MANIFOLD_SOLID_BREP/g) ?? []).length, 2);
  assert.match(r.text, /FILE_NAME\('plate\.step'/);
  const back = importStep(r.text), plate = 64 * 32 * 8 - Math.PI * 16 * 8;
  assert.equal(checkBrep(back).valid, true);
  assert.ok(Math.abs(brepMassProperties(back, 1000, { segmentsPerQuarter: 32 }).volumeMM3 - 2 * plate) < 1e-3 * plate);
  assert.ok('error' in stepFor(emptyDoc(), 'empty'));
});

test('pipe: a circle swept along a run, a bend and a run, with exact mass', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 });
  doc = withNode(doc, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 10 }, { kind: 'bend', radius: 8, angleDegrees: 90, toward: 'x' }, { kind: 'straight', length: 10 }] });
  const r = evaluateDoc(doc, 1), exact = 4 * Math.PI * (20 + 4 * Math.PI);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - exact) < 1e-9 * exact, String(r.bodies[0].volumeMM3));
  assert.equal(featureLabel(doc.nodes[1], 1, doc.nodes), 'Pipe 3 steps');
  const tight = evaluateDoc(withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 }), { kind: 'sweep', sketch: 0, path: [{ kind: 'bend', radius: 1, angleDegrees: 90, toward: 'x' }] }), 2);
  assert.equal(tight.ok, false);
});

test('shell after a fillet: a tray with a rounded foot, its hollow rounded by the radius less the wall', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 20 });
  doc = withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [0, 1, 2, 3].map(i => `n1.bottom|n1.side${i}`), radius: 4 });
  doc = withNode(doc, { kind: 'shell', parent: { node: 2, side: 'solid' }, thickness: 2, open: ['n1.top'] });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  // About what a fillet r takes along a rectangle's foot (its corner section times the perimeter; the
  // mitres at the corners change it by a fraction of a percent).
  const a = (r: number) => r * r * (1 - Math.PI / 4);
  const v = r.bodies[0].volumeMM3!, outer = 48000 - a(4) * 200, inner = 56 * 36 * 18 - a(2) * 184;
  assert.ok(Math.abs(v - (outer - inner)) < 0.01 * v, `${v} vs about ${outer - inner}`);
  const refused = evaluateDoc(withNode(withNode(withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }), { kind: 'extrude', sketch: 0, height: 20 }),
    { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 3 }), { kind: 'shell', parent: { node: 2, side: 'solid' }, thickness: 2, open: ['n1.top'] }), 2);
  assert.equal(refused.ok, false);
  assert.match(!refused.ok ? refused.error.title : '', /opening after the shell/);
});

test('shell a plate with a boss on it, open at the boss top: one hollow through both', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 6 });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [20, 10], max: [40, 30] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 10, from: 6 });
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  doc = withNode(doc, { kind: 'shell', parent: { node: 4, side: 'solid' }, thickness: 2, open: ['n3.top'] });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - (18400 - (56 * 36 * 2 + 16 * 16 * 12))) < 1e-6);
  const ledge = evaluateDoc({ ...doc, nodes: [...doc.nodes.slice(0, -1), { kind: 'shell', parent: { node: 4, side: 'solid' }, thickness: 2, open: ['n1.top'] }] }, 2);
  assert.equal(ledge.ok, false);
  assert.match(!ledge.ok ? ledge.error.title : '', /top, the bottom or a side/);
});

test('smooth loft: a square bulging to a wider middle and back, through three sections', () => {
  const sq = (h: number) => ({ kind: 'sketch' as const, profile: 'rectangle' as const, min: [10 - h, 10 - h] as [number, number], max: [10 + h, 10 + h] as [number, number] });
  let doc = withNode(withNode(withNode(emptyDoc(), sq(10)), sq(5)), sq(14));
  doc = withNode(doc, { kind: 'loft', smooth: true, sections: [{ sketch: 0, z: 0 }, { sketch: 2, z: 6 }, { sketch: 1, z: 12 }] });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  // More than the ruled loft through the same sections: the side bulges smoothly.
  const ruled = evaluateDoc({ ...doc, nodes: [...doc.nodes.slice(0, -1), { kind: 'loft', sections: [{ sketch: 0, z: 0 }, { sketch: 2, z: 6 }, { sketch: 1, z: 12 }] }] }, 2);
  assert.ok(ruled.ok && r.bodies[0].volumeMM3! > ruled.bodies[0].volumeMM3!);
  assert.equal(featureLabel(doc.nodes[3], 3, doc.nodes), 'Loft 3 sections · smooth');
});

test('shell a box with a round boss turned out of its side: one wall throughout, open at the boss end', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 20 });
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [20, 10], radius: 6 });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 20 });
  doc = withNode(doc, { kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'y', angleDegrees: 90 });
  doc = withNode(doc, { kind: 'translate', parent: { node: 4, side: 'solid' }, offset: [50, 0, 30] });
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 5, side: 'solid' } });
  doc = withNode(doc, { kind: 'shell', parent: { node: 6, side: 'solid' }, thickness: 1.5, open: ['n3.top'] });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const solid = 48000 + Math.PI * 36 * 10;
  assert.ok(r.bodies[0].volumeMM3! > 0.2 * solid && r.bodies[0].volumeMM3! < 0.5 * solid, String(r.bodies[0].volumeMM3));
});

test('shell a revolved cup open at the top: exact, its walls 2 thick', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [20, 0], [20, 30], [0, 30]] });
  doc = withNode(doc, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
  doc = withNode(doc, { kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: 2, open: ['n1.side2'] });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - Math.PI * (12000 - 324 * 28)) < 1e-6 * r.bodies[0].volumeMM3!, String(r.bodies[0].volumeMM3));
});

test('loft: a square to a smaller square above is a frustum, exact; the top comes from the drawn sketch', () => {
  const bottom = { kind: 'sketch' as const, profile: 'rectangle' as const, min: [0, 0] as [number, number], max: [20, 20] as [number, number] };
  const top = loftTop(bottom, 'scaled', 0.5);
  assert.deepEqual(top, { kind: 'sketch', profile: 'rectangle', min: [5, 5], max: [15, 15] });
  assert.deepEqual(loftTop(bottom, 'circle', 0.5), { kind: 'sketch', profile: 'circle', center: [10, 10], radius: 5 });
  let doc = withNode(withNode(emptyDoc(), bottom), top);
  doc = withNode(doc, { kind: 'loft', sections: [{ sketch: 0, z: 0 }, { sketch: 1, z: 12 }] });
  const r = evaluateDoc(doc, 1), exact = 12 / 3 * (400 + 100 + 200);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - exact) < 1e-9 * exact, String(r.bodies[0].volumeMM3));
  assert.equal(featureLabel(doc.nodes[2], 2, doc.nodes), 'Loft 2 sections');
  const flat = evaluateDoc(withNode(withNode(withNode(emptyDoc(), bottom), top), { kind: 'loft', sections: [{ sketch: 0, z: 4 }, { sketch: 1, z: 4 }] }), 2);
  assert.equal(flat.ok, false);
  assert.match(!flat.ok ? flat.error.title : '', /climb/);
});

test('revolve: a circle sketch turns into a torus, cut by a box; a profile along the axis is solid, one across it refused', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [20, 10], radius: 4 });
  doc = withNode(doc, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const torus = 2 * Math.PI ** 2 * 20 * 16;
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - torus) < 1e-9 * torus, String(r.bodies[0].volumeMM3));
  assert.equal(r.bodies[0].family, 'curved');
  assert.ok(r.bodies[0].mesh.faces.every(f => f.kind === 'curved'));
  // The display mesh (8 segments per quarter) is a regular grid inscribed in the torus.
  assert.ok(Math.abs(signedVolume(r.bodies[0].mesh) - torus) < 2e-2 * torus, String(signedVolume(r.bodies[0].mesh)));
  // Cut away everything above z = 0 with a box: half the torus stays.
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [-40, -20], max: [40, 40] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 30 });
  doc = withNode(doc, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
  const cut = evaluateDoc(doc, 2);
  assert.ok(cut.ok, JSON.stringify(!cut.ok && cut.error));
  assert.equal(cut.bodies.length, 1);
  assert.ok(Math.abs(cut.bodies[0].volumeMM3! - torus / 2) < 3e-3 * torus, String(cut.bodies[0].volumeMM3));
  assert.ok(cut.bodies[0].mesh.faces.some(f => f.kind === 'plane'), 'the cut leaves flat faces');
  assert.equal(featureLabel(doc.nodes[1], 1, doc.nodes), 'Revolve 360°');
  // A half disc beside the axis turns into a sphere (poles), which a box then cuts.
  let ball = withNode(emptyDoc(), { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -6], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 6] }] });
  ball = withNode(ball, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
  const sphere = evaluateDoc(ball, 5);
  assert.ok(sphere.ok && Math.abs(sphere.bodies[0].volumeMM3! - 288 * Math.PI) < 1e-9 * 288 * Math.PI, JSON.stringify(sphere.ok ? sphere.bodies[0].volumeMM3 : sphere.error));
  ball = withNode(ball, { kind: 'sketch', profile: 'rectangle', min: [-10, -10], max: [10, 10] });
  ball = withNode(ball, { kind: 'extrude', sketch: 2, height: 10, from: 3 });
  ball = withNode(ball, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
  const capped = evaluateDoc(ball, 6), cap = Math.PI * 9 * (18 - 3) / 3;
  assert.ok(capped.ok && Math.abs(capped.bodies[0].volumeMM3! - (288 * Math.PI - cap)) < 3e-3 * 288 * Math.PI, JSON.stringify(capped.ok ? capped.bodies[0].volumeMM3 : capped.error));
  // A profile along the axis turns into a solid (a cylinder with disc ends); one across it is refused.
  const onAxis = evaluateDoc(withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [5, 5] }), { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), 3);
  assert.ok(onAxis.ok && Math.abs(onAxis.bodies[0].volumeMM3! - Math.PI * 125) < 1e-9 * Math.PI * 125, JSON.stringify(onAxis.ok ? onAxis.bodies[0].volumeMM3 : onAxis.error));
  const across = evaluateDoc(withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [-2, 0], max: [5, 5] }), { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), 4);
  assert.equal(across.ok, false);
  if (!across.ok) assert.match(across.error.title, /can’t turn about this axis/);
});

test('a slot sketch extrudes as one line + arc body with two curved faces and exact mass', async () => {
  const { slotSegments } = await import('@barocss/cad-model/sketch/profile');
  const doc = withNode(withNode(prefixDoc({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} }, 0),
    { kind: 'sketch', profile: 'loop', segments: slotSegments([0, 0], [40, 0], 6) }), { kind: 'extrude', sketch: 0, height: 5 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const [body] = r.bodies;
  assert.equal(body.family, 'upright');
  assert.equal(body.mesh.faces.length, 6);
  assert.equal(body.mesh.faces.filter(f => f.kind === 'curved').length, 2);
  const exact = (480 + Math.PI * 36) * 5;
  assert.ok(Math.abs(body.volumeMM3! - exact) < 1e-8);
  assert.ok(Math.abs(signedVolume(body.mesh) - exact) / exact < 5e-3);
  // Tangent line/arc joints draw no seam: only the two cap outlines remain (as straight runs and arc polylines).
  const cap = (f: number) => body.mesh.faces[f].kind === 'plane' && Math.abs(body.mesh.faces[f].normal[2]) > 0.99;
  assert.ok(body.mesh.edges.every(e => e.faces.some(cap)));
});

test('a concave outline with an arc notch becomes a loop body; straight convex outlines stay polygons', async () => {
  const { outlineSegments, bulgeThrough } = await import('@barocss/cad-model/sketch/profile');
  const points: [number, number][] = [[0, 0], [40, 0], [40, 20], [25, 20], [15, 20], [0, 20]];
  const bulges = [0, 0, 0, bulgeThrough([25, 20], [15, 20], [20, 15]), 0, 0];
  const segments = outlineSegments(points, bulges);
  assert.deepEqual(segments[3], { kind: 'arc', start: [25, 20], center: [20, 20], direction: 'cw' });
  const doc = withNode(withNode(prefixDoc({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} }, 0),
    { kind: 'sketch', profile: 'loop', segments }), { kind: 'extrude', sketch: 0, height: 4 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - (800 - Math.PI * 12.5) * 4) < 1e-8);
});

test('the numerical solver keeps H/V edges, honours locked lengths and reports DOF', async () => {
  const { solveOutline } = await import('@barocss/cad-model/sketch/profile');
  const rect: [number, number][] = [[0, 0], [40, 0], [40, 20], [0, 20]];
  const free = solveOutline(rect, {});
  assert.ok(free.ok); assert.equal(free.dof, 2);
  const locked = solveOutline(rect, { lengths: { 0: 50, 1: 25 } });
  assert.ok(locked.ok); assert.equal(locked.dof, 0);
  assert.deepEqual(locked.points, [[0, 0], [50, 0], [50, 25], [0, 25]]);
  const conflict = solveOutline(rect, { lengths: { 0: 50, 2: 30 } });
  assert.equal(conflict.ok, false);
});

test('arcs in the solver: tangent joints snap exact, a radius lock holds, DOF counts the centre', async () => {
  const { solveOutline, bulgeThrough, arcOf, inferTangents } = await import('@barocss/cad-model/sketch/profile');
  // A 40 x 20 plate whose right side is a rough bulging arc drawn by hand (not tangent to anything).
  const points: [number, number][] = [[0, 0], [40, 0], [40, 20], [0, 20]];
  const bulges = [0, bulgeThrough([40, 0], [40, 20], [47, 10]), 0, 0];
  const free = solveOutline(points, {}, bulges);
  assert.ok(free.ok);
  // 4 points + 1 centre = 10 unknowns; anchor 2, H 2, V 1, equal radii 1 → 4 DOF.
  assert.equal(free.dof, 4);
  // Lock the radius to 10 and make both joints tangent: the arc becomes a semicircle bulging +x.
  assert.deepEqual(inferTangents(points, bulges), []);
  const locked = solveOutline(points, { radii: { 1: 10 }, tangents: [1, 2], lengths: { 0: 40 } }, bulges);
  assert.ok(locked.ok, !locked.ok ? locked.reason : '');
  const arc = arcOf(locked.points[1], locked.points[2], locked.bulges[1]);
  assert.ok(Math.abs(arc.radius - 10) < 1e-6, String(arc.radius));
  assert.ok(Math.abs(Math.abs(arc.sweep) - Math.PI) < 1e-6, String(arc.sweep));
  assert.deepEqual(locked.points, [[0, 0], [40, 0], [40, 20], [0, 20]]);
  // anchor 2 + H 2 + V 1 + equal radii 1 + radius 1 + tangents 2 + length 1 = 10 = unknowns.
  assert.equal(locked.dof, 0);
});

test('closing an outline infers near-tangent arc joints and settles them exact', async () => {
  const { settleShape } = await import('../src/sketch/settle');
  const { arcOf } = await import('@barocss/cad-model/sketch/profile');
  // Arc from (40,0) to (40,20) nearly tangent to the bottom and top edges (bulge ≈ 1 = semicircle).
  const open = { kind: 'polygon' as const, points: [[0, 0], [40, 0], [40, 20], [0, 20]] as [number, number][], closed: false, bulges: [0, 0.97, 0, 0] };
  const r = settleShape({ ...open, closed: true }, open);
  assert.equal(r.error, null);
  const s = r.shape as typeof open & { tangents: number[] };
  assert.deepEqual(s.tangents, [1, 2]);
  const arc = arcOf(s.points[1], s.points[2], s.bulges[1]);
  assert.ok(Math.abs(Math.abs(arc.sweep) - Math.PI) < 1e-6);
  // An edit that cannot hold is undone: lock the bottom edge at 40 and the arc radius at 3 (chord is 20).
  const bad = settleShape({ ...s, lengths: { 0: 40, 3: 20 }, radii: { 1: 3 } }, s);
  assert.ok(bad.error); assert.equal(bad.shape, s);
});

test('equal radius and concentric arc pairs', async () => {
  const { solveOutline, bulgeThrough, arcOf, inferArcRelations } = await import('@barocss/cad-model/sketch/profile');
  // Two hand-drawn end arcs of different radius (≈10.64 and ≈10.42).
  const points: [number, number][] = [[0, 0], [40, 0], [40, 20], [0, 20]];
  const bulges = [0, bulgeThrough([40, 0], [40, 20], [47, 10]), 0, bulgeThrough([0, 20], [0, 0], [-7.5, 10])];
  const free = solveOutline(points, {}, bulges), equal = solveOutline(points, { equalRadii: [[1, 3]] }, bulges);
  assert.ok(free.ok && equal.ok);
  assert.equal(equal.dof, free.dof - 1);
  const r = (s: typeof equal, i: number) => s.ok ? arcOf(s.points[i], s.points[(i + 1) % 4], s.bulges[i]).radius : NaN;
  assert.ok(Math.abs(r(equal, 1) - r(equal, 3)) < 1e-6, `${r(equal, 1)} vs ${r(equal, 3)}`);
  assert.deepEqual(inferArcRelations(points, bulges).equalRadii, [[1, 3]]);

  // An annular sector drawn with the inner arc's centre 1.3 mm off the outer one.
  const ring: [number, number][] = [[30, 0], [0, 30], [0, 15], [15, 0]];
  const ringBulges = [bulgeThrough([30, 0], [0, 30], [21.2132, 21.2132]), 0, bulgeThrough([0, 15], [15, 0], [10.9, 10.9]), 0];
  const before = [0, 2].map(i => arcOf(ring[i], ring[(i + 1) % 4], ringBulges[i]).center);
  assert.ok(Math.hypot(before[0][0] - before[1][0], before[0][1] - before[1][1]) > 0.5);
  assert.deepEqual(inferArcRelations(ring, ringBulges).concentric, [[0, 2]]);
  const solved = solveOutline(ring, { concentric: [[0, 2]] }, ringBulges);
  assert.ok(solved.ok, !solved.ok ? solved.reason : '');
  const after = [0, 2].map(i => arcOf(solved.points[i], solved.points[(i + 1) % 4], solved.bulges[i]).center);
  assert.ok(Math.hypot(after[0][0] - after[1][0], after[0][1] - after[1][1]) < 1e-5, JSON.stringify(after));
  // Concentric and equal radius together collapse the ring: the solver refuses instead of producing it.
  assert.equal(solveOutline(ring, { concentric: [[0, 2]], equalRadii: [[0, 2]] }, ringBulges).ok, false);
});

test('closing infers equal radii and shared centres; a loop with them still extrudes', async () => {
  const { settleShape } = await import('../src/sketch/settle');
  const { outlineSegments, bulgeThrough } = await import('@barocss/cad-model/sketch/profile');
  const open = { kind: 'polygon' as const, points: [[30, 0], [0, 30], [0, 15], [15, 0]] as [number, number][], closed: false,
    bulges: [bulgeThrough([30, 0], [0, 30], [21.2132, 21.2132]), 0, bulgeThrough([0, 15], [15, 0], [10.9, 10.9]), 0] };
  const r = settleShape({ ...open, closed: true }, open);
  assert.equal(r.error, null);
  const s = r.shape as typeof open & { concentric: [number, number][] };
  assert.deepEqual(s.concentric, [[0, 2]]);
  const doc = withNode(withNode(prefixDoc({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} }, 0),
    { kind: 'sketch', profile: 'loop', segments: outlineSegments(s.points, s.bulges) }), { kind: 'extrude', sketch: 0, height: 6 });
  const e = evaluateDoc(doc, 1);
  assert.ok(e.ok, JSON.stringify(!e.ok && e.error));
  assert.equal(e.bodies[0].mesh.faces.filter(f => f.kind === 'curved').length, 2);
});

test('sketch framing fits the rectangle into the free band between the panels', async () => {
  const { OrbitCamera } = await import('../src/viewport/camera');
  const W = 1440, H = 900, left = 64, right = 272;
  for (const [min, max] of [[[-20, -20], [100, 60]], [[0, 0], [400, 30]], [[5, 5], [6, 6]]] as [[number, number], [number, number]][]) {
    const cam = new OrbitCamera(); cam.distance = 5000; cam.target = [999, 999, 0];
    cam.aspect = W / H; cam.setView('top'); cam.frameRect(min, max, 8, left / W, right / W);
    const corners = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]].map(([x, y]) => cam.project([x, y, 8], W, H));
    for (const [x, y] of corners) { assert.ok(x >= left - 1 && x <= W - right + 1, `x ${x}`); assert.ok(y >= 0 && y <= H, `y ${y}`); }
    const cx = cam.project([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, 8], W, H)[0];
    assert.ok(Math.abs(cx - (left + (W - right)) / 2) < 1, `centre ${cx}`);
  }
});

test('a STEP file with two solids opens as two bodies that take features on their own (D2)', () => {
  let two = rectanglePart(10, 10, 5);
  two = withNode(withNode(two, { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [26, 6] }), { kind: 'extrude', sketch: 2, height: 4 });
  const text = stepFor(prefixDoc(two, two.nodes.length), 'two');
  assert.ok('text' in text);
  let doc = withNode(emptyDoc(), { kind: 'import', name: 'two', step: text.text, solids: 2 });
  assert.deepEqual(leafBodies(doc.nodes), [{ node: 0, side: 'part0' }, { node: 0, side: 'part1' }]);
  let r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.deepEqual(r.bodies.map(b => [b.key, Math.round(b.volumeMM3 ?? 0)]), [['b0_part0', 500], ['b0_part1', 144]]);
  doc = withNode(doc, { kind: 'translate', parent: { node: 0, side: 'part1' }, offset: [0, 0, 10] });
  r = evaluateDoc(doc, 2);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.deepEqual(r.bodies.map(b => b.key), ['b0_part0', 'b1']);
  assert.equal(r.bodies[1].mesh.bounds.min[2], 10);
  // Without `solids` (files opened before): one body, as it was.
  r = evaluateDoc(withNode(emptyDoc(), { kind: 'import', name: 'two', step: text.text }), 3);
  assert.ok(r.ok); assert.deepEqual(r.bodies.map(b => b.key), ['b0']);
});

test('sewn surfaces become one closed body; a missing side is refused with the open edges', () => {
  const S = (pts: [number, number, number][][]) => ({ degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: pts, weights: [[1, 1], [1, 1]] });
  const cube = [
    S([[[0, 0, 0], [8, 0, 0]], [[0, 8, 0], [8, 8, 0]]]), S([[[0, 0, 8], [8, 0, 8]], [[0, 8, 8], [8, 8, 8]]]),
    S([[[0, 0, 0], [0, 0, 8]], [[8, 0, 0], [8, 0, 8]]]), S([[[0, 8, 0], [0, 8, 8]], [[8, 8, 0], [8, 8, 8]]]),
    S([[[0, 0, 0], [0, 0, 8]], [[0, 8, 0], [0, 8, 8]]]), S([[[8, 0, 0], [8, 0, 8]], [[8, 8, 0], [8, 8, 8]]]),
  ];
  const node = { kind: 'sew' as const, names: cube.map((_, k) => `s${k}`), surfaces: cube }, r = evaluateDoc(withNode(emptyDoc(), node), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(featureLabel(node, 0, [node]), 'Sew 6 surfaces');
  assert.equal(r.bodies[0].mesh.faces.length, 6);
  assert.ok(Math.abs(signedVolume(r.bodies[0].mesh) - 512) < 1e-6);
  const open = evaluateDoc(withNode(emptyDoc(), { kind: 'sew', names: [], surfaces: cube.slice(1) }), 1);
  assert.ok(!open.ok && /do not close/.test(JSON.stringify(open.error)));
});

test('a cross hole whose side touches a vertical hole’s wall from inside is built, either way round', () => {
  // A Ø4 hole along Y at x = 42 and a Ø6 hole down at x = 43 touch at (40, 30, 6): box less both holes plus
  // their overlap (integrated across the Ø4 disc) is 47223.31 mm³.
  let ov = 0; for (let i = 0; i < 20000; i++) { const x = 40 + 4 * (i + 0.5) / 20000; ov += 4 * Math.sqrt(Math.max(0, 4 - (x - 42) ** 2)) * Math.sqrt(Math.max(0, 9 - (x - 43) ** 2)) * 4 / 20000; }
  const exact = 100 * 40 * 12 - Math.PI * 9 * 12 - Math.PI * 4 * 40 + ov;
  const across = { kind: 'hole' as const, center: [42, 6] as [number, number], radius: 2, axis: 'y' as const }, down = { kind: 'hole' as const, center: [43, 30] as [number, number], radius: 3 };
  for (const [a, b] of [[across, down], [down, across]]) {
    const doc = withNode(withNode(rectanglePart(100, 40, 12), { ...a, parent: { node: 1, side: 'solid' } }), { ...b, parent: { node: 2, side: 'solid' } });
    const r = evaluateDoc(doc, 1);
    assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
    assert.ok(Math.abs(r.bodies[0].volumeMM3! - exact) < 1e-5 * exact, `${r.bodies[0].volumeMM3} vs ${exact}`);
  }
});
