import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { carryOver, placedDoc } from '@barocss/cad-model/engine/doc';
import { resolveShopRows } from '@barocss/cad-model/engine/shopRows';
import { evaluatePart, evaluatePlaced } from '@barocss/cad-model/engine/evaluate';
import { placementOf } from '@barocss/cad-model/engine/placement';
import { beginInPlace, contextTransform, turnMoved, elsewhereOf, openAccepted, versionsToMerge, editInPlaceRefusal, finishInPlace, inPlaceBlock, inPlaceContext, sessionChanged, stacksAfter, type AssemblySaved } from '../src/app/editInPlace';

// Roadmap 10 ⑧: a part edited in place inside its assembly. Pure helpers: the context's transform, the session's transitions and the actions it blocks.

const pin = rectanglePart(10, 10, 20), taller = rectanglePart(10, 10, 30);
const inst = (id: string, doc: StudioDoc, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], part?: string): PartInstance =>
  ({ id, name: id, doc, position, rotation, ...(part ? { part: { id: part, rev: 'A' } } : {}) });
const asm: StudioDoc = { ...rectanglePart(60, 20, 5), instances: [inst('a', pin, [10, 0, 0], [0, 0, 90], 'p1'), inst('b', rectanglePart(8, 8, 8), [30, 5, 2], [0, 45, 0]), inst('c', pin, [40, 0, 0], [0, 0, 0], 'p1')] };
const saved: AssemblySaved = { undo: [{ doc: pin, marker: null }], redo: [{ doc: taller, marker: null }], marker: 3, dirty: true };
const apply = (m: readonly number[], t: readonly number[], p: readonly number[]) => [0, 1, 2].map(r => m[3 * r] * p[0] + m[3 * r + 1] * p[1] + m[3 * r + 2] * p[2] + t[r]);
const near = (x: readonly number[], y: readonly number[], what: string) => x.forEach((v, i) => assert.ok(Math.abs(v - y[i]) < 1e-4, `${what}: ${x} vs ${y}`));

async function bodiesOf(doc: StudioDoc) { const r = await evaluatePart(doc, 1); assert.ok(r.ok); return r.bodies; }

test('the context is the inverse of the edited placement: the part itself maps to the identity, others to where they stand relative to it', () => {
  const [a, b] = asm.instances!;
  const self = contextTransform(a, a);
  near(self.m, [1, 0, 0, 0, 1, 0, 0, 0, 1], 'self rotation'); near(self.t, [0, 0, 0], 'self position');
  const ea = placementOf(a), eb = placementOf(b);
  // A point of b, placed in the assembly, then taken to a's coordinates by hand: Rᵀ (p − t).
  const p = [1, 2, 3], world = apply(eb.m, eb.t, p), rel = world.map((v, i) => v - ea.t[i]);
  const inv = [ea.m[0], ea.m[3], ea.m[6], ea.m[1], ea.m[4], ea.m[7], ea.m[2], ea.m[5], ea.m[8]];
  const at = contextTransform(a, b);
  near(apply(at.m, at.t, p), apply(inv, [0, 0, 0], rel), 'other instance');
  // The assembly's own body: the same, from its own coordinates.
  const own = contextTransform(a);
  near(apply(own.m, own.t, p), apply(inv, [0, 0, 0], p.map((v, i) => v - ea.t[i])), 'assembly body');
});

test('the context bodies: the assembly\'s own and the other visible parts (already placed), never the edited one, all by the inverse placement only', async () => {
  const own = await bodiesOf(asm);
  // What the Studio's placed lane gives instanceBodies: bodies in the assembly's coordinates (evaluatePlaced), an other instance NOT at the origin.
  const placedOf = async (i: PartInstance) => { const r = evaluatePlaced(placedDoc(i, asm), placedDoc({ ...i, position: [0, 0, 0], rotation: [0, 0, 0] }, asm), placementOf(i), 1); assert.ok(r.ok); return r.bodies; };
  const [a, b, c] = asm.instances!, map = new Map([['a', { bodies: await placedOf(a) }], ['b', { bodies: await placedOf(b) }], ['c', { bodies: await placedOf(c) }]]);
  const before = own[0].mesh.positions.slice();
  const ctx = inPlaceContext(asm, 'a', own, map);
  assert.equal(ctx.length, own.length + map.get('b')!.bodies.length + map.get('c')!.bodies.length, 'own + b + c; not a');
  assert.deepEqual([...own[0].mesh.positions], [...before], 'the sources are untouched');
  const ea = placementOf(a), inv = [ea.m[0], ea.m[3], ea.m[6], ea.m[1], ea.m[4], ea.m[7], ea.m[2], ea.m[5], ea.m[8]];
  for (const [which, id] of [[own.length, 'b'], [ctx.length - 1, 'c']] as const) {
    const world = map.get(id)!.bodies[0].mesh.positions;
    for (const k of [0, 3, 6]) near([ctx[which].mesh.positions[k], ctx[which].mesh.positions[k + 1], ctx[which].mesh.positions[k + 2]], apply(inv, [0, 0, 0], [world[k] - ea.t[0], world[k + 1] - ea.t[1], world[k + 2] - ea.t[2]]), `${id} vertex`);
  }
  // A hidden part is left out.
  const hidden = { ...asm, instances: asm.instances!.map(i => i.id === 'b' ? { ...i, hidden: true } : i) };
  assert.equal(inPlaceContext(hidden, 'a', own, map).length, ctx.length - map.get('b')!.bodies.length);
  assert.deepEqual(inPlaceContext(asm, 'nope', own, map), []);
});

