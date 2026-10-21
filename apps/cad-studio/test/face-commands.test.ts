import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { faceProfile, fitLoop } from '@barocss/cad-model/app/faceProfile';
import { extrudeCommand } from '@barocss/cad-model/app/profileCommands';
import { carrySelection, commands, type Ctx, type Selection } from '@barocss/cad-model/app/commands';
import { editCommand, featureOfPick } from '../src/app/editCommand';
import { bodyNodes, deleteFeatures } from '@barocss/cad-model/chat/features';

function bodiesOf(doc: StudioDoc): BodyResult[] { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title); return r.bodies; }
const faceNamed = (b: BodyResult, name: string) => b.mesh.faces.findIndex(f => f.name.split('+').includes(name));
function pull(doc: StudioDoc, face: string, values: Record<string, number | string> = {}) {
  const bodies = bodiesOf(doc), f = faceNamed(bodies[bodies.length - 1], face);
  assert.ok(f >= 0, `face ${face}`);
  const ctx: Ctx = { doc, bodies, selection: { faces: [{ body: bodies.length - 1, face: f }], edges: [], bodies: [] } };
  assert.ok(extrudeCommand.available(ctx).ok);
  const out = extrudeCommand.build!(ctx, { ...extrudeCommand.defaults!(ctx), ...values });
  return { doc: out, bodies: bodiesOf(out) };
}

test('fitting a face outline: lines stay corners, chords on one circle become one arc', () => {
  const square: [number, number][] = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]];
  assert.deepEqual(fitLoop(square, 1e-4).map(s => [s.kind, s.start]), [['line', [0, 0]], ['line', [10, 0]], ['line', [10, 10]], ['line', [0, 10]]]);
  const circle = Array.from({ length: 32 }, (_, k) => [3 + 4 * Math.cos(k * Math.PI / 16), 2 + 4 * Math.sin(k * Math.PI / 16)] as [number, number]);
  assert.deepEqual(fitLoop(circle, 1e-4), [{ kind: 'arc', start: [7, 2], center: [3, 2], direction: 'ccw' }]);
  // A slot: two straight sides and two half circles.
  const slot: [number, number][] = [];
  for (let k = 0; k <= 8; k++) slot.push([10 + 3 * Math.cos(-Math.PI / 2 + k * Math.PI / 8), 3 * Math.sin(-Math.PI / 2 + k * Math.PI / 8)]);
  for (let k = 0; k <= 8; k++) slot.push([-3 * Math.cos(-Math.PI / 2 + k * Math.PI / 8), -3 * Math.sin(-Math.PI / 2 + k * Math.PI / 8)]);
  assert.deepEqual(fitLoop(slot, 1e-4).map(s => s.kind).sort(), ['arc', 'arc', 'line', 'line']);
});

test('Extrude on a picked flat face: its outline (holes too) is the profile, joined to the body', () => {
  const plate = withNode(rectanglePart(40, 20, 8), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });
  const bodies = bodiesOf(plate), top = faceNamed(bodies[0], 'n1.top');
  const sk = faceProfile(bodies[0].mesh, top)!;
  assert.equal(sk.profile, 'loop');
  assert.equal(sk.profile === 'loop' && sk.segments.length, 4);
  assert.deepEqual(sk.holes, [[{ kind: 'arc', start: [13, 10], center: [10, 10], direction: 'ccw' }]]);
  const up = pull(plate, 'n1.top', { h: 5 });
  assert.equal(up.bodies.length, 1);
  assert.ok(Math.abs(up.bodies[0].volumeMM3! - (40 * 20 - Math.PI * 9) * 13) < 0.5, String(up.bodies[0].volumeMM3));
  // Cut into it through the side face, a millimetre in.
  const cut = pull(rectanglePart(40, 20, 8), 'n1.side1', { h: 1, op: 'cut' });
  assert.ok(Math.abs(cut.bodies[0].volumeMM3! - 40 * 20 * 8 + 20 * 8 * 1) < 0.5 || Math.abs(cut.bodies[0].volumeMM3! - 40 * 20 * 8 + 40 * 8) < 0.5, String(cut.bodies[0].volumeMM3));
});

