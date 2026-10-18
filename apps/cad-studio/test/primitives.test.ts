import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode } from '../src/engine/doc';
import { commands, type Ctx, type Values } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';

const ctx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
function make(id: string, values: Record<string, number> = {}) {
  const cmd = commands.find(c => c.id === id)!;
  assert.ok(cmd.available(ctx).ok, id);
  const doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), ...values }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : `${id}: ${r.error.title} ${r.error.hint}`);
  assert.equal(r.bodies.length, 1, id);
  return r.bodies[0];
}
const close = (a: number, b: number, rel = 2e-3) => assert.ok(Math.abs(a - b) <= rel * b, `${a} vs ${b}`);

test('primitive solids: sizes and volumes as asked, standing on At Z at the centre', () => {
  const sphere = make('sphere', { r: 10, x: 5, y: 6, z: 2 });
  close(sphere.volumeMM3!, 4 / 3 * Math.PI * 1000);
  assert.deepEqual(sphere.mesh.bounds.min.map(Math.round), [-5, -4, 2]);
  assert.deepEqual(sphere.mesh.bounds.max.map(Math.round), [15, 16, 22]);
  close(make('cone', { r: 10, rt: 0, h: 20 }).volumeMM3!, Math.PI * 100 * 20 / 3);
  close(make('cone', { r: 10, rt: 4, h: 20 }).volumeMM3!, Math.PI * 20 / 3 * (100 + 40 + 16));
  const torus = make('torus', { R: 20, r: 5, z: 0 });
  close(torus.volumeMM3!, 2 * Math.PI * Math.PI * 20 * 25);
  assert.deepEqual([torus.mesh.bounds.min[2], torus.mesh.bounds.max[2]].map(Math.round), [0, 10]);
  close(make('tube', { r: 10, ri: 6, h: 24 }).volumeMM3!, Math.PI * (100 - 36) * 24);
  const wedge = make('wedge', { w: 32, d: 16, h: 16, x: 0, y: 0, z: 0 });
  close(wedge.volumeMM3!, 32 * 16 / 2 * 16);
  assert.deepEqual([...wedge.mesh.bounds.min, ...wedge.mesh.bounds.max].map(Math.round), [0, 0, 0, 32, 16, 16]);
  const hex = make('prism', { n: 6, s: 16, h: 10, x: 0, y: 0 });
  close(hex.volumeMM3!, 2 * Math.sqrt(3) * 64 * 10);
  assert.deepEqual([hex.mesh.bounds.min[1], hex.mesh.bounds.max[1]].map(v => Math.round(v * 1000) / 1000), [-8, 8]);
  close(make('prism', { n: 12, s: 20, h: 5 }).volumeMM3!, 12 * Math.tan(Math.PI / 12) * 100 * 5);
});

test('primitive sizes that cannot be made say why', () => {
  for (const [id, v] of [['torus', { R: 5, r: 6 }], ['tube', { r: 5, ri: 6 }]] as const) {
    const cmd = commands.find(c => c.id === id)!;
    assert.throws(() => cmd.build!(ctx, { ...cmd.defaults!(ctx), ...v }), /smaller/);
  }
});

test('a placed shape edits as itself later: its command, values, arrows and puck, rebuilt in place', () => {
  const sphere = commands.find(c => c.id === 'sphere')!, doc = sphere.build!(ctx, { ...sphere.defaults!(ctx), r: 10, x: 0, y: 0, z: 0 });
  const edit = editCommand(1, doc.nodes)!, bodies = (evaluateDoc(doc, 1) as { bodies: BodyResult[] }).bodies;
  const ectx: Ctx = { doc, bodies, selection: { faces: [], edges: [], bodies: [0] } };
  assert.equal(edit.label, 'Edit Sphere');
  assert.deepEqual(edit.handles!(ectx, edit.defaults!(ectx)).map(h => h.key), ['x', 'r']);
  const next = edit.build!(ectx, { ...edit.defaults!(ectx), r: 15, x: 30 });
  assert.equal(next.nodes.length, 2);
  assert.deepEqual([(next.nodes[1] as { made: { values: Values } }).made.values.r, (next.nodes[1] as { made: { values: Values } }).made.values.x], [15, 30]);
  close((evaluateDoc(next, 2) as { bodies: BodyResult[] }).bodies[0].volumeMM3!, 4 / 3 * Math.PI * 15 ** 3);
  // Changed by hand since (the revolve's angle): its own fields instead.
  const hand = { ...doc, nodes: [doc.nodes[0], { ...doc.nodes[1], angleDegrees: 180 } as ModelNode] };
  assert.notEqual(editCommand(1, hand.nodes)?.label, 'Edit Sphere');
});

