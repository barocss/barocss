import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, exportStudioStep } from '../src/engine/evaluate';
import { emptyDoc, placedDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { isRefusal } from '../src/engine/refusal';
import { addPart } from '../src/assembly/edit';
import { addInstancePattern, editInstancePattern, patternDeleteRefusal } from '../src/assembly/patterns';
import { addAssemblyStep, assemblyStepProblems, assemblyStepsProblem, deleteAssemblyStep, editAssemblyStep, moveAssemblyStep, stepOfOccurrence, stepStateOf } from '../src/assembly/steps';
import { bomView, deriveBom } from '../src/team/assembly';
import { assemblyMeshes } from '../src/api/assemblyCore';
import { assembly, part, Location } from '../src/api';
import { libraryInstance } from '../src/library/libraries';
import { withFastenerInstance } from '../src/app/fasteners';
import { withSampleRows } from './person-file';
import { takenInstanceIds } from '../src/assembly/takenIds';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// Roadmap 10 ⑥: assembly instruction steps. Ordered, presentation only: nothing here changes a placement, a body, the BOM or a file.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const plate = rectanglePart(40, 40, 10), block = rectanglePart(10, 10, 10);
const refused = (fn: () => unknown, code: string, words: RegExp) => {
  try { fn(); } catch (e) { assert.ok(isRefusal(e, code as never), `${code}: ${String(e)}`); assert.match((e as Error).message, words); return; }
  assert.fail(`not refused (${code})`);
};
const same = <T>(a: T, b: T) => assert.deepEqual(a, b);

/** Four placed parts: p1 and p2 are one definition (two occurrences of the plate), p3 a block, p4 another block. */
function four(): StudioDoc {
  const one = addPart(emptyDoc(), { name: 'Plate', doc: plate, position: [0, 0, 0] }).doc;
  const inst = one.instances![0], shared = { ...inst, part: { id: 'plate', rev: 'A' } };
  const more = (id: string, name: string, z: number) => ({ ...inst, id, name, doc: block, position: [5, 5, z] as [number, number, number], part: undefined });
  return { ...one, instances: [shared, { ...shared, id: 'p2', name: 'Plate 2', position: [0, 0, 10] }, more('p3', 'Block', 20), more('p4', 'Block B', 30)] };
}
/** Three steps over the four parts: [p1, p2] then [p3] then [p4]. */
function stepped(): StudioDoc {
  let doc = four();
  doc = addAssemblyStep(doc, { name: 'Plates', add: ['p1', 'p2'], explode: 1 }).doc;
  doc = addAssemblyStep(doc, { name: 'Block', note: 'Press it in.', add: ['p3'], view: { eye: [60, 60, 60], target: [0, 0, 10], up: [0, 0, 1] } }).doc;
  return addAssemblyStep(doc, { name: 'Top', add: ['p4'] }).doc;
}
const sets = (doc: StudioDoc, k: number) => { const s = stepStateOf(doc, k); return { installed: [...s.installed].sort(), active: [...s.active].sort(), waiting: [...s.waiting].sort(), unresolved: s.unresolved }; };

test('three steps over four occurrences (two of one definition): the state of each step, the same going next, back or jumping', () => {
  const doc = stepped();
  same(sets(doc, 0), { installed: [], active: ['p1', 'p2'], waiting: ['p3', 'p4'], unresolved: [] });
  same(sets(doc, 1), { installed: ['p1', 'p2'], active: ['p3'], waiting: ['p4'], unresolved: [] });
  same(sets(doc, 2), { installed: ['p1', 'p2', 'p3'], active: ['p4'], waiting: [], unresolved: [] });
  // Each step's state is a function of the document and the index alone: going on, back, or jumping lands on identical sets.
  const walk = [0, 1, 2, 1, 0, 2, 0, 2, 1].map(k => JSON.stringify(sets(doc, k))), once = [0, 1, 2].map(k => JSON.stringify(sets(doc, k)));
  walk.forEach((s, i) => assert.equal(s, once[[0, 1, 2, 1, 0, 2, 0, 2, 1][i]]));
  // Repeated occurrences of one definition stay distinct: p1 and p2 are two entries, one definition.
  assert.equal(doc.instances![0].part!.id, doc.instances![1].part!.id);
  assert.equal(stepOfOccurrence(doc, 'p2')?.index, 0);
  assert.equal(stepOfOccurrence(doc, 'p3')?.step.name, 'Block');
  assert.equal(stepOfOccurrence(doc, 'nope'), undefined);
  refused(() => stepStateOf(doc, 3), 'NO_STEP', /No step 3; steps run from 0 to 2/);
  refused(() => stepStateOf(four(), 0), 'NO_STEP', /there are no steps/);
});

test('a part in no step is shown at the last step only, and reported', () => {
  const doc = addAssemblyStep(addAssemblyStep(four(), { add: ['p1'] }).doc, { add: ['p2'] }).doc;
  same(sets(doc, 0).waiting, ['p2', 'p3', 'p4']);
  same(sets(doc, 1).waiting, []);
  same(sets(doc, 1).installed, ['p1', 'p3', 'p4']);
  same(stepStateOf(doc, 1).unassigned, ['p3', 'p4']);
  const problems = assemblyStepProblems(doc);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, 'unassigned');
  assert.match(problems[0].message, /2 placed parts are in no step \(Block \(p3\), Block B \(p4\)\): the steps show them only at the last step/);
  same(assemblyStepProblems(four()), []);
});

