import test from 'node:test';
import assert from 'node:assert/strict';
import { boxOnPlane, isDefaultPlane, offsetPlane, planeLabel, planeOfFace, rayOnPlane, standardPlane, tiltPlane, toLocal, toWorld, xyPlane } from '../src/sketch/plane';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { profileOf } from '../src/sketch/loops';

const near = (a: readonly number[], b: readonly number[], eps = 1e-9) => a.every((x, i) => Math.abs(x - b[i]) <= eps);

test('sketch planes of faces: horizontal keeps part X/Y, vertical runs X along the face and Y up', () => {
  const top = planeOfFace([0, 0, 1], [10, 5, 8]);
  assert.deepEqual(top, { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] });
  assert.equal(planeLabel(top!), 'Z 8');
  assert.ok(isDefaultPlane(xyPlane()) && !isDefaultPlane(top!));
  const front = planeOfFace([0, -1, 0], [32, 0, 4])!;
  assert.deepEqual(front, { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] });
  assert.equal(planeLabel(front), 'Y 0');
  const end = planeOfFace([1, 0, 0], [64, 16, 4])!;
  assert.deepEqual(end.xAxis, [0, 1, 0]);
  assert.equal(planeLabel(end), 'X 64');
  // Plane coordinates: (u, v) = (along the face, up); a point maps there and back.
  assert.ok(near(toLocal(end, [64, 10, 3]), [10, 3]));
  assert.ok(near(toWorld(end, [10, 3]), [64, 10, 3]));
  // A face turned 30° about Z, and refused tilted faces.
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const turned = planeOfFace([c, s, 0], [c * 20, s * 20, 2])!;
  assert.ok(near(turned.origin, [c * 20, s * 20, 0], 1e-3) && near(turned.xAxis, [-s, c, 0]));
  assert.equal(planeLabel(turned), '30° plane');
  // A face sloping at 45°: X level along it, Y up the slope, through the point nearest the origin.
  const slope = planeOfFace([0, -1, 1], [0, 0, 10])!, r = Math.SQRT1_2;
  assert.ok(near(slope.normal, [0, -r, r]) && near(slope.xAxis, [1, 0, 0]) && near(slope.origin, [0, -5, 5], 1e-3));
  assert.equal(planeLabel(slope), '45° tilted plane');
  assert.equal(planeOfFace([0, 0, 0], [0, 0, 0]), null);
  // A ray straight at the end face meets it at its own coordinates.
  assert.ok(near(rayOnPlane(end, [100, 12, 5], [-1, 0, 0])!, [12, 5]));
  assert.equal(rayOnPlane(end, [100, 12, 5], [1, 0, 0]), null, 'behind the ray');
  assert.deepEqual(boxOnPlane(end, [0, 0, 0], [64, 32, 8]), [[0, 0], [32, 8]]);
});

test('sketches on side faces join and cut along the face normal', () => {
  const box = rectanglePart(64, 32, 8);
  const plate = { node: box.nodes.length - 1, side: 'solid' as const };
  const front = planeOfFace([0, -1, 0], [32, 0, 4])!;
  const add = (doc: StudioDoc, ...nodes: ModelNode[]) => nodes.reduce(withNode, doc);
  // A Ø4 pin 6 mm out of the front face at (10, 4), joined to the plate.
  let d = add(box, { kind: 'sketch', profile: 'circle', center: [10, 4], radius: 2, plane: front });
  d = add(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: 6 });
  d = add(d, { kind: 'union', left: plate, right: { node: d.nodes.length - 1, side: 'solid' } });
  let r = evaluateDoc(d, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  assert.ok(near(r.bodies[0].mesh.bounds.min, [0, -6, 0], 1e-6), JSON.stringify(r.bodies[0].mesh.bounds));
  // A 10 × 4 pocket 5 deep into the +X end face: a negative distance from the face.
  const end = planeOfFace([1, 0, 0], [64, 16, 4])!;
  d = add(box, { kind: 'sketch', profile: 'rectangle', min: [11, 2], max: [21, 6], plane: end });
  d = add(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: -5 });
  d = add(d, { kind: 'difference', parent: plate, tool: { node: d.nodes.length - 1, side: 'solid' } });
  r = evaluateDoc(d, 2);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  assert.ok(r.bodies[0].mesh.faces.length > 6, 'the pocket adds faces');
  assert.ok(near(r.bodies[0].mesh.bounds.max, [64, 32, 8], 1e-6));
});

test('several closed shapes make one profile: shapes inside another are holes, the rest regions', () => {
  const plate = { kind: 'rectangle' as const, a: [0, 0] as [number, number], b: [60, 40] as [number, number] };
  const windowHole = { kind: 'rectangle' as const, a: [10, 10] as [number, number], b: [20, 30] as [number, number] };
  const bore = { kind: 'circle' as const, c: [40, 20] as [number, number], r: 5 };
  const boss = { kind: 'circle' as const, c: [80, 20] as [number, number], r: 6 };
  const r = profileOf([plate, windowHole, bore, boss]);
  assert.ok('node' in r);
  const node = r.node;
  assert.equal(node.profile, 'rectangle');
  assert.equal(node.regions?.length, 1);
  assert.equal(node.holes?.length, 2);
  // It evaluates: the plate with its two holes beside the boss.
  let d = withNode(emptyDoc(), node);
  d = withNode(d, { kind: 'extrude', sketch: 0, height: 4 });
  const ev = evaluateDoc(d, 3);
  assert.ok(ev.ok, JSON.stringify(!ev.ok && ev.error));
  // An island inside a hole and open shapes.
  assert.ok('error' in profileOf([plate, windowHole, { kind: 'circle', c: [15, 20], r: 2 }]));
  assert.ok('error' in profileOf([{ kind: 'polygon', points: [[0, 0], [5, 0]], closed: false }]));
  // (Its sides' ids as tags, R10a: a rectangle's from its lowest corner.)
  assert.deepEqual(profileOf([plate]), { node: { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] } } });
  assert.deepEqual(node.sideTags, { outer: ['e1', 'e2', 'e3', 'e4'], regions: [['e10']], holes: [['e5', 'e6', 'e7', 'e8'], ['e9']] });
});

