// PG-8 and PG-4 (P1's gaps): the agent locks a part to another (lock_part, the studio's Lock), and a gear locked to its
// shaft is coupled as a gear body on the shaft is — the API lane's repro: two shafts turning on the base 45 mm apart,
// a 20- and a 40-tooth gear (module 1.5) each locked to its shaft: the follower at −20/40.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { treeOfDoc } from '../src/chat/robot';
import { dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { lockPart } from '../src/assembly/edit';
import { isRefusal } from '../src/engine/refusal';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const shaft = (): StudioDoc => ({ ...emptyDoc(), nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 } as ModelNode, { kind: 'extrude', sketch: 0, height: 30 } as ModelNode] });
const gear = (teeth: number): StudioDoc => ({ ...emptyDoc(), nodes: [{ kind: 'gear', module: 1.5, teeth, faceWidth: 8, bore: 8, center: [0, 0], generator: 'spur-gear@0' } as ModelNode] });
function unlocked(): StudioDoc {
  const base: StudioDoc = { ...emptyDoc(), nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [120, 60] } as ModelNode, { kind: 'extrude', sketch: 0, height: 10 } as ModelNode,
    { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [30, 30], radius: 4 } as ModelNode, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [75, 30], radius: 4 } as ModelNode] };
  return { ...base,
    instances: [
      { id: 's1', name: 'crankshaft', doc: shaft(), position: [30, 30, 10], rotation: [0, 0, 0] }, { id: 's2', name: 'camshaft', doc: shaft(), position: [75, 30, 10], rotation: [0, 0, 0] },
      { id: 'g1', name: 'crank gear', doc: gear(20), position: [30, 30, 20], rotation: [0, 0, 0] }, { id: 'g2', name: 'cam gear', doc: gear(40), position: [75, 30, 20], rotation: [0, 0, 0] },
    ],
    mates: [
      { id: 'a1', kind: 'concentric', a: { part: 'base', face: 'n2.side0' }, b: { part: 's1', face: 'n1.side0' } }, { id: 'a2', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 's1', face: 'n1.bottom' } },
      { id: 'b1', kind: 'concentric', a: { part: 'base', face: 'n3.side0' }, b: { part: 's2', face: 'n1.side0' } }, { id: 'b2', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 's2', face: 'n1.bottom' } },
    ] };
}

test('PG-8: lock_part locks a part to another where they stand (proposed: the assembly\'s); refusals typed', async () => {
  const doc = unlocked(), r = await evaluate(doc); assert.ok(r.ok);
  const s: ChatState = { doc, bodies: r.bodies, turnBase: doc };
  const direct = await runTool(s, 'lock_part', { part: 'g1', to: 's1' }, evaluate);
  assert.equal(JSON.parse(direct.content).code, 'needs_approval', direct.content);
  const done = await dispatchTool(s, 'lock_part', { part: 'g1', to: 's1' }, evaluate);
  assert.ok(!done.isError && done.changed, done.content);
  const m = done.state.doc.mates!.at(-1)!;
  assert.equal(m.kind, 'lock'); assert.equal(m.a.part, 's1'); assert.equal(m.b.part, 'g1'); assert.deepEqual(m.rel, { position: [0, 0, 10], rotation: [0, 0, 0] });
  assert.deepEqual(done.state.doc.instances!.find(i => i.id === 'g1')!.position, [30, 30, 20], 'where it stood');
  for (const [o, code] of [[{ part: 'nope', to: 's1' }, 'NO_PART'], [{ part: 'g1', to: 'g1' }, 'MATE_SAME_PART']] as const) assert.throws(() => lockPart(doc, o), (e: unknown) => isRefusal(e, code));
  const grounded = { ...doc, instances: doc.instances!.map(i => i.id === 'g1' ? { ...i, grounded: true } : i) };
  assert.throws(() => lockPart(grounded, { part: 'g1', to: 'base' }), (e: unknown) => isRefusal(e, 'MATE_BOTH_FIXED'));
});

test('PG-4: gears locked to their shafts couple as the shafts\' own gear bodies do — the follower at −20/40', async () => {
  let doc = unlocked();
  doc = lockPart(doc, { part: 'g1', to: 's1' }).doc; doc = lockPart(doc, { part: 'g2', to: 's2' }).doc;
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate);
  assert.deepEqual(tree.joints.filter(j => j.child === 'g1' || j.child === 'g2').map(j => j.type), ['fixed', 'fixed']);
  assert.equal(tree.couplings.length, 1, JSON.stringify(tree.notes));
  const c = tree.couplings[0], leader = tree.joints.find(j => j.key === c.leader)!, follower = tree.joints.find(j => j.key === c.follower)!;
  assert.deepEqual([leader.child, follower.child].sort(), ['s1', 's2']);
  assert.ok(Math.abs(c.multiplier + (leader.child === 's1' ? 20 / 40 : 40 / 20)) < 1e-12, `${c.multiplier}`);
  assert.ok(Math.abs(c.centerDistance - 45) < 1e-9);
  // (Unlocked, the gears stand free: no coupling, as before.)
  const r0 = await evaluate(unlocked()); assert.ok(r0.ok);
  assert.equal((await treeOfDoc(unlocked(), r0.bodies, evaluate)).couplings.length, 0);
});
