import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editFitTables, keyFitRole, setFaceClass } from '../src/engine/fits';

// O138 (the kernel lane's open studio item): a key's width fit. A class goes on a planar side of the key (a shaft's
// class), of its keyseat and of its hub's keyway (holes' classes); the size is the key's width; the limits are the
// kernel key's fit (D157) from the user's tables (D155: none built in). The default shaft's 6 mm seat, the hub's
// 6 mm keyway, the key 6 high. The rows are the test's own, each an estimate: N9 0/−30, JS9 +15/−15, h9 0/−30 µm over
// 3 up to 6 mm — so the seat N9/h9 is −30 to +30 µm (transition), the hub JS9/h9 −15 to +45 µm (transition).
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const evaluated = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
function run(doc: StudioDoc, id: string, pick: { bodies?: number[]; face?: string }, values: Record<string, number | string> = {}) {
  const bodies = evaluated(doc);
  const faces = pick.face ? [(() => { const body = bodies.findIndex(b => b.mesh.faces.some(f => f.name === pick.face)); return { body, face: bodies[body].mesh.faces.findIndex(f => f.name === pick.face) }; })()] : [];
  const ctx: Ctx = { doc, bodies, selection: { faces, edges: [], bodies: (pick.bodies ?? []).map(node => bodies.findIndex(b => b.ref?.node === node)) } }, c = cmd(id), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : `${id}: ${ok.reason}`);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}
const TABLE = { id: 'keys', rows: [
  { class: 'N9', over: 3, upTo: 6, upperUM: 0, lowerUM: -30, estimate: true },
  { class: 'JS9', over: 3, upTo: 6, upperUM: 15, lowerUM: -15, estimate: true },
  { class: 'h9', over: 3, upTo: 6, upperUM: 0, lowerUM: -30, estimate: true },
] };
function setup() {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 });
  doc = run(doc, 'keyway', { face: `n${doc.nodes.length - 1}.hole0.side0` }, { b: 6, t2: 2.8 });
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 });
  const t = editFitTables(doc, [TABLE]); assert.ok('doc' in t); doc = t.doc;
  const key = doc.nodes.length - 1, way = (doc.nodes[key] as Extract<ModelNode, { kind: 'key' }>).hub!;
  const bodies = evaluated(doc), keyBody = bodies.find(b => b.ref?.node === key)!;
  const side = keyBody.mesh.faces.find(f => f.kind === 'plane' && Math.abs(f.normal[2]) < 1e-6 && Math.abs(f.normal[0]) < 0.5)!.name;
  return { doc, side, seat: 'n0.keyseat1', hub: `${doc.nodes[way].id}.keyway`, key };
}
/** The Fit class command on a face, by name. */
function classed(doc: StudioDoc, face: string, cls: string) { return run(doc, 'fit-class', { face }, { class: cls }); }

test('a key\'s width fit: classes on the key\'s, the keyseat\'s and the keyway\'s sides — both fits in the key\'s notes from the user\'s rows', () => {
  const s = setup(), { side, seat, hub, key } = s;
  let doc = s.doc;
  assert.deepEqual([keyFitRole(doc, side)?.role, keyFitRole(doc, seat)?.role, keyFitRole(doc, hub)?.role, keyFitRole(doc, 'n0.step1')], ['key', 'keyseat', 'keyway', null]);
  doc = classed(doc, side, 'h9'); doc = classed(doc, seat, 'N9'); doc = classed(doc, hub, 'JS9');
  const notes = evaluated(doc).find(b => b.ref?.node === key)!.notes!.map(n => [n.text, !!n.warning]);
  assert.ok(notes.some(([t, w]) => t === 'Width fit in the seat: N9/h9 at 6 mm — transition, −0.03 to +0.03 mm clearance (an estimate)' && w), JSON.stringify(notes));
  assert.ok(notes.some(([t]) => t === 'Width fit in the hub\'s keyway: JS9/h9 at 6 mm — transition, −0.015 to +0.045 mm clearance (an estimate)'), JSON.stringify(notes));
});

test('key width refusals: a hole\'s class on the key, a seat classed with the key bare, a row missing — typed, nothing built in', () => {
  const { doc, side, seat } = setup();
  const wrong = evaluateDoc(setFaceClass(doc, side, 'N9'), 2);
  assert.ok(!wrong.ok && /\[FIT_FACE\].*a key's side: give it a shaft's class/.test(wrong.error.detail), wrong.ok ? 'built' : wrong.error.detail);
  const bare = evaluateDoc(setFaceClass(doc, seat, 'N9'), 3);
  assert.ok(!bare.ok && /\[FIT_FACE\].*keyseat \(N9\) carries a class but the key does not/.test(bare.error.detail), bare.ok ? 'built' : bare.error.detail);
  const t = editFitTables(doc, [], ['keys']); assert.ok('doc' in t);
  const none = evaluateDoc(setFaceClass(setFaceClass(t.doc, side, 'h9'), seat, 'N9'), 4);
  assert.ok(!none.ok && /h9|N9/.test(none.error.detail) && /row|table/i.test(none.error.detail), none.ok ? 'built' : none.error.detail);
  // (A plane that is no key's, seat's or keyway's side takes no class.)
  const c = cmd('fit-class'), bodies = evaluated(doc), body = bodies.findIndex(b => b.ref?.node === 0), face = bodies[body].mesh.faces.findIndex(f => f.kind === 'plane' && !/keyseat/.test(f.name));
  const a = c.available({ doc, bodies, selection: { faces: [{ body, face }], edges: [], bodies: [] } });
  assert.ok(!a.ok && /side of a key, its keyseat or its keyway/.test(a.reason));
});