test('a turn that began on one document and ends on another is moved (dropped), the same one is not', () => {
  const s = beginInPlace(asm, 'a', [], new Map(), saved)!;
  assert.equal(turnMoved(null, null), false); assert.equal(turnMoved(undefined, null), false);
  assert.equal(turnMoved(null, s), true, 'began on the assembly, ends in the session');
  assert.equal(turnMoved(s, null), true, 'began in the session, ends after Finish');
  assert.equal(turnMoved(s, s), false);
});

test('the part evaluates with the rows its assembly gives it, while the authored document is never given them', () => {
  const row = { id: 'sec1', section: { kind: 'tube', width: 20, height: 20, thickness: 2 } };
  const parent = { ...asm, frames: { version: 1, sections: [row] } } as unknown as StudioDoc;
  const part = parent.instances![0].doc;
  const view = resolveShopRows(part, parent).doc;
  assert.equal(view.frames?.sections?.[0].id, 'sec1', 'inherited into what is evaluated');
  assert.equal(part.frames, undefined, 'not into the authored part');
  // A command built on the evaluated view and committed: the part's own (absent) rows are carried over, not the inherited ones.
  const built = { ...view, nodes: [...view.nodes] } as StudioDoc;
  assert.equal(carryOver(built, view, part).frames, undefined);
});

test('refusals: a running tool, a stale model, a nested path, another session', () => {
  const ok = { session: false, working: false, fresh: true };
  assert.equal(editInPlaceRefusal(asm, 'a', ok), null);
  assert.match(editInPlaceRefusal(asm, 'a', { ...ok, working: true })!, /running command/);
  assert.match(editInPlaceRefusal(asm, 'a', { ...ok, fresh: false })!, /not finish computing|does not compute/);
  assert.match(editInPlaceRefusal(asm, 'a/x', ok)!, /through its sub-assembly/);
  assert.match(editInPlaceRefusal(asm, 'zz', ok)!, /not placed/);
  assert.match(editInPlaceRefusal(asm, 'a', { ...ok, session: true })!, /being edited/);
  assert.match(editInPlaceRefusal(asm, 'a', { ...ok, elsewhere: 'the chat turn' })!, /chat turn/);
});

test('session: begins on the instance\'s document with the sharing count; changed only when the part differs; finish is one commit, cancel nothing', async () => {
  const s = beginInPlace(asm, 'a', await bodiesOf(asm), new Map(), saved)!;
  assert.equal(s.name, 'a'); assert.equal(s.shared, 2); assert.equal(s.base, pin);
  assert.equal(beginInPlace(asm, 'nope', [], new Map(), saved), null);
  assert.equal(sessionChanged(s, pin), false); assert.equal(sessionChanged(s, JSON.parse(JSON.stringify(pin))), false);
  assert.equal(sessionChanged(s, taller), true);
  const none = finishInPlace(s, pin);
  assert.ok('doc' in none && !none.changed && none.doc === asm);
  assert.deepEqual(stacksAfter(s, false), { undo: saved.undo, redo: saved.redo });
  const done = finishInPlace(s, taller);
  assert.ok('doc' in done && done.changed);
  assert.deepEqual(done.doc.instances!.map(i => [i.id, i.part?.rev ?? '-', i.doc === taller]), [['a', 'B', true], ['b', '-', false], ['c', 'B', true]], 'both sharers take it');
  const stacks = stacksAfter(s, true);
  assert.equal(stacks.undo.length, 2); assert.equal(stacks.undo[1].doc, asm, 'Undo restores the whole previous assembly'); assert.equal(stacks.undo[1].marker, 3); assert.deepEqual(stacks.redo, []);
});

test('session: the actions it disables say so; none are blocked outside a session', async () => {
  assert.equal(inPlaceBlock(null, 'saving'), null);
  const s = beginInPlace(asm, 'a', [], new Map(), saved)!;
  assert.equal(inPlaceBlock(s, 'saving'), 'Finish or cancel editing a before saving.');
});

test('Finish refuses a working document that is the assembly itself (a path that landed it in the session)', () => {
  const s = beginInPlace(asm, 'a', [], new Map(), saved)!;
  const r = finishInPlace(s, asm);
  assert.ok('error' in r && /contains/.test(r.error));
});

test('what Edit part waits for: a chat turn, an import, a project file that is opening; and the guards a session puts on arriving opens', () => {
  const idle = { chat: false, importing: false, projectOpening: false };
  assert.equal(elsewhereOf(idle), null);
  assert.equal(elsewhereOf({ ...idle, chat: true }), 'the chat turn');
  assert.equal(elsewhereOf({ ...idle, importing: true }), 'the import');
  assert.equal(elsewhereOf({ ...idle, projectOpening: true }), 'a project file that is opening');
  assert.match(editInPlaceRefusal(asm, 'a', { session: false, working: false, fresh: true, elsewhere: elsewhereOf({ ...idle, projectOpening: true }) })!, /project file that is opening/);
  // openedImport, the project's onOpened / canOpen and onLinked all ask this: nothing arriving touches the document while a part is edited.
  const s = beginInPlace(asm, 'a', [], new Map(), saved)!;
  assert.equal(openAccepted(null), true); assert.equal(openAccepted(undefined), true); assert.equal(openAccepted(s), false);
});

test('a moved chat turn merges none of its version log (a session turn\'s make_version never lands in the assembly\'s history)', () => {
  const log = { versions: ['v1'] };
  assert.equal(versionsToMerge(true, log), undefined);
  assert.equal(versionsToMerge(false, log), log);
  assert.equal(versionsToMerge(false, undefined), undefined);
});