test('an occurrence is in one step only: a duplicate is refused in words, across steps and inside one', () => {
  const doc = stepped();
  refused(() => addAssemblyStep(doc, { add: ['p3'] }), 'VALUE', /Block \(p3\) is already in step Block \(step2\): a part is introduced in one step/);
  refused(() => editAssemblyStep(doc, { id: 'step3', add: ['p4', 'p1'] }), 'VALUE', /Plate \(p1\) is already in step Plates \(step1\)/);
  // (The same list repeating a part is one entry.)
  same(addAssemblyStep(four(), { add: ['p1', 'p1', 'p2'] }).doc.assemblySteps![0].add, ['p1', 'p2']);
  // Editing a step with its own parts again is fine.
  same(editAssemblyStep(doc, { id: 'step1', add: ['p2', 'p1'] }).doc.assemblySteps![0].add, ['p2', 'p1']);
  refused(() => addAssemblyStep(four(), { add: ['base'] }), 'VALUE', /base part is always shown/);
  refused(() => addAssemblyStep(four(), { add: ['p9'] }), 'VALUE', /No part "p9" to put in a step; parts: p1, p2, p3, p4/);
  refused(() => addAssemblyStep(four(), { add: ['p1/x'] }), 'VALUE', /inside a sub-assembly: put the sub-assembly in a step as a whole/);
  refused(() => addAssemblyStep(four(), { add: ['p1'], explode: 3 }), 'VALUE', /explode scale is a number from 0 to 2, not 3/);
  refused(() => addAssemblyStep(four(), { add: ['p1'], view: { eye: [1, 1, 1], target: [1, 1, 1], up: [0, 0, 1] } }), 'VALUE', /the eye is at the target/);
  refused(() => deleteAssemblyStep(doc, 'step9'), 'NO_STEP', /No step "step9"; steps: step1, step2, step3/);
  refused(() => editAssemblyStep(doc, { id: 'step9', name: 'x' }), 'NO_STEP', /No step "step9"/);
});

