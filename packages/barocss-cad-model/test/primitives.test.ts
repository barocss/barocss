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

test('Spur gear (R6a, issue #2167, D54; R12b.1a, D130): a gear node from the command — the root the rack cuts (spur-gear@1), the volume of the exact generated profile, faces named per tooth, its report as notes; edited to more teeth; the schematic root by the Root field; an undercut pinion', async () => {
  const { editFields } = await import('../src/app/editFields');
  const cmd = commands.find(c => c.id === 'gear')!, doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), m: 2, teeth: 20, b: 10, bore: 8, x: 0, y: 0, z: 0 });
  const node = doc.nodes[0] as Extract<ModelNode, { kind: 'gear' }>;
  assert.deepEqual([node.kind, node.module, node.teeth, node.faceWidth, node.bore, node.generator], ['gear', 2, 20, 10, 8, 'spur-gear@1']);
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.hint);
  const g = r.bodies[0];
  // (The m 2 z 20 generated profile's exact area, 1237.1969 mm² — by the kernel test's own envelope and involute,
  // test/gear-generated-root.test.mjs — × 10, less the Ø8 bore; within what the measured fits allow, 40 flanks and
  // fillets each moved by at most its deviation (1.4e-4 and 1.5e-4 mm) over its length (2.5m, 3m) × 10: 0.32 mm³.)
  assert.ok(Math.abs(g.volumeMM3! - (12371.969 - Math.PI * 16 * 10)) < 0.32, String(g.volumeMM3));
  // (The display names faces by their base names: 20 tips, 20 left flanks, the fillets.)
  assert.equal(g.mesh.faces.filter(f => f.name === 'n0.tip').length, 20); assert.equal(g.mesh.faces.filter(f => f.name === 'n0.flankL').length, 20);
  assert.ok(g.mesh.faces.some(f => f.name === 'n0.filletL') && !g.mesh.faces.some(f => f.name === 'n0.rootL'));
  assert.ok(g.notes?.some(n => /Reference Ø40, tip Ø44, root Ø35/.test(n.text)), JSON.stringify(g.notes));
  assert.ok(g.notes?.some(n => /Root cut by the basic rack \(tip radius 0\.76 mm\): the involute from Ø37\.6401 \(the form circle\)/.test(n.text)), JSON.stringify(g.notes));
  assert.ok(!g.notes?.some(n => /Schematic root/.test(n.text)));
  const more = evaluateDoc({ ...doc, nodes: [{ ...node, teeth: 30 }] }, 2); assert.ok(more.ok);
  assert.ok(more.ok && more.bodies[0].mesh.faces.filter(f => f.name === 'n0.tip').length === 30, 'thirty tips');
  // The Root field: the schematic root (spur-gear@0) as R6a made it — its volume and its warning.
  const fields = editFields(doc.nodes, 0), root = fields.find(f => f.key === 'root')!, rho = fields.find(f => f.key === 'rho')!;
  assert.ok(root && rho && root.kind === 'choice' && rho.kind === 'number');
  assert.equal(rho.kind === 'number' && rho.get(doc.nodes), 0.76);
  const schematic = root.kind === 'choice' ? root.set(doc.nodes, 'spur-gear@0') : doc.nodes, s = evaluateDoc({ ...doc, nodes: schematic }, 4);
  assert.ok(s.ok && Math.abs(s.bodies[0].volumeMM3! - (12261.057 - Math.PI * 16 * 10)) < 0.05);
  assert.ok(s.ok && s.bodies[0].notes?.some(n => n.warning && /Schematic root: not the cutting tool's, not validated for manufacturing/.test(n.text)));
  // An undercut pinion (12 teeth): built as the rack cuts it, said so; the schematic root refuses it, naming the shift.
  const twelve = evaluateDoc({ ...doc, nodes: [{ ...node, teeth: 12 }] }, 3);
  assert.ok(twelve.ok && twelve.bodies[0].notes?.some(n => n.warning && /undercut: the tool's tip cuts the involute away below Ø22\.6054/.test(n.text)), JSON.stringify(twelve.ok && twelve.bodies[0].notes));
  const bad = evaluateDoc({ ...doc, nodes: [{ ...node, teeth: 12, generator: 'spur-gear@0' }] }, 3);
  assert.ok(!bad.ok && /x = 0\.298/.test(bad.error.detail + bad.error.hint), JSON.stringify(!bad.ok && bad.error));
  // A helix on it (R12b.1b, D131): still the rack's root, cut by the transverse tool's ellipse.
  const helix = fields.find(f => f.key === 'helix')!, turned = helix.kind === 'number' ? helix.set(doc.nodes, 15) : doc.nodes, ht = evaluateDoc({ ...doc, nodes: turned }, 5);
  assert.equal((turned[0] as typeof node).generator, 'spur-gear@1');
  assert.ok(ht.ok && ht.bodies[0].notes?.some(n => /^Root cut by the basic rack/.test(n.text)) && ht.bodies[0].notes?.some(n => /^Helical β 15°/.test(n.text)), JSON.stringify(ht.ok && ht.bodies[0].notes));
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

test('Internal gear (R12b.2a, D132): a ring from the command (x2 0.5 by default) — its volume, its notes; a pinion inside it by Meshing gear with the ring selected — at the internal pair\'s distance, ratio +24:60, clear, radial assembly clear; its Centre distance field; the ring cannot go from under it', async () => {
  const { editFields } = await import('../src/app/editFields');
  const { deleteFeature } = await import('../src/chat/features');
  const cmd = commands.find(c => c.id === 'internal-gear')!, mesh = commands.find(c => c.id === 'gear-mesh')!;
  const one = cmd.build!(ctx, { ...cmd.defaults!(ctx), x: 0, y: 0, z: 0 }), r1 = evaluateDoc(one, 1);
  assert.ok(r1.ok, r1.ok ? '' : r1.error.hint);
  const node = one.nodes[0] as Extract<ModelNode, { kind: 'internal-gear' }>;
  assert.deepEqual([node.kind, node.module, node.teeth, node.faceWidth, node.rim, node.profileShift, node.generator, node.shiftDefault, node.cutter], ['internal-gear', 2, 60, 10, 140, 0.5, 'internal-gear@1', true, { teeth: 24 }]);
  const g = r1.ok ? r1.bodies[0] : null!;
  // (R12b.2b, D133: cut by a 24-tooth pinion-type cutter. The m 2 z 60 ring at x2 0.5 in Ø140 × 10: πR² less its 60
  // spaces — the involute, the cutter round's envelope, the root a_c + ra0 — by the kernel test's own construction,
  // test/gear-internal-shaper.test.mjs: 36927.4805 mm³, within what the flank and fillet fits allow, 1.04 mm³.)
  assert.ok(Math.abs(g.volumeMM3! - 36927.4805) < 1.04, String(g.volumeMM3));
  // (The default shift said as one: not a standard, D132.)
  assert.ok(g.notes?.some(n => /^Profile shift 0\.5 \(default: clears rack-cut pinions; see D132\): Internal: reference Ø120, tip Ø118 \(inside\), root Ø126\.837, base Ø112\.7631, rim Ø140 mm/.test(n.text)) && g.notes?.some(n => /^Root cut by a 24-tooth pinion-type cutter, tip radius 0\.5895 mm, at 36\.9185 mm/.test(n.text)) && g.notes?.some(n => n.warning && /estimate for a pinion-type cutter/.test(n.text)), JSON.stringify(g.notes));
  // The Root field to Schematic: the R12b.2a ring, its volume (3684.5980 mm² × 10 by the kernel test's own outline) and warning.
  const rf = editFields(one.nodes, 0).find(f => f.key === 'root')!, sch = rf.kind === 'choice' ? rf.set(one.nodes, 'internal-gear@0') : one.nodes, rs = evaluateDoc({ ...one, nodes: sch }, 8);
  assert.equal((sch[0] as typeof node).cutter, undefined);
  assert.ok(rs.ok && Math.abs(rs.bodies[0].volumeMM3! - 36845.980) < 0.6 && rs.bodies[0].notes?.some(n => n.warning && /Schematic root/.test(n.text)));
  assert.equal(g.mesh.faces.filter(f => f.name === 'n0.tip').length, 60);
  // A shift given in the editor is the user's own: the default's flag goes, the note says it plainly.
  const sf = editFields(one.nodes, 0).find(f => f.key === 'shift')!, own = sf.kind === 'number' ? sf.set(one.nodes, 0.3) : one.nodes, ro = evaluateDoc({ ...one, nodes: own }, 7);
  assert.equal((own[0] as typeof node).shiftDefault, undefined);
  assert.ok(ro.ok && ro.bodies[0].notes?.some(n => /^Profile shift x 0\.3: Internal:/.test(n.text)) && !ro.bodies[0].notes?.some(n => /default: clears/.test(n.text)));
  // A pinion inside it.
  assert.equal(mesh.available(ctx).ok, false);
  const picked: Ctx = { doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } };
  assert.ok(mesh.available(picked).ok); assert.equal(mesh.defaults!(picked).teeth, 24);
  const two = mesh.build!(picked, mesh.defaults!(picked)), r2 = evaluateDoc(two, 2);
  assert.ok(r2.ok, r2.ok ? '' : r2.error.hint);
  const p = two.nodes[1] as Extract<ModelNode, { kind: 'gear' }>;
  assert.deepEqual([p.teeth, p.mesh?.gear, p.generator], [24, 0, 'spur-gear@1']);
  const k = r2.ok ? r2.bodies.find(b => b.ref?.node === 1)! : null!;
  // (The working distance by K1's form: inv α_w = 2 tan α · 0.5 / 36 + inv α — 36.9185 mm.)
  assert.ok(k.notes!.some(n => /^Meshes inside n0: centre distance 36\.9185 mm, ratio \+24:60 \(the same way\), backlash 0 mm/.test(n.text)) && k.notes!.some(n => /^Clear over a full tooth period/.test(n.text)) && k.notes!.some(n => /^Radial assembly clear/.test(n.text)), JSON.stringify(k.notes));
  assert.equal(r2.ok && r2.bodies.length, 2);
  const a = editFields(two.nodes, 1).find(f => f.key === 'a')!;
  assert.ok(a.kind === 'number' && Math.abs(Number(a.get(two.nodes)) - 36.91848518) < 1e-6);
  // A ring of 40 with a 36-tooth pinion: its tip circle does not fit inside — radial assembly impossible, said; the teeth cross.
  const tight = { ...two, nodes: [{ ...node, teeth: 40, rim: 100, profileShift: 0, generator: 'internal-gear@0' as const, cutter: undefined }, { ...p, teeth: 36 }] }, r3 = evaluateDoc(tight, 3);
  assert.ok(r3.ok && r3.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => n.warning && /Radial assembly impossible/.test(n.text)));
  // The ring is used by the pinion: it cannot be deleted from under it.
  assert.match((deleteFeature(two, 0) as { error: string }).error, /used by feature 1/);
  // A helical ring: its pinion takes the same hand.
  // (A helical ring's root is schematic in this stage: internal-gear@0.)
  const hr = { ...two, nodes: [{ ...node, helixAngle: 15, hand: 'right' as const, generator: 'internal-gear@0' as const, cutter: undefined }, p] }, r4 = evaluateDoc(hr, 4);
  assert.ok(r4.ok, r4.ok ? '' : r4.error.hint);
  assert.ok(r4.ok && r4.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /^Helical β 15° right hand/.test(n.text)) && r4.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /^Clear over/.test(n.text)), JSON.stringify(r4.ok && r4.bodies.find(b => b.ref?.node === 1)!.notes));
});