test('Shell has a wall arrow when made and when edited', () => {
  const box = commands.find(c => c.id === 'box')!, doc = box.build!(ctx, { ...box.defaults!(ctx), x: 0, y: 0, z: 0 });
  const b0 = (evaluateDoc(doc, 1) as { bodies: BodyResult[] }).bodies, top = b0[0].mesh.faces.findIndex(f => f.normal[2] > 0.99);
  const shell = commands.find(c => c.id === 'shell')!, sctx: Ctx = { doc, bodies: b0, selection: { faces: [{ body: 0, face: top }], edges: [], bodies: [] } };
  const [h] = shell.handles!(sctx, { t: 2 });
  assert.deepEqual([h.key, h.dir], ['t', [-0, -0, -1]]);
  const shelled = shell.build!(sctx, { t: 2 }), b1 = (evaluateDoc(shelled, 2) as { bodies: BodyResult[] }).bodies;
  const edit = editCommand(2, shelled.nodes)!, ectx: Ctx = { doc: shelled, bodies: b1, selection: { faces: [], edges: [], bodies: [0] } };
  const [eh] = edit.handles!(ectx, edit.defaults!(ectx));
  assert.equal(eh.key, 't');
});

test('a shape placed on a side face stands out of it: turned about where it was placed; arrows and puck turn too', () => {
  const cyl = commands.find(c => c.id === 'cylinder')!, v0 = cyl.defaults!(ctx);
  // On a +X face at x = 20, centred at (y 5, z 4): the bar runs along +X from there.
  const v = cyl.place!({ ...v0, r: 3, h: 10 }, [20, 5, 4], [1, 0, 0]);
  assert.equal(v.up, '+x');
  const doc = cyl.build!(ctx, v), [b] = (evaluateDoc(doc, 1) as { bodies: BodyResult[] }).bodies;
  assert.deepEqual([...b.mesh.bounds.min, ...b.mesh.bounds.max].map(x => Math.round(x * 100) / 100), [20, 2, 1, 30, 8, 7]);
  const hs = cyl.handles!(ctx, v);
  assert.deepEqual(hs.map(h => h.key), ['y', 'r', 'h']);
  assert.deepEqual([hs[0].pair?.key, hs[2].dir], ['z', [1, 0, 0]]);
  // It edits as itself, turned the same way.
  const edit = editCommand(doc.nodes.length - 1, doc.nodes)!;
  assert.equal(edit.label, 'Edit Cylinder');
  const longer = edit.build!({ ...ctx, doc }, { ...edit.defaults!({ ...ctx, doc }), h: 16 });
  assert.equal(Math.round((evaluateDoc(longer, 2) as { bodies: BodyResult[] }).bodies[0].mesh.bounds.max[0]), 36);
  // Under a face (−Z) a box hangs down from it.
  const box = commands.find(c => c.id === 'box')!, bv = box.place!({ ...box.defaults!(ctx), w: 10, d: 10, h: 4 }, [0, 0, 8], [0, 0, -1]);
  const [hb] = (evaluateDoc(box.build!(ctx, bv), 3) as { bodies: BodyResult[] }).bodies;
  assert.deepEqual([hb.mesh.bounds.min[2], hb.mesh.bounds.max[2]].map(Math.round), [4, 8]);
});