test('reorder: moving a step changes the order and nothing else; the states follow', () => {
  const doc = stepped(), moved = moveAssemblyStep(doc, 'step3', 0).doc;
  same(moved.assemblySteps!.map(s => s.id), ['step3', 'step1', 'step2']);
  same(sets(moved, 0), { installed: [], active: ['p4'], waiting: ['p1', 'p2', 'p3'], unresolved: [] });
  same(sets(moved, 2), { installed: ['p1', 'p2', 'p4'], active: ['p3'], waiting: [], unresolved: [] });
  same(moveAssemblyStep(moved, 'step3', 2).doc.assemblySteps!.map(s => s.id), ['step1', 'step2', 'step3']);
  same(moveAssemblyStep(doc, 'step2', 1).doc.assemblySteps, doc.assemblySteps);
  refused(() => moveAssemblyStep(doc, 'step1', 3), 'VALUE', /There are 3 steps: position 3 is not among them \(0 is the first, 2 the last\)/);
  refused(() => moveAssemblyStep(doc, 'step1', -1), 'VALUE', /position -1 is not among them/);
  // The step's own values travel with it.
  assert.equal(moved.assemblySteps![1].explode, 1);
  assert.equal(moved.assemblySteps![2].note, 'Press it in.');
});

test('edit: name, note, view and explode change, null clears; delete leaves its parts in no step', () => {
  const doc = stepped();
  const e = editAssemblyStep(doc, { id: 'step2', name: 'Press', note: null, view: null, explode: 0.5 }).doc.assemblySteps![1];
  assert.deepEqual(e, { id: 'step2', name: 'Press', add: ['p3'], explode: 0.5 });
  refused(() => editAssemblyStep(doc, { id: 'step2', name: '  ' }), 'VALUE', /a step has a name/);
  const del = deleteAssemblyStep(doc, 'step2').doc;
  same(del.assemblySteps!.map(s => s.id), ['step1', 'step3']);
  assert.equal(stepOfOccurrence(del, 'p3'), undefined);
  assert.equal(deleteAssemblyStep(deleteAssemblyStep(deleteAssemblyStep(doc, 'step1').doc, 'step2').doc, 'step3').doc.assemblySteps, undefined);
  // (A new step takes the first free id and the default name counts the steps.)
  assert.equal(addAssemblyStep(del, { add: ['p3'] }).id, 'step2');
  assert.equal(addAssemblyStep(four(), {}).doc.assemblySteps![0].name, 'Step 1');
  // The input document is never changed.
  const snapshot = JSON.stringify(doc); editAssemblyStep(doc, { id: 'step1', name: 'Other' }); moveAssemblyStep(doc, 'step1', 2); assert.equal(JSON.stringify(doc), snapshot);
});

test('deleting a part a step lists is refused in words (take it off the step first); a step that names a gone part is kept and reported', () => {
  const doc = stepped();
  const held = patternDeleteRefusal(doc, 'p3');
  assert.ok(held && isRefusal(held, 'PATTERN_REFERENCED'));
  assert.match(held!.message, /Block \(p3\) is in step Block \(step2\): take it out of that step, or delete the step, first/);
  // Taken off its step, the part is free to go.
  assert.equal(patternDeleteRefusal(editAssemblyStep(doc, { id: 'step2', add: [] }).doc, 'p3'), undefined);
  // A pattern change that would remove a listed copy is refused with the step named.
  const base = addAssemblyStep(four(), { add: ['p3'] }).doc;
  const patterned = addInstancePattern(base, { seed: 'p3', count: 3, kind: 'linear', dir: [1, 0, 0], spacing: 20 }).doc;
  const copy = patterned.instances!.find(i => i.pattern?.k === 2)!;
  const withCopy = addAssemblyStep(patterned, { name: 'Copies', add: [copy.id] }).doc;
  refused(() => editInstancePattern(withCopy, { id: 'pat1', count: 2 }), 'PATTERN_REFERENCED', new RegExp(`step Copies \\(step2\\) lists it`));
  // The copy keeps its id when its pattern is edited otherwise, so the step still finds it (stable occurrence ids).
  const moved = editInstancePattern(withCopy, { id: 'pat1', spacing: 25 }).doc;
  same(stepStateOf(moved, 1).active, [copy.id]);
  // A file whose step names a part that is gone: kept, reported, shown as unresolved, never remapped; Open works.
  const stale = { ...stepped(), assemblySteps: [{ id: 'step1', name: 'Fit', add: ['p1', 'p7'] }, { id: 'step2', name: 'Rest', add: ['p2'] }] } as StudioDoc;
  const read = readStudioDoc(JSON.stringify(stale));
  assert.ok('doc' in read, JSON.stringify(read));
  const got = (read as { doc: StudioDoc }).doc;
  same(got.assemblySteps, stale.assemblySteps);
  same(stepStateOf(got, 0).unresolved, ['p7']);
  same(stepStateOf(got, 1).unresolved, ['p7']);
  same(stepStateOf(got, 0).active, ['p1']);
  const problems = assemblyStepProblems(got).filter(p => p.kind === 'missing-part');
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /Step Fit \(step1\) names p7, which is not placed now: the step keeps it and shows nothing for it/);
});