test('A rounded corner of a face comes back as its arc', () => {
  const doc = withNode(rectanglePart(40, 20, 8), { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.side1'], radius: 4 });
  const b = bodiesOf(doc)[0], sk = faceProfile(b.mesh, b.mesh.faces.findIndex(f => f.normal[2] > 0.99))!;
  assert.ok(sk.profile === 'loop');
  assert.deepEqual(sk.segments.filter(s => s.kind === 'arc'), [{ kind: 'arc', start: [36, 0], center: [36, 4], direction: 'ccw' }]);
  assert.equal(sk.segments.length, 5);
});

test('Extrude on a cylinder top: one circle; a curved face cannot be pulled', () => {
  // (A fresh document: its features n0, n1. One emptied of another's nodes would go on from that one's ids.)
  const doc = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 6 }), { kind: 'extrude', sketch: 0, height: 10 });
  const bodies = bodiesOf(doc), top = faceNamed(bodies[0], 'n1.top');
  const sk = faceProfile(bodies[0].mesh, top)!;
  assert.deepEqual(sk.profile === 'loop' && sk.segments, [{ kind: 'arc', start: [6, 0], center: [0, 0], direction: 'ccw' }]);
  const up = pull(doc, 'n1.top', { h: 4 });
  assert.ok(Math.abs(up.bodies[0].volumeMM3! - Math.PI * 36 * 14) < 0.5);
  const wall = bodies[0].mesh.faces.findIndex(f => f.kind === 'curved');
  const ctx: Ctx = { doc, bodies, selection: { faces: [{ body: 0, face: wall }], edges: [], bodies: [] } };
  const a = extrudeCommand.available(ctx);
  assert.ok(!a.ok && /flat face/.test(a.reason));
});

test('Fillet and Chamfer on a picked face: every edge round it', () => {
  const doc = rectanglePart(40, 20, 8), bodies = bodiesOf(doc), top = faceNamed(bodies[0], 'n1.top');
  const ctx: Ctx = { doc, bodies, selection: { faces: [{ body: 0, face: top }], edges: [], bodies: [] } };
  for (const id of ['fillet', 'chamfer']) {
    const cmd = commands.find(c => c.id === id)!;
    assert.ok(cmd.available(ctx).ok, id);
    assert.deepEqual(cmd.steps!(ctx, {}).map(s => s.text), ['4 edges round the picked face']);
    // The arrow stops where the thinnest side runs out (8 mm walls: a chamfer of 8, a fillet just under).
    assert.equal(cmd.handles!(ctx, cmd.defaults!(ctx))[0].max, id === 'fillet' ? 7.5 : 8);
    const out = cmd.build!(ctx, cmd.defaults!(ctx)), last = out.nodes.at(-1) as { edges: string[] };
    assert.deepEqual([...last.edges].sort(), ['n1.side0|n1.top', 'n1.side1|n1.top', 'n1.side2|n1.top', 'n1.side3|n1.top']);
    assert.equal(bodiesOf(out).length, 1);
  }
});

test('Hole handles: a puck slides the centre on the face (new and edited holes), an arrow sizes it', () => {
  const doc = rectanglePart(40, 20, 8), bodies = bodiesOf(doc), top = faceNamed(bodies[0], 'n1.top');
  const ctx: Ctx = { doc, bodies, selection: { faces: [{ body: 0, face: top }], edges: [], bodies: [] } };
  const hole = commands.find(c => c.id === 'hole')!, v = { ...hole.defaults!(ctx), x: 10, y: 6 };
  const [puck, dia] = hole.handles!(ctx, v);
  assert.deepEqual([puck.key, puck.at, puck.dir, puck.pair], ['x', [10, 6, 8], [1, 0, 0], { key: 'y', dir: [0, 1, 0] }]);
  assert.equal(dia.key, 'd');
  // The hole made, its edit's puck sits where it goes in (the top, Z 8) and moves both coordinates.
  const made = hole.build!(ctx, v), edit = editCommand(2, made.nodes)!, mb = bodiesOf(made);
  const mctx: Ctx = { doc: made, bodies: mb, selection: { faces: [], edges: [], bodies: [0] } };
  const [ep] = edit.handles!(mctx, edit.defaults!(mctx));
  assert.deepEqual([ep.key, ep.pair?.key, ep.at.map(x => Math.round(x * 1000) / 1000)], ['c0', 'c1', [10, 6, 8]]);
  const moved = edit.build!(mctx, { ...edit.defaults!(mctx), c0: 30, c1: 12 });
  assert.deepEqual((moved.nodes[2] as { center: number[] }).center, [30, 12]);
});