test('SubD torus (SD1, D51): a subd node from a regular cage — a smooth ring near the asked radii, curved B-spline faces, editable as values', () => {
  const ring = make('subd-torus', { R: 20, r: 6, nu: 16, nv: 8, x: 0, y: 0, z: 0 });
  // The limit over the cage's vertices sits at the radii (across the tube within 1 − cu of r): near a true torus.
  const exact = 2 * Math.PI * Math.PI * 20 * 36;
  assert.ok(Math.abs(ring.volumeMM3! / exact - 1) < 0.03, `${ring.volumeMM3} vs ${exact}`);
  assert.ok(Math.abs(ring.mesh.bounds.max[2] - 12) < 0.05 && Math.abs(ring.mesh.bounds.min[2]) < 0.05, JSON.stringify(ring.mesh.bounds));
  const cmd = commands.find(c => c.id === 'subd-torus')!, doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), nu: 24, nv: 12 });
  const node = doc.nodes[0] as Extract<ModelNode, { kind: 'subd' }>;
  assert.deepEqual([node.kind, node.cage.faces.length, node.cage.positions.length], ['subd', 288, 864]);
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  assert.ok(r.bodies[0].mesh.faces.every(f => /^n0\.patch\d+$/.test(f.name)), r.bodies[0].mesh.faces.map(f => f.name).join(' '));
  assert.throws(() => cmd.build!(ctx, { ...cmd.defaults!(ctx), R: 5, r: 6 }), /smaller/);
});

test('Spur gear (R6a, issue #2167, D54): a gear node from the command — the volume of the exact profile, faces named per tooth, its report as notes (the schematic root said); edited to more teeth', () => {
  const cmd = commands.find(c => c.id === 'gear')!, doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), m: 2, teeth: 20, b: 10, bore: 8, x: 0, y: 0, z: 0 });
  const node = doc.nodes[0] as Extract<ModelNode, { kind: 'gear' }>;
  assert.deepEqual([node.kind, node.module, node.teeth, node.faceWidth, node.bore, node.generator], ['gear', 2, 20, 10, 8, 'spur-gear@0']);
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.hint);
  const g = r.bodies[0];
  // (The m 2 z 20 profile's exact area, 1226.1057 mm², × 10, less the Ø8 bore.)
  assert.ok(Math.abs(g.volumeMM3! - (12261.057 - Math.PI * 16 * 10)) < 0.05, String(g.volumeMM3));
  // (The display names faces by their base names: 20 tips, 20 left flanks.)
  assert.equal(g.mesh.faces.filter(f => f.name === 'n0.tip').length, 20); assert.equal(g.mesh.faces.filter(f => f.name === 'n0.flankL').length, 20);
  assert.ok(g.notes?.some(n => /Reference Ø40, tip Ø44, root Ø35/.test(n.text)), JSON.stringify(g.notes));
  assert.ok(g.notes?.some(n => n.warning && /Schematic root: not the cutting tool's, not validated for manufacturing/.test(n.text)));
  const more = evaluateDoc({ ...doc, nodes: [{ ...node, teeth: 30 }] }, 2); assert.ok(more.ok);
  assert.ok(more.ok && more.bodies[0].mesh.faces.filter(f => f.name === 'n0.tip').length === 30, 'thirty tips');
  // Refusals in the studio's words, the part unchanged.
  const bad = evaluateDoc({ ...doc, nodes: [{ ...node, teeth: 12 }] }, 3);
  assert.ok(!bad.ok && /x = 0\.298/.test(bad.error.detail + bad.error.hint), JSON.stringify(!bad.ok && bad.error));
});