test('Save and Open: a round trip keeps the steps; malformed steps are refused in words', () => {
  const doc = stepped();
  const read = readStudioDoc(JSON.stringify(doc));
  assert.ok('doc' in read, JSON.stringify(read));
  same((read as { doc: StudioDoc }).doc.assemblySteps, doc.assemblySteps);
  const refuse = (steps: unknown, words: RegExp) => {
    const r = readStudioDoc(JSON.stringify({ ...doc, assemblySteps: steps }));
    assert.ok('error' in r && words.test(r.error), JSON.stringify(r));
  };
  refuse('nope', /assemblySteps is a list of steps/);
  refuse([{ name: 'x', add: [] }], /Each assembly step has an id/);
  refuse([{ id: 's', name: '', add: [] }], /a step has a name/);
  refuse([{ id: 's', name: 'x', add: 'p1' }], /add lists the placed parts it introduces, by id/);
  refuse([{ id: 's', name: 'x', add: [], explode: 5 }], /explode scale is a number from 0 to 2, not 5/);
  refuse([{ id: 's', name: 'x', add: [], view: { eye: [0, 0, 0], target: [1, 1], up: [0, 0, 1] } }], /the view is \{eye, target, up\}/);
  refuse([{ id: 's', name: 'x', add: [] }, { id: 's', name: 'y', add: [] }], /Step s is listed twice/);
  refuse([{ id: 'a', name: 'A', add: ['p1'] }, { id: 'b', name: 'B', add: ['p1'] }], /p1 is in step A \(a\) and step B \(b\): a part is introduced in one step/);
  refuse([{ id: 'a', name: 'A', add: ['p1', 'p1'] }], /p1 is in step A \(a\) twice/);
  assert.equal(assemblyStepsProblem(doc), undefined);
  assert.equal(assemblyStepsProblem(four()), undefined);
});

test('presentation only: placed documents, meshes, BOM and STEP are identical with and without steps', async () => {
  const plain = four(), withSteps = stepped();
  assert.ok(!('assemblySteps' in plain));
  for (let k = 0; k < 4; k++) assert.equal(JSON.stringify(placedDoc(withSteps.instances![k], withSteps)), JSON.stringify(placedDoc(plain.instances![k], plain)));
  assert.equal(JSON.stringify(assemblyMeshes(withSteps, 1)), JSON.stringify(assemblyMeshes(plain, 1)));
  assert.equal(JSON.stringify(assemblyMeshes(withSteps, 0)), JSON.stringify(assemblyMeshes(plain, 0)));
  assert.equal(JSON.stringify(deriveBom(await bomView(withSteps, evaluate))), JSON.stringify(deriveBom(await bomView(plain, evaluate))));
  const step = (d: StudioDoc) => exportStudioStep(d, { name: 'x', timestamp: '2026-10-31T00:00:00' }).text;
  assert.equal(step(withSteps), step(plain));
  // Adding, editing, reordering and deleting steps never touches the placed parts.
  const after = deleteAssemblyStep(moveAssemblyStep(editAssemblyStep(withSteps, { id: 'step1', explode: 2 }).doc, 'step2', 0).doc, 'step3').doc;
  assert.equal(JSON.stringify(after.instances), JSON.stringify(plain.instances));
  assert.equal(JSON.stringify(after.mates), JSON.stringify(plain.mates));
  assert.equal(JSON.stringify(after.nodes), JSON.stringify(plain.nodes));
});