test('coordinate planes read as their views, and offsets move along the normal', () => {
  // XZ: X right, Z up (the front view); YZ: Y right, Z up (the right view).
  assert.ok(near(toWorld(standardPlane('xz'), [3, 4]), [3, 0, 4]));
  assert.ok(near(toWorld(standardPlane('yz'), [3, 4]), [0, 3, 4]));
  assert.equal(planeLabel(offsetPlane(standardPlane('xy'), 12.5)), 'Z 12.5');
  assert.equal(planeLabel(offsetPlane(standardPlane('xz'), 10)), 'Y -10', 'XZ faces −Y');
  assert.equal(planeLabel(offsetPlane(planeOfFace([1, 0, 0], [64, 0, 0])!, 5)), 'X 69');
});

test('a plane tipped about its X axis keeps X and turns its normal towards Y', () => {
  const t = tiltPlane(standardPlane('xy'), 30), c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  assert.ok(near(t.normal, [0, s, c]) && near(t.xAxis, [1, 0, 0]));
  assert.equal(planeLabel(t), '30° tilted plane');
  assert.ok(near(toWorld(t, [0, 10]), [0, 10 * c, -10 * s]), 'its Y tips down as the normal tips towards +Y');
});

test('loft sections: picked sketches on parallel planes, carried onto the lowest one, ordered by height', async () => {
  const { loftSections, unusedSketches, pickedSketches } = await import('../src/app/profiles');
  const rect = { kind: 'sketch' as const, profile: 'rectangle' as const, min: [0, 0] as [number, number], max: [10, 10] as [number, number] };
  const circle = { kind: 'sketch' as const, profile: 'circle' as const, center: [5, 5] as [number, number], radius: 3, plane: { origin: [0, 0, 20] as [number, number, number], normal: [0, 0, 1] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] } };
  const nodes = [rect, circle];
  assert.deepEqual(unusedSketches(nodes), [0, 1]);
  assert.deepEqual(pickedSketches(nodes, undefined), [1], 'the newest unused one');
  const s = loftSections(nodes, [1, 0]);
  assert.ok(!('error' in s), JSON.stringify(s));
  assert.deepEqual(s.sections.map(x => [x.source, x.z]), [[0, 0], [1, 20]]);
  // Its loop carried onto XY keeps the circle's centre.
  const arc = s.sections[1].node.profile === 'loop' ? s.sections[1].node.segments[0] : null;
  assert.ok(arc?.kind === 'arc' && arc.center[0] === 5 && arc.center[1] === 5, JSON.stringify(arc));
  // A tilted second sketch is refused with the reason.
  const tilted = { ...circle, plane: { ...circle.plane, normal: [0, 0.6, 0.8] as [number, number, number] } };
  const bad = loftSections([rect, tilted], [0, 1]);
  assert.ok('error' in bad && /parallel/.test(bad.error));
  // The loft built from them evaluates.
  let d = withNode(emptyDoc(), rect); d = withNode(d, circle);
  for (const sec of s.sections) d = withNode(d, sec.node);
  d = withNode(d, { kind: 'loft', sections: [{ sketch: 2, z: 0 }, { sketch: 3, z: 20 }], from: [0, 1] });
  const ev = evaluateDoc(d, 4);
  assert.ok(ev.ok && ev.bodies.length === 1, JSON.stringify(!ev.ok && ev.error));
  assert.deepEqual(unusedSketches(d.nodes), [], 'the loft uses its sources');
});

test('revolve about a picked edge: a straight edge in the sketch plane becomes the axis; others are refused', async () => {
  const { revolveCommand } = await import('../src/app/profileCommands');
  let d = rectanglePart(32, 32, 16); d = withNode(d, { kind: 'sketch', profile: 'rectangle', min: [22, 13], max: [29, 19] });
  const ev = evaluateDoc(d, 5); assert.ok(ev.ok);
  const ctx = { doc: d, bodies: ev.bodies, selection: { faces: [], edges: [], bodies: [] } };
  const mesh = ev.bodies[0].mesh, edge = (name: string) => mesh.edges.findIndex(e => e.names.includes(name));
  const v = revolveCommand.defaults!(ctx);
  const onBottom = revolveCommand.onPick!(ctx, v, { face: null, edge: { body: 0, edge: edge('n1.bottom|n1.side0') } });
  assert.ok(onBottom && !('error' in onBottom && Object.keys(onBottom).length === 1), JSON.stringify(onBottom));
  assert.equal((onBottom as Record<string, unknown>).axis, 'edge');
  const off = revolveCommand.onPick!(ctx, v, { face: null, edge: { body: 0, edge: edge('n1.side0|n1.top') } });
  assert.ok(off && 'error' in off && /plane/.test(String(off.error)), JSON.stringify(off));
  // Built and evaluated: a ring about the X axis line through the origin (Pappus: area 42 × 2π × 16 mean radius).
  const next = revolveCommand.build!(ctx, onBottom as never), r = evaluateDoc(next, 6);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs((r.bodies.at(-1)!.volume ?? 0) - 42 * 2 * Math.PI * 16) < 1e-3, String(r.bodies.at(-1)!.volume));
});