test('Meshing gear (R6a.4b, D56): beside the selected gear at the centre distance, turned to mesh — the pair\'s verdict in the panel; turning the driver turns it (clear still); a phase off, the teeth cross; the driver cannot go first or be deleted from under it', async () => {
  const { deleteFeature, moveFeature } = await import('../src/chat/features');
  const { editFields } = await import('../src/app/editFields');
  const gear = commands.find(c => c.id === 'gear')!, mesh = commands.find(c => c.id === 'gear-mesh')!;
  const one = gear.build!(ctx, { ...gear.defaults!(ctx), m: 2, teeth: 20, b: 10, bore: 8, x: 5, y: 3, z: 0 }), r1 = evaluateDoc(one, 1);
  assert.ok(r1.ok);
  assert.equal(mesh.available(ctx).ok, false, 'nothing selected');
  const picked: Ctx = { doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } };
  assert.ok(mesh.available(picked).ok); assert.equal(mesh.defaults!(picked).teeth, 40);
  const two = mesh.build!(picked, { ...mesh.defaults!(picked), dir: 90 }), r2 = evaluateDoc(two, 2);
  assert.ok(r2.ok, r2.ok ? '' : r2.error.hint);
  const follower = r2.ok ? r2.bodies.find(b => b.ref?.node === 1)! : null!;
  assert.equal(r2.ok && r2.bodies.length, 2, 'both gears are bodies');
  assert.ok(Math.abs(follower.centroid![0] - 5) < 1e-6 && Math.abs(follower.centroid![1] - 63) < 1e-6, String(follower.centroid));
  assert.ok(follower.notes?.some(n => /^Meshes with n0: centre distance 60 mm, ratio −20:40, backlash 0 mm/.test(n.text)), JSON.stringify(follower.notes));
  assert.ok(follower.notes?.some(n => /^Clear over a full tooth period \(checked in \d+ ms\)/.test(n.text)));
  // The driver turned (its rotation field): the follower follows, still clear.
  const rot = editFields(two.nodes, 0).find(f => f.key === 'rot')! as Extract<ReturnType<typeof editFields>[number], { kind: 'number' }>, turned = { ...two, nodes: rot.set(two.nodes, 7.3) };
  const r3 = evaluateDoc(turned, 3); assert.ok(r3.ok);
  assert.ok(r3.ok && r3.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /^Clear over/.test(n.text)));
  // Half a pitch of phase (4.5° on 40 teeth): the teeth cross, said as a warning.
  const ph = editFields(two.nodes, 1).find(f => f.key === 'ph')! as Extract<ReturnType<typeof editFields>[number], { kind: 'number' }>, off = { ...two, nodes: ph.set(two.nodes, 4.5) };
  assert.deepEqual(editFields(two.nodes, 1).map(f => f.key).filter(k => ['rot', 'dir', 'a', 'ph'].includes(k)), ['dir', 'a', 'ph']);
  assert.equal(editFields(two.nodes, 1).find(f => f.key === 'a')!.get(two.nodes), 60);
  const r4 = evaluateDoc(off, 4); assert.ok(r4.ok);
  assert.ok(r4.ok && r4.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => n.warning && /The teeth cross at .* \(phase 4\.50°\): interference/.test(n.text)));
  // The gear it meshes with: not deleted from under it, not moved after it.
  assert.match((deleteFeature(two, 0) as { error: string }).error, /used by feature 1/);
  assert.ok('error' in moveFeature(two, 1, -1));
  // Suppressed, the driver takes the follower with it.
  const r5 = evaluateDoc({ ...two, nodes: [{ ...two.nodes[0], suppressed: true }, two.nodes[1]] }, 5); assert.ok(r5.ok); assert.equal(r5.ok && r5.bodies.length, 0);
});

test('Profile shift (R6a.5a, D57): a 12-tooth pinion at x 0.6 from the command, its shift in the notes; a 24-tooth gear at x 0.36 meshing with it stands at the working centre distance 56.4999 mm, clear', () => {
  const gear = commands.find(c => c.id === 'gear')!, mesh = commands.find(c => c.id === 'gear-mesh')!;
  const one = gear.build!(ctx, { ...gear.defaults!(ctx), m: 3, teeth: 12, shift: 0.6, b: 10, bore: 0, x: 0, y: 0, z: 0 }), r1 = evaluateDoc(one, 1);
  assert.ok(r1.ok, r1.ok ? '' : r1.error.hint);
  assert.equal((one.nodes[0] as Extract<ModelNode, { kind: 'gear' }>).profileShift, 0.6);
  assert.ok(r1.ok && r1.bodies[0].notes!.some(n => /^Profile shift x 0\.6: Reference Ø36, tip Ø45\.6, root Ø32\.1/.test(n.text)), JSON.stringify(r1.ok && r1.bodies[0].notes));
  const picked: Ctx = { doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } };
  const two = mesh.build!(picked, { ...mesh.defaults!(picked), teeth: 24, shift: 0.36, bore: 10 }), r2 = evaluateDoc(two, 2);
  assert.ok(r2.ok, r2.ok ? '' : r2.error.hint);
  const notes = r2.ok ? r2.bodies.find(b => b.ref?.node === 1)!.notes! : [];
  assert.ok(notes.some(n => /centre distance 56\.4999 mm, ratio −12:24, backlash 0 mm/.test(n.text)) && notes.some(n => /^Clear over a full tooth period/.test(n.text)), JSON.stringify(notes));
});