test('the facade: step, editStep, moveStep, deleteStep, steps and stepState, by part name', () => {
  let asm = assembly('Fixture').addPart('Plate', part('p').box({ w: 40, d: 40, h: 10 })).addPart('Block', part('b').box({ w: 10, d: 10, h: 10 }), { at: Location.at([5, 5, 10]) });
  asm = asm.step({ name: 'Plate', parts: ['Plate'], explode: 1 }).step({ parts: ['Block'], view: { eye: [60, 60, 60], target: [0, 0, 0], up: [0, 0, 1] } });
  const steps = asm.steps();
  assert.deepEqual(steps.map(s => [s.id, s.name, s.parts]), [['step1', 'Plate', ['Plate']], ['step2', 'Step 2', ['Block']]]);
  assert.deepEqual(asm.stepState(0), { installed: [], active: ['Plate'], waiting: ['Block'], unresolved: [], unassigned: [] });
  assert.deepEqual(asm.moveStep('step2', 0).steps().map(s => s.id), ['step2', 'step1']);
  assert.equal(asm.editStep('step1', { name: 'Base plate', explode: null }).steps()[0].name, 'Base plate');
  assert.equal(asm.deleteStep('step1').steps().length, 1);
  assert.deepEqual(asm.stepProblems(), []);
  assert.deepEqual(asm.deleteStep('step1').stepProblems().length, 1);
  assert.throws(() => asm.step({ parts: ['Block'] }), /already in step/);
  assert.throws(() => asm.step({ parts: ['Nothing'] }));
});

test('chat later: the agent has no step tool (the per-turn tool budget is full), and its part delete obeys the step rule', async () => {
  const doc = stepped(), first = await evaluate(doc);
  assert.ok(first.ok);
  const state: ChatState = { doc, bodies: first.bodies };
  const r = await dispatchTool(state, 'delete_part', { part: 'p3' }, evaluate);
  assert.equal(r.isError, true);
  assert.match(r.content, /Block \(p3\) is in step Block \(step2\)/);
});

/** A file whose step names p4 and whose cut targets p5, neither placed (stale, kept). */
const staleDoc = (): StudioDoc => ({ ...four(), instances: four().instances!.slice(0, 3), assemblySteps: [{ id: 'step1', name: 'Fit', add: ['p1'] }, { id: 'step2', name: 'Last', add: ['p4'] }],
  assemblyCuts: [{ id: 'cut1', profile: { kind: 'circle', radius: 1 }, at: [0, 0, 0], dir: [0, 0, -1], depth: 'through', targets: ['p5'] }] });