test('Bevel gear (R12b.3, D134): a straight bevel pinion from the command (m 2, z 20 for 40, Σ 90°, its toe on At Z) — its volume, its notes; its mate by Meshing gear with it selected — the same apex, ratio 20:40, clear; the mate follows the pinion\'s teeth; a phase off crosses; the pinion cannot go from under it', async () => {
  const { editFields } = await import('../src/app/editFields');
  const { deleteFeature } = await import('../src/chat/features');
  const cmd = commands.find(c => c.id === 'bevel-gear')!, mesh = commands.find(c => c.id === 'gear-mesh')!;
  const one = cmd.build!(ctx, { ...cmd.defaults!(ctx), x: 0, y: 0, z: 0 }), r1 = evaluateDoc(one, 1);
  assert.ok(r1.ok, r1.ok ? '' : r1.error.hint);
  const node = one.nodes[0] as Extract<ModelNode, { kind: 'bevel-gear' }>;
  assert.deepEqual([node.kind, node.module, node.teeth, node.mateTeeth, node.shaftAngle, node.faceWidth, node.bore, node.generator], ['bevel-gear', 2, 20, 40, undefined, 10, 8, 'bevel-gear@0']);
  // (Its apex below At Z by the toe's lowest point: (R − b) cos(δ + θa), R = 20/sin δ, tan δ = 1/2, θa = atan(2/R).)
  const R = 20 / Math.sin(Math.atan(0.5)), low = (R - 10) * Math.cos(Math.atan(0.5) + Math.atan(2 / R));
  assert.ok(Math.abs(node.from! + low) < 1e-9, String(node.from));
  const g = r1.ok ? r1.bodies[0] : null!;
  assert.ok(Math.abs(g.mesh.bounds.min[2]) < 1e-6, String(g.mesh.bounds.min[2]));
  // (The volume by the kernel test's own construction, test/gear-bevel.test.mjs: (R³ − (R − b)³)/3 × the section's area on
  // the unit sphere, less the Ø8 bore between the spheres — 9785.1487 mm³; the flanks' fit allows about 0.02.)
  assert.ok(Math.abs(g.volumeMM3! - 9785.1487) < 0.02, String(g.volumeMM3));
  assert.ok(g.notes?.some(n => /^Straight bevel, spherical involute: reference Ø40 at the heel, pitch cone 26\.5651° \(shaft angle 90°\), cone distance 44\.7214 mm \(toe 34\.7214\)/.test(n.text))
    && g.notes?.some(n => /^Tredgold's virtual spur gear: 22\.36 teeth \(an estimate/.test(n.text)) && g.notes?.some(n => n.warning && /Schematic root/.test(n.text)), JSON.stringify(g.notes));
  assert.equal(g.mesh.faces.filter(f => f.name === 'n0.tip').length, 20);
  assert.ok(g.mesh.faces.some(f => f.name === 'n0.heel') && g.mesh.faces.some(f => f.name === 'n0.toe'));
  // Its mate.
  const picked: Ctx = { doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } };
  assert.ok(mesh.available(picked).ok); assert.deepEqual(mesh.fields!(picked).map(f => f.key), ['dir', 'bore']);
  const two = mesh.build!(picked, mesh.defaults!(picked)), r2 = evaluateDoc(two, 2);
  assert.ok(r2.ok, r2.ok ? '' : r2.error.hint);
  const w = two.nodes[1] as Extract<ModelNode, { kind: 'bevel-gear' }>;
  assert.deepEqual([w.teeth, w.mateTeeth, w.mesh?.gear], [40, 20, 0]);
  const k = r2.ok ? r2.bodies.find(b => b.ref?.node === 1)! : null!;
  assert.ok(k.notes!.some(n => /^Meshes with n0: the same apex, shaft angle 90°, ratio 20:40, backlash 0 mm at the heel, contact ratio 1\.714 \(spherical; Tredgold's estimate 1\.712\)/.test(n.text)) && k.notes!.some(n => /^Clear over a full tooth period on the heel sphere/.test(n.text)), JSON.stringify(k.notes));
  // (54305.1392 mm³ by the same construction for the z 40 gear with its Ø8 bore.)
  assert.ok(Math.abs(k.volumeMM3! - 54305.1392) < 0.05, String(k.volumeMM3));
  assert.deepEqual(editFields(two.nodes, 1).map(f => f.key), ['b', 'bore', 'ds', 'dir', 'ph']);
  // The pinion's teeth edited: the mate follows (40 for 18), clear still.
  const zf = editFields(two.nodes, 0).find(f => f.key === 'z')!, z18 = zf.kind === 'number' ? zf.set(two.nodes, 18) : two.nodes, r3 = evaluateDoc({ ...two, nodes: z18 }, 3);
  assert.ok(r3.ok && r3.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /ratio 18:40/.test(n.text)) && r3.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /^Clear over/.test(n.text)), r3.ok ? JSON.stringify(r3.bodies.find(b => b.ref?.node === 1)!.notes) : r3.error.hint);
  // A phase off: the teeth cross, said.
  const off = { ...two, nodes: [two.nodes[0], { ...w, mesh: { ...w.mesh!, phase: 3 } }] }, r4 = evaluateDoc(off, 4);
  assert.ok(r4.ok && r4.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => n.warning && /The teeth cross/.test(n.text)));
  assert.match((deleteFeature(two, 0) as { error: string }).error, /used by feature 1/);
});

test('Spiral bevel gear (R12b.4, D135): an ideal model, said so — K1\'s spiral pinion from the command (m 3, z 20 for 40, β_m 35° left, r_c 60): its label, the ideal-model warning first in its notes, ideal_model in the agent\'s body list; its volume; its mate by Meshing gear — the other hand, five spheres clear, the face contact ratio, the thrust; the cutter radius left 0 an estimate', async () => {
  const { describeBodies } = await import('../src/chat/tools');
  const { featureLabel } = await import('../src/engine/doc');
  const cmd = commands.find(c => c.id === 'bevel-gear')!, mesh = commands.find(c => c.id === 'gear-mesh')!;
  const one = cmd.build!(ctx, { ...cmd.defaults!(ctx), m: 3, teeth: 20, mate: 40, b: 20, bore: 10, spiral: 35, hand: 'left', rc: 60, x: 0, y: 0, z: 0 }), r1 = evaluateDoc(one, 1);
  assert.ok(r1.ok, r1.ok ? '' : r1.error.hint);
  const node = one.nodes[0] as Extract<ModelNode, { kind: 'bevel-gear' }>;
  assert.deepEqual(node.spiral, { angle: 35, hand: 'left', cutterRadius: 60 });
  assert.equal(featureLabel(node, 0, one.nodes), 'Spiral bevel gear m3 z20/40 (ideal model)');
  const g = r1.ok ? r1.bodies[0] : null!;
  // (41367.3882 mm³ by the kernel test's construction, test/gear-bevel-spiral.test.mjs: the α_t section's area — a turn keeps it on every sphere.)
  assert.ok(Math.abs(g.volumeMM3! - 41367.3882) < 0.05, String(g.volumeMM3));
  assert.ok(g.notes![0].warning && /^Ideal model: a spiral bevel gear in line contact — the conjugate of its mate on every sphere about the apex, not a face-milled or face-hobbed tooth \(no crowning, no machine settings\)/.test(g.notes![0].text), JSON.stringify(g.notes));
  assert.ok(g.notes!.some(n => /^Spiral β_m 35° left hand on a 60 mm cutter radius: β 30\.7328° at the toe to 39\.9648° at the heel; transverse α_t 23\.9568°/.test(n.text)) && g.notes!.some(n => /^Spiral bevel, spherical involute/.test(n.text)), JSON.stringify(g.notes));
  assert.match(g.idealModel!, /ideal spiral bevel gear \(line contact\)/);
  const listed = describeBodies(one, r1.ok ? r1.bodies : [], false)[0];
  assert.equal(listed.made_by, '0: Spiral bevel gear m3 z20/40 (ideal model)'); assert.match(String(listed.ideal_model), /not a face-milled or face-hobbed tooth/);
  // Its mate: the other hand, from the driver.
  const picked: Ctx = { doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } };
  const two = mesh.build!(picked, { ...mesh.defaults!(picked), bore: 20 }), r2 = evaluateDoc(two, 2);
  assert.ok(r2.ok, r2.ok ? '' : r2.error.hint);
  assert.equal(featureLabel(two.nodes[1], 1, two.nodes), 'Spiral bevel gear m3 z40/20 (ideal model)');
  const k = r2.ok ? r2.bodies.find(b => b.ref?.node === 1)! : null!;
  assert.ok(k.notes!.some(n => /^Spiral β_m 35° right hand on a 60 mm cutter radius/.test(n.text)) && k.notes!.some(n => /contact ratio 1\.544 \(spherical; Tredgold's estimate 1\.543\) \+ face 1\.760 = 3\.304/.test(n.text))
    && k.notes!.some(n => /^Clear over a full tooth period on 5 spheres from the toe to the heel/.test(n.text)) && k.notes!.some(n => /^Axial thrust: n0 driving clockwise seen from its apex is pushed toward its apex, this gear away from its own/.test(n.text)), JSON.stringify(k.notes));
  // (221439.7348 mm³ by the same construction for the z 40 gear with its Ø20 bore.)
  assert.ok(Math.abs(k.volumeMM3! - 221439.7348) < 0.2, String(k.volumeMM3));
  // The cutter radius left 0: the mean cone distance, an estimate — said so.
  const est = cmd.build!(ctx, { ...cmd.defaults!(ctx), m: 3, teeth: 20, mate: 40, b: 20, bore: 10, spiral: 35, hand: 'left', rc: 0, x: 0, y: 0, z: 0 }), r3 = evaluateDoc(est, 3);
  assert.deepEqual((est.nodes[0] as typeof node).spiral, { angle: 35, hand: 'left', cutterRadius: 57.082, cutterEstimate: true });
  assert.ok(r3.ok && r3.bodies[0].notes!.some(n => n.warning && /on a 57\.082 mm cutter radius \(an estimate: the mean cone distance; give the shop's\)/.test(n.text)));
});

test('Worm gear pair (R12b.5, D136): K1\'s pair from the command (m_x 3, double thread, d1 44, z2 30) — the wheel a helical gear at the lead angle, the worm meshing with it and long enough for the mesh zone; its volume, its notes, the pair clear; the worm follows the wheel\'s teeth and its form; the wheel cannot go from under it', async () => {
  const { editFields } = await import('../src/app/editFields');
  const { deleteFeature } = await import('../src/chat/features');
  const { featureLabel } = await import('../src/engine/doc');
  const cmd = commands.find(c => c.id === 'worm-pair')!;
  const doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), x: 0, y: 0, z: 0 }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : r.error.hint);
  const wheel = doc.nodes[0] as Extract<ModelNode, { kind: 'gear' }>, worm = doc.nodes[1] as Extract<ModelNode, { kind: 'worm' }>;
  // (γ = atan(2·3/44); the wheel's normal module 3 cos γ; the worm 2 × 23.181 mm of mesh zone and an axial pitch on either side: 66 mm.)
  assert.ok(Math.abs(wheel.helixAngle! - 7.765166018425334) < 1e-12 && Math.abs(Number(wheel.module) - 3 * Math.cos(Math.atan(6 / 44))) < 1e-12 && wheel.hand === 'right' && wheel.teeth === 30, JSON.stringify(wheel));
  assert.deepEqual([worm.starts, worm.form, worm.length, worm.bore, worm.mesh.gear], [2, 'ZI', 66, 12, 0]);
  assert.equal(featureLabel(worm, 1, doc.nodes), 'Worm ZI m_x3 ×2 Ø44');
  const w = r.ok ? r.bodies.find(b => b.ref?.node === 1)! : null!;
  // (The worm's volume by the kernel test's construction, test/gear-worm.test.mjs: (π rf² + 2 ∫ 2ψ r dr − π 6²) × 66 = 92741.95 mm³, within its fits.)
  assert.ok(Math.abs(w.volumeMM3! - 92741.95) < 0.6, String(w.volumeMM3));
  assert.ok(w.notes!.some(n => /^Worm ZI \(involute helicoid\): reference Ø44, tip Ø50, root Ø36\.5 \(q 14\.6667\); lead angle γ 7\.7652°, lead 18\.8496 mm/.test(n.text))
    && w.notes!.some(n => /^Meshes with n0: crossed at 90°, centre distance 67 mm, ratio 30:2 \(15:1\), backlash 0 mm along the worm's axis, mid-plane contact ratio 1\.800/.test(n.text)) && w.notes!.some(n => /^Clear over an axial pitch in the wheel's mid-plane and ±6\.6667 mm/.test(n.text)), JSON.stringify(w.notes));
  // The wheel's teeth to 40: the worm follows (ratio 40:2, 87 mm apart), clear; the worm's form to ZA, clear.
  const zf = editFields(doc.nodes, 0).find(f => f.key === 'z')!, z40 = zf.kind === 'number' ? zf.set(doc.nodes, 40) : doc.nodes, r2 = evaluateDoc({ ...doc, nodes: z40 }, 2);
  assert.ok(r2.ok && r2.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /centre distance 82 mm, ratio 40:2 \(20:1\)/.test(n.text)) && r2.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /^Clear over/.test(n.text)), r2.ok ? JSON.stringify(r2.bodies.find(b => b.ref?.node === 1)!.notes) : r2.error.hint);
  const ff = editFields(doc.nodes, 1).find(f => f.key === 'form')!, za = ff.kind === 'choice' ? ff.set(doc.nodes, 'ZA') : doc.nodes, r3 = evaluateDoc({ ...doc, nodes: za }, 3);
  assert.ok(r3.ok && r3.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /^Worm ZA \(straight axial sides\)/.test(n.text)) && r3.bodies.find(b => b.ref?.node === 1)!.notes!.some(n => /^Clear over/.test(n.text)), r3.ok ? JSON.stringify(r3.bodies.find(b => b.ref?.node === 1)!.notes) : r3.error.hint);
  assert.match((deleteFeature(doc, 0) as { error: string }).error, /used by feature 1/);
});