test('Gear rack (R6a.5b, D58): on its own (the basic rack on a bar, its exact volume); meshing with the selected gear — under it, the verdict in its notes, travelling as the gear turns; a slide off its place crosses; gear queries on the pair', async () => {
  const { editFields } = await import('../src/app/editFields');
  const { runCheck } = await import('../src/chat/spec');
  const rack = commands.find(c => c.id === 'gear-rack')!, gear = commands.find(c => c.id === 'gear')!;
  const alone = rack.build!(ctx, { ...rack.defaults!(ctx), m: 2, teeth: 10, b: 10, h: 10, x: 0, y: 0, z: 0 }), ra = evaluateDoc(alone, 1);
  assert.ok(ra.ok, ra.ok ? '' : ra.error.hint);
  const T = Math.tan(Math.PI / 9), p = 2 * Math.PI, s = p / 2, tooth = ((s - 4 * T) + (s + 5 * T)) / 2 * 4.5;
  close(ra.ok ? ra.bodies[0].volumeMM3! : 0, (10 * p * 7.5 + 10 * tooth) * 10, 1e-9);
  assert.ok(ra.ok && ra.bodies[0].notes!.some(n => /^Length 62\.8319 mm, pitch 6\.2832 mm/.test(n.text)));
  const one = gear.build!(ctx, { ...gear.defaults!(ctx), m: 2, teeth: 20, b: 10, bore: 8, x: 0, y: 0, z: 0 }), r1 = evaluateDoc(one, 2);
  assert.ok(r1.ok);
  const picked: Ctx = { doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } };
  assert.deepEqual(rack.fields!(picked).map(f => f.key), ['teeth', 'h', 'dir']);
  const two = rack.build!(picked, rack.defaults!(picked)), r2 = evaluateDoc(two, 3);
  assert.ok(r2.ok, r2.ok ? '' : r2.error.hint);
  const k = r2.ok ? r2.bodies.find(b => b.ref?.node === 1)! : null!;
  assert.ok(k.notes!.some(n => /^Meshes with n0: pitch line 20 mm from its axis, 125\.6637 mm a turn, backlash 0 mm/.test(n.text)) && k.notes!.some(n => /^Clear over a full tooth period/.test(n.text)), JSON.stringify(k.notes));
  // (Under the gear: its pitch line at y −20, the bar below.)
  assert.ok(k.mesh.bounds.max[1] < -20 + 2 + 1e-9 && k.mesh.bounds.min[1] > -20 - 8 - 1e-9, JSON.stringify(k.mesh.bounds));
  // The gear turned 10°: the rack travels 20 × 10° in radians along +X, still clear.
  const rot = editFields(two.nodes, 0).find(f => f.key === 'rot')! as Extract<ReturnType<typeof editFields>[number], { kind: 'number' }>;
  const r3 = evaluateDoc({ ...two, nodes: rot.set(two.nodes, 10) }, 4); assert.ok(r3.ok);
  const k3 = r3.ok ? r3.bodies.find(b => b.ref?.node === 1)! : null!;
  close(k3.centroid![0] - k.centroid![0], 20 * Math.PI / 18, 1e-6);
  assert.ok(k3.notes!.some(n => /^Clear over/.test(n.text)));
  // Slid 1 mm off its place: the teeth cross.
  const slide = editFields(two.nodes, 1).find(f => f.key === 'ph')! as Extract<ReturnType<typeof editFields>[number], { kind: 'number' }>;
  const r4 = evaluateDoc({ ...two, nodes: slide.set(two.nodes, 1) }, 5); assert.ok(r4.ok);
  assert.ok(r4.ok && r4.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => n.warning && /The teeth cross .* \(slid 1\.000 mm\): interference/.test(n.text)));
  // Gear queries take a gear and a rack.
  const bodies = r2.ok ? r2.bodies : [], ev = async () => r2;
  const cd = await runCheck(two, bodies, ev as never, { op: '==', query: { fn: 'gear_center_distance', a: 'n0', b: 'n1' }, value: 20, tol: 1e-9 });
  assert.equal(cd.status, 'pass', JSON.stringify(cd));
  const cr = await runCheck(two, bodies, ev as never, { op: '>=', query: { fn: 'gear_contact_ratio', a: 'n1', b: 'n0' }, value: 1.7 });
  assert.equal(cr.status, 'pass', JSON.stringify(cr));
});