test('picking a hole’s wall edits that hole (not the body’s last feature); a later move stops it', () => {
  let doc = withNode(rectanglePart(40, 20, 8), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });
  doc = withNode(doc, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [30, 10], radius: 2 });
  const bodies = bodiesOf(doc), mesh = bodies[0].mesh;
  const wall = (n: number) => mesh.faces.findIndex(f => f.kind === 'curved' && f.name.split('+').some(s => s.startsWith(`n${n}.`)));
  const pick = (face: number): Selection => ({ faces: [{ body: 0, face }], edges: [], bodies: [] });
  assert.equal(featureOfPick(pick(wall(2)), bodies, doc.nodes), 2);
  assert.equal(featureOfPick(pick(wall(3)), bodies, doc.nodes), 3);
  assert.equal(featureOfPick(pick(faceNamed(bodies[0], 'n1.top')), bodies, doc.nodes), 1);
  const rim = mesh.edges.findIndex(e => e.names.some(n => n.includes('n2.')));
  assert.equal(featureOfPick({ faces: [], edges: [{ body: 0, edge: rim }], bodies: [] }, bodies, doc.nodes), 2);
  const moved = withNode(doc, { kind: 'translate', parent: { node: 3, side: 'solid' }, offset: [5, 0, 0] }), mb = bodiesOf(moved);
  const w = mb[0].mesh.faces.findIndex(f => f.kind === 'curved' && f.name.split('+').some(s => s.startsWith('n2.')));
  assert.equal(featureOfPick({ faces: [{ body: 0, face: w }], edges: [], bodies: [] }, mb, moved.nodes), null);
});

test('a selection follows re-evaluated bodies by name', () => {
  const doc = rectanglePart(40, 20, 8), a = bodiesOf(doc), b = bodiesOf(withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 1 }));
  const sel: Selection = { faces: [{ body: 0, face: faceNamed(a[0], 'n1.top') }], edges: [], bodies: [0] };
  const out = carrySelection(sel, a, b);
  assert.equal(b[0].mesh.faces[out.faces[0].face].name, a[0].mesh.faces[sel.faces[0].face].name);
  assert.deepEqual(out.bodies, [0]);
  // A body that became another (a hole added to it): its face is found by name on the new one.
  const hole = bodiesOf(withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 }));
  const carried = carrySelection(sel, a, hole);
  assert.equal(hole[0].mesh.faces[carried.faces[0].face].name.split('+')[0], 'n1.top');
  assert.deepEqual(carried.bodies, []);
});

test('deleting a body takes all it was built from; features delete last first', () => {
  let doc = withNode(rectanglePart(40, 20, 8), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [80, 0], radius: 5 });
  doc = withNode(doc, { kind: 'extrude', sketch: 3, height: 10 });
  assert.deepEqual(bodyNodes(doc.nodes, 2), [2, 1, 0]);
  assert.deepEqual(bodyNodes(doc.nodes, 1), [], 'a node something uses is not a body');
  const r = deleteFeatures(doc, bodyNodes(doc.nodes, 2));
  assert.ok(!('error' in r));
  assert.deepEqual(r.doc.nodes.map(n => n.kind), ['sketch', 'extrude']);
  assert.equal((r.doc.nodes[1] as { sketch: number }).sketch, 0);
});

test('placing a primitive stands it at the pointer: centred, a box by its middle', () => {
  const ctx: Ctx = { doc: rectanglePart(1, 1, 1), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const box = commands.find(c => c.id === 'box')!, sphere = commands.find(c => c.id === 'sphere')!;
  const v = box.place!(box.defaults!(ctx), [50, 20, 8]);
  assert.deepEqual([v.x, v.y, v.z], [50 - Number(v.w) / 2, 20 - Number(v.d) / 2, 8]);
  const s = sphere.place!(sphere.defaults!(ctx), [5, 6, 0]);
  assert.deepEqual([s.x, s.y, s.z], [5, 6, 0]);
});