test('Throated worm wheel (R12b.6, D137): K1\'s pair from the Worm gear pair command with a throated wheel — the wheel cut by a hob of its ZA worm, the worm meshing with it; the wheel\'s volume and notes, the pair in contact along lines', async () => {
  const { featureLabel } = await import('../src/engine/doc');
  const cmd = commands.find(c => c.id === 'worm-pair')!;
  const doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), wheel: 'throated', x: 0, y: 0, z: 0 }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : r.error.hint);
  const wheel = doc.nodes[0] as Extract<ModelNode, { kind: 'worm-wheel' }>, worm = doc.nodes[1] as Extract<ModelNode, { kind: 'worm' }>;
  assert.deepEqual([wheel.kind, wheel.module, wheel.starts, wheel.diameter, wheel.hand, wheel.teeth, wheel.faceWidth, worm.form, worm.mesh.gear], ['worm-wheel', 3, 2, 44, 'right', 30, 20, 'ZA', 0]);
  assert.equal(featureLabel(wheel, 0, doc.nodes), 'Throated worm wheel m_x3 z30'); assert.equal(featureLabel(worm, 1, doc.nodes), 'Worm ZA m_x3 ×2 Ø44');
  const g = r.ok ? r.bodies.find(b => b.ref?.node === 0)! : null!, w = r.ok ? r.bodies.find(b => b.ref?.node === 1)! : null!;
  // (123789.333 mm³ by the kernel test's construction, test/gear-worm-wheel.test.mjs: its sections' areas integrated along the face, less the Ø20 bore.)
  assert.ok(Math.abs(g.volumeMM3! - 123789.333) < 0.3, String(g.volumeMM3));
  assert.ok(g.notes!.some(n => /^Throated worm wheel, cut by a hob of its ZA worm's thread: reference Ø90, throat Ø96 \(its surface radius 19\), root Ø82\.5, centre distance 67 mm/.test(n.text)), JSON.stringify(g.notes));
  assert.ok(w.notes!.some(n => /^Meshes with n0, enveloping it: crossed at 90°, centre distance 67 mm, ratio 30:2 \(15:1\)/.test(n.text)) && w.notes!.some(n => /^In contact along lines across the face/.test(n.text)), JSON.stringify(w.notes));
});