test('Helical gear (R6a.5c, D59–D60): β 20° right hand from the command — the normal module labelled, its helix in the notes; a meshing gear takes the opposite hand itself, at the transverse centre distance, clear, with the overlap ratio and the thrust; a rack under it of the opposite hand', () => {
  const gear = commands.find(c => c.id === 'gear')!, mesh = commands.find(c => c.id === 'gear-mesh')!, rack = commands.find(c => c.id === 'gear-rack')!;
  const one = gear.build!(ctx, { ...gear.defaults!(ctx), m: 2, teeth: 18, b: 12, helix: 20, hand: 'right', bore: 0, x: 0, y: 0, z: 0 }), r1 = evaluateDoc(one, 1);
  assert.ok(r1.ok, r1.ok ? '' : r1.error.hint);
  assert.deepEqual([(one.nodes[0] as Extract<ModelNode, { kind: 'gear' }>).helixAngle, (one.nodes[0] as Extract<ModelNode, { kind: 'gear' }>).hand], [20, 'right']);
  assert.ok(r1.ok && r1.bodies[0].notes!.some(n => /^Helical β 20° right hand: normal module 2, transverse 2\.1284 mm at α_t 21\.173°/.test(n.text)), JSON.stringify(r1.ok && r1.bodies[0].notes));
  const picked: Ctx = { doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } };
  assert.equal(rack.available(picked).ok, true);
  const two = mesh.build!(picked, { ...mesh.defaults!(picked), teeth: 36, bore: 0 }), r2 = evaluateDoc(two, 2);
  assert.ok(r2.ok, r2.ok ? '' : r2.error.hint);
  const notes = r2.ok ? r2.bodies.find(b => b.ref?.node === 1)!.notes! : [];
  // (a = m_n (z1 + z2) / (2 cos β) = 2 × 54 / (2 cos 20°) = 57.4656; εβ = 12 sin 20° / 2π = 0.653.)
  assert.ok(notes.some(n => /^Helical β 20° left hand/.test(n.text)), JSON.stringify(notes));
  assert.ok(notes.some(n => /centre distance 57\.4656 mm, ratio −18:36, backlash 0 mm, contact ratio [\d.]+ \+ overlap 0\.653 = /.test(n.text)) && notes.some(n => /^Clear over a full tooth period/.test(n.text)), JSON.stringify(notes));
  assert.ok(notes.some(n => /^Axial thrust: n0 \(right-handed\) driving counter-clockwise .* this gear toward −Z/.test(n.text)));
  // A rack under the helical gear: the opposite hand, its teeth inclined, clear.
  const three = rack.build!(picked, rack.defaults!(picked)), r3 = evaluateDoc(three, 3);
  assert.ok(r3.ok, r3.ok ? '' : r3.error.hint);
  const k = r3.ok ? r3.bodies.find(b => b.ref?.node === 1)! : null!;
  assert.equal(k.rack?.spec.hand, 'left');
  assert.ok(k.notes!.some(n => /^Helical rack β 20° left hand/.test(n.text)) && k.notes!.some(n => /^Clear over a full tooth period/.test(n.text)), JSON.stringify(k.notes));
});