test('a stale id a step, cut, mate or pattern names is never handed to a new part: every allocator skips it', async () => {
  const doc = staleDoc();
  assert.deepEqual([...takenInstanceIds(doc)].sort(), ['p1', 'p2', 'p3', 'p4', 'p5']);
  // addPart (and so the facade's and the agent's add_part)
  const added = addPart(doc, { name: 'New', doc: block });
  assert.equal(added.id, 'p6');
  same(stepStateOf(added.doc, 1).unresolved, ['p4']);
  same(stepStateOf(added.doc, 1).active, []);
  assert.equal(assemblyStepProblems(added.doc).filter(p => p.kind === 'missing-part').length, 1);
  // the agent's add_part
  const first = await evaluate(doc);
  assert.ok(first.ok);
  const r = await dispatchTool({ doc, bodies: first.bodies }, 'add_part', { name: 'Chat part' }, evaluate);
  assert.equal(r.isError, false, r.content);
  assert.ok(!r.state.doc.instances!.some(i => i.id === 'p4' || i.id === 'p5'), r.state.doc.instances!.map(i => i.id).join());
  // a library part and a fastener
  assert.ok(!['p1', 'p4', 'p5'].includes(libraryInstance(doc, 'enclosure', 'enclosure-base', { name: 'B' }).id));
  const fast = withFastenerInstance(withSampleRows({ ...doc, instances: [], assemblySteps: [{ id: 'step1', name: 'Fit', add: ['inst1'] }] }), { kind: 'socket-screw', size: 'M6', length: '20', joint: 'free', grip: 10, holeD: 0, holeDepth: 0, through: '0', insert: 'instance', model: 'cosmetic', x: 0, y: 0, z: 0, up: '+z' });
  assert.equal(fast.instances![0].id, 'inst2');
  // a mate naming a missing p4, and a pattern whose seed p3 is missing: neither id is reused
  const mate = { id: 'm1', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p4', face: 'n1.bottom' } } as unknown as StudioDoc['mates'] extends (infer M)[] | undefined ? M : never;
  const withMate: StudioDoc = { ...four(), instances: four().instances!.slice(0, 3), mates: [mate] };
  assert.deepEqual([...takenInstanceIds(withMate)].sort(), ['base', 'p1', 'p2', 'p3', 'p4']);
  assert.equal(addPart(withMate, { name: 'New', doc: block }).id, 'p5');
  const withSeed: StudioDoc = { ...four(), instances: [four().instances![0], four().instances![1]], instancePatterns: [{ id: 'pat1', seed: 'p3', count: 2, kind: 'linear', dir: [1, 0, 0], spacing: 20 }] };
  assert.equal(addPart(withSeed, { name: 'New', doc: block }).id, 'p4');
  // a cut whose target is gone does not cut the new part
  assert.ok(!doc.instances!.some(i => i.id === 'p5') && added.doc.instances!.every(i => i.id !== 'p5'));
});

test('Open stays tolerant of step ids the editor refuses, and reports them in the right words', () => {
  const doc = { ...four(), assemblySteps: [{ id: 'step1', name: 'Odd', add: ['base', 'p1/q', 'p1'] }] } as StudioDoc;
  const read = readStudioDoc(JSON.stringify(doc));
  assert.ok('doc' in read, JSON.stringify(read));
  const reports = assemblyStepProblems((read as { doc: StudioDoc }).doc).filter(p => p.kind !== 'unassigned');
  assert.deepEqual(reports.map(p => p.kind), ['unlistable-part', 'unlistable-part']);
  const problems = reports.map(p => p.message);
  assert.deepEqual(problems, ['Step Odd (step1): base is the base part, always shown: a step does not list it.', 'Step Odd (step1): p1/q is a part inside a sub-assembly: steps list top-level parts only.']);
});

test('a step name over 60 characters and a note over 500 are refused in words', () => {
  refused(() => addAssemblyStep(four(), { name: 'x'.repeat(61), add: ['p1'] }), 'VALUE', /the name is at most 60 characters, not 61/);
  refused(() => addAssemblyStep(four(), { name: 'ok', note: 'y'.repeat(501), add: ['p1'] }), 'VALUE', /the note is at most 500 characters, not 501/);
  refused(() => editAssemblyStep(stepped(), { id: 'step1', name: 'x'.repeat(5000) }), 'VALUE', /at most 60 characters, not 5000/);
  refused(() => editAssemblyStep(stepped(), { id: 'step1', note: 'y'.repeat(501) }), 'VALUE', /note is at most 500/);
  assert.equal(addAssemblyStep(four(), { name: 'x'.repeat(60), note: 'y'.repeat(500), add: ['p1'] }).doc.assemblySteps!.length, 1);
});