test('Gear rack (R6a.5b, D58): on its own (the basic rack on a bar, its exact volume); meshing with the selected gear — under it, the verdict in its notes, travelling as the gear turns; a slide off its place crosses; gear queries on the pair', async () => {
  const { editFields } = await import('../src/app/editFields');
  const { runCheck } = await import('../src/chat/spec');
  const rack = commands.find(c => c.id === 'gear-rack')!, gear = commands.find(c => c.id === 'gear')!;
  const alone = rack.build!(ctx, { ...rack.defaults!(ctx), m: 2, teeth: 10, b: 10, h: 10, x: 0, y: 0, z: 0 }), ra = evaluateDoc(alone, 1);
  assert.ok(ra.ok, ra.ok ? '' : ra.error.hint);
  const T = Math.tan(Math.PI / 9), p = 2 * Math.PI, s = p / 2, tooth = ((s - 4 * T) + (s + 5 * T)) / 2 * 4.5;
  // (R12b.1b, D131: the command's rack has the basic rack's root fillets, 0.76 mm — twenty corners, each the region
  // between the root line, the flank and the arc, ρ²(cot(45° + α/2) − (π/2 − α)/2).)
  const corner = 0.76 ** 2 * (1 / Math.tan(Math.PI / 4 + Math.PI / 18) - (Math.PI / 2 - Math.PI / 9) / 2);
  assert.equal((alone.nodes[0] as Extract<ModelNode, { kind: 'rack' }>).generator, 'spur-rack@1');
  close(ra.ok ? ra.bodies[0].volumeMM3! : 0, (10 * p * 7.5 + 10 * tooth + 20 * corner) * 10, 1e-9);
  assert.ok(ra.ok && ra.bodies[0].notes!.some(n => /^Length 62\.8319 mm, pitch 6\.2832 mm/.test(n.text)));
  assert.ok(ra.ok && ra.bodies[0].notes!.some(n => /^Root fillets 0\.76 mm \(the basic rack's\): the straight flank ends 1\.9999 mm below the pitch line/.test(n.text)) && !ra.bodies[0].notes!.some(n => /Schematic root/.test(n.text)));
  // The Root field to Schematic (spur-rack@0): R6a's corners, its volume to 1e-9 as before, its warning.
  const rootField = editFields(alone.nodes, 0).find(f => f.key === 'root')!, sharp = rootField.kind === 'choice' ? rootField.set(alone.nodes, 'spur-rack@0') : alone.nodes, rs = evaluateDoc({ ...alone, nodes: sharp }, 6);
  close(rs.ok ? rs.bodies[0].volumeMM3! : 0, (10 * p * 7.5 + 10 * tooth) * 10, 1e-9);
  assert.ok(rs.ok && rs.bodies[0].notes!.some(n => n.warning && /Schematic root/.test(n.text)));
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

test('SubD box (SD2, D78): a box cage, its eight corners extraordinary — one body of G1 caps and exact patches inside the box, rounder with fewer quads; editable as values', () => {
  const box = make('subd-box', { w: 30, d: 20, h: 16, n: 3, x: 0, y: 0, z: 0 });
  const v3 = box.volumeMM3!;
  assert.ok(v3 < 30 * 20 * 16 && v3 > 0.6 * 30 * 20 * 16, String(v3));
  const b = box.mesh.bounds;
  // (Inside its box, touching its sides: a flat cage face's middle has a flat limit.)
  assert.ok([0, 1, 2].every(k => b.min[k] >= [-15, -10, 0][k] - 1e-9 && b.max[k] <= [15, 10, 16][k] + 1e-9), JSON.stringify(b));
  assert.ok(box.mesh.faces.some(f => /^n0\.cap/.test(f.name)) && box.mesh.faces.some(f => /^n0\.patch/.test(f.name)), box.mesh.faces.map(f => f.name).slice(0, 6).join(' '));
  // More quads along a side: closer to the box.
  assert.ok(make('subd-box', { w: 30, d: 20, h: 16, n: 6, x: 0, y: 0, z: 0 }).volumeMM3! > v3);
  assert.ok(make('subd-box', { w: 30, d: 20, h: 16, n: 1, x: 0, y: 0, z: 0 }).volumeMM3! < v3);
  const cmd = commands.find(c => c.id === 'subd-box')!, node = cmd.build!(ctx, { ...cmd.defaults!(ctx), n: 2 }).nodes[0] as Extract<ModelNode, { kind: 'subd' }>;
  assert.deepEqual([node.cage.faces.length, node.cage.positions.length / 3], [24, 26]);
});

test('SubD tube (D84): a thick-walled tube open at both ends from a regular cage — exact B-spline faces only, a solid ring of genus 1 between the asked radii and length, its first column centred on +X; refused inside out', async () => {
  const { checkBrep, subdBrep } = await import('@barocss/cad');
  const tube = make('subd-tube', { r: 20, ri: 17, h: 40, nu: 24, nh: 7, x: 0, y: 0, z: 0 }), full = Math.PI * (20 * 20 - 17 * 17) * 40;
  // (Its rims round without holding loops: some of the wall's volume lost there.)
  assert.ok(tube.volumeMM3! < full && tube.volumeMM3! > 0.85 * full, `${tube.volumeMM3} vs ${full}`);
  const b = tube.mesh.bounds;
  assert.ok(b.max[0] <= 20 + 1e-6 && b.max[0] > 19.5 && b.min[2] >= -1e-9 && b.max[2] <= 40 + 1e-9, JSON.stringify(b));
  assert.ok(tube.mesh.faces.every(f => /^n0\.patch\d+$/.test(f.name)), 'regular everywhere: no caps');
  const cmd = commands.find(c => c.id === 'subd-tube')!, node = cmd.build!(ctx, { ...cmd.defaults!(ctx), x: 0, y: 0 }).nodes[0] as Extract<ModelNode, { kind: 'subd' }>;
  assert.deepEqual([node.cage.faces.length, node.cage.positions.length / 3], [24 * 16, 24 * 16]);
  // Column 0 (faces 0–15) is centred on +X: its outer faces' normals point along X.
  const P = node.cage.positions, f0 = node.cage.faces[3], ys = f0.map(v => P[3 * v + 1]);
  assert.ok(Math.abs(ys[0] + ys[1]) < 1e-9 && f0.every(v => P[3 * v] > 19), JSON.stringify(f0.map(v => [P[3 * v], P[3 * v + 1]])));
  assert.deepEqual(checkBrep(subdBrep(node.cage)).topology.map(t => [t.shells, t.genus]), [[1, 1]]);
  assert.throws(() => cmd.build!(ctx, { ...cmd.defaults!(ctx), r: 10, ri: 12 }), /smaller/);
});

test('SubD caps shown (D79): the box\'s notes give the caps and their deviation from the limit as a share of its size; a half star round a boundary vertex warns past 0.2%; the subd_deviation query reads the same figure, unknown for a cage regular everywhere', async () => {
  const { runCheck } = await import('../src/chat/spec');
  const { withNode } = await import('../src/engine/doc');
  const box = make('subd-box', { w: 30, d: 20, h: 16, n: 3, x: 0, y: 0, z: 0 });
  assert.equal(box.notes?.length, 1, JSON.stringify(box.notes));
  assert.match(box.notes![0].text, /^Caps: G1 at 8 irregular vertices \(24 caps, 1 Catmull–Clark step\); max deviation from the limit surface [\d.]+ mm \([\d.]+% of its size\)$/);
  assert.ok(box.subd && box.subd.maxDeviationMM > 0 && box.subd.maxDeviationMM < 0.01 && box.subd.creaseDeviationMM === 0, JSON.stringify(box.subd));
  // A half star of 4 quads round a boundary vertex: its caps past 0.2% of its size, warned.
  const positions = [0, 0, 0]; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; positions.push(10 * Math.cos(a), 10 * Math.sin(a), 0.4 * Math.sin(2 * a)); }
  const half = withNode(emptyDoc(), { kind: 'subd', name: 'half star', cage: { positions, faces: [0, 1, 2, 3].map(k => [0, 1 + 2 * k, 2 + 2 * k, 3 + 2 * k]) } } as ModelNode);
  const r = evaluateDoc(half, 1); assert.ok(r.ok, r.ok ? '' : r.error.hint);
  const b = r.ok ? r.bodies[0] : null!;
  assert.ok(b.notes!.some(n => n.warning && /At crease, corner or boundary vertices the caps are [\d.]+ mm from the limit \([\d.]+% of its size, past 0\.2%\)[\s\S]*even angles \(to do: the limit's own characteristic map\)/.test(n.text)), JSON.stringify(b.notes));
  const query = (doc: typeof half, bodies: BodyResult[], at?: 'crease') => runCheck(doc, bodies, (async () => evaluateDoc(doc, 1)) as never, { op: '<=', query: { fn: 'subd_deviation', ...(at ? { at } : {}) }, value: 0.05 });
  const q = await query(half, r.ok ? r.bodies : [], 'crease');
  assert.equal(q.status, 'fail'); assert.ok(Math.abs((q.measured as number) - b.subd!.creaseDeviationMM) < 1e-4, JSON.stringify(q)); // (measured to 4 places)
  const cmd = commands.find(c => c.id === 'subd-box')!, boxDoc = cmd.build!(ctx, { ...cmd.defaults!(ctx) }), rb = evaluateDoc(boxDoc, 1);
  assert.equal((await query(boxDoc, rb.ok ? rb.bodies : [])).status, 'pass');
  const torus = commands.find(c => c.id === 'subd-torus')!.build!(ctx, { ...commands.find(c => c.id === 'subd-torus')!.defaults!(ctx) }), rt = evaluateDoc(torus, 1);
  assert.equal((await query(torus, rt.ok ? rt.bodies : [])).status, 'unknown');
});
