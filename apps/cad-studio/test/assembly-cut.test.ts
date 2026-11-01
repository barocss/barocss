import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { addAssemblyCut } from '@barocss/cad-model/assembly/cuts';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { placedBase } from '@barocss/cad-model/engine/doc';
import { instanceEvaluationSources } from '../src/viewport/instanceEvaluation';
import { CUT_DIRS, cutLabel, cutOfDraft, cuttableOf, defaultCutAt, draftOfCut, draftProblem, draftTrialProblem, newCutDraft, withAddedTargets, withDraftCut } from '../src/app/assemblyCutDraft';

// Roadmap 10 ⑤: the Assembly cut HUD's pure helpers — the draft's values as typed, the cut they make, the preview document and the
// problems it names. The preview goes through the same model path as Apply, so what is shown is what is applied.

const plate = rectanglePart(40, 40, 10);
const inst = (id: string, position: [number, number, number], doc = plate): PartInstance => ({ id, name: `Plate ${id}`, doc, position, rotation: [0, 0, 0], part: { id: 'plate', rev: 'A' } });
const doc: StudioDoc = { ...rectanglePart(100, 100, 2), instances: [inst('p1', [0, 0, 0]), inst('p2', [0, 0, 10])] };

test('a new draft is a circle going down through the selected parts; its cut is the model\'s, with the numbers as typed', () => {
  const draft = newCutDraft(['p2'], [20, 20, 20]);
  assert.deepEqual(cutOfDraft(draft), { profile: { kind: 'circle', radius: 5 }, at: [20, 20, 20], dir: [0, 0, -1], depth: 'through', targets: ['p2'] });
  assert.equal(draftProblem(doc, draft), undefined);
  const pocket = { ...draft, profile: 'rectangle' as const, w: '12', d: '8', through: false, depth: '3.5', dir: '+X' as const, name: ' Slot ' };
  assert.deepEqual(cutOfDraft(pocket), { name: 'Slot', profile: { kind: 'rectangle', w: 12, d: 8 }, at: [20, 20, 20], dir: [1, 0, 0], depth: 3.5, targets: ['p2'] });
  assert.deepEqual(Object.keys(CUT_DIRS), ['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
});

test('a draft that is not a cut yet says why, in words: an empty or non-numeric box, a size at or below 0, no parts, a part that cannot be cut', () => {
  const draft = newCutDraft(['p2'], [20, 20, 20]);
  assert.match(String(cutOfDraft({ ...draft, radius: '' })), /The radius is not a number yet/);
  assert.match(String(cutOfDraft({ ...draft, at: ['1', 'x', '3'] })), /Centre Y is not a number yet/);
  assert.match(draftProblem(doc, { ...draft, radius: '0' }) ?? '', /radius is a number above 0/);
  assert.match(draftProblem(doc, { ...draft, through: false, depth: '-2' }) ?? '', /depth is a number of mm above 0/);
  assert.match(draftProblem(doc, { ...draft, targets: [] }) ?? '', /Pick the parts to cut/);
  assert.match(draftProblem(doc, { ...draft, targets: ['p9'] }) ?? '', /no part "p9" to cut/);
});

test('the preview document holds the draft\'s cut (replacing the one being edited); an invalid draft leaves the document as it is', () => {
  const draft = newCutDraft(['p2'], [20, 20, 20]);
  assert.equal(withDraftCut(doc, null), doc);
  assert.equal(withDraftCut(doc, { ...draft, radius: '0' }), doc);
  const shown = withDraftCut(doc, draft);
  assert.equal(shown.assemblyCuts?.length, 1);
  assert.deepEqual(shown.assemblyCuts![0].targets, ['p2']);
  assert.equal(doc.assemblyCuts, undefined, 'the document itself is untouched');
  // Editing an existing cut: its draft is the cut's values, and the preview swaps that cut for the edited one.
  const made = addAssemblyCut(doc, { profile: { kind: 'circle', radius: 5 }, at: [20, 20, 20], dir: [0, 0, -1], depth: 'through', targets: ['p2'] }).doc;
  const edit = draftOfCut(made.assemblyCuts![0]);
  assert.deepEqual([edit.editing, edit.profile, edit.through, edit.dir, edit.targets], ['cut1', 'circle', true, '-Z', ['p2']]);
  const bigger = withDraftCut(made, { ...edit, radius: '8' });
  assert.deepEqual(bigger.assemblyCuts!.map(c => [c.id, (c.profile as { radius: number }).radius]), [['cut1', 8]]);
  // A direction a file made that is no axis is kept as it is.
  const slanted = draftOfCut({ ...made.assemblyCuts![0], dir: [0, 0.6, -0.8] });
  assert.equal(slanted.dir, 'Custom');
  assert.deepEqual((cutOfDraft(slanted) as { dir: number[] }).dir, [0, 0.6, -0.8]);
});

test('the preview reaches the viewport\'s placed lanes: the cut part\'s evaluation key changes and its volume is the cut part\'s, the other part\'s is not', async () => {
  const before = instanceEvaluationSources(doc), shown = instanceEvaluationSources(withDraftCut(doc, newCutDraft(['p2'], [20, 20, 20])));
  const key = (m: ReturnType<typeof instanceEvaluationSources>, id: string) => { const s = m.get(id)!; assert.ok(s.ok); return s.key; };
  assert.notEqual(key(before, 'p2'), key(shown, 'p2'));
  assert.equal(key(before, 'p1'), key(shown, 'p1'));
  const r = await evaluatePart(placedBase(withDraftCut(doc, newCutDraft(['p2'], [20, 20, 20])).instances![1], withDraftCut(doc, newCutDraft(['p2'], [20, 20, 20]))), 1);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.bodies.reduce((t, b) => t + (b.volume ?? 0), 0) - (16000 - Math.PI * 25 * 10)) < 1e-6 * 16000);
});

test('helpers: the cuttable selection, the default place and the Browser row', () => {
  const sub: StudioDoc = { ...doc, instances: [...doc.instances!, { id: 'p3', name: 'Sub', doc: doc, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  assert.deepEqual(cuttableOf(sub, ['p1', 'p3', 'p2/lid', 'p9']), ['p1'], 'a sub-assembly, a nested path and an unknown id are left out');
  assert.deepEqual(defaultCutAt([{ min: [0, 0, 10], max: [40, 40, 20] }, { min: [0, 0, 0], max: [40, 40, 10] }]), [20, 20, 20]);
  assert.deepEqual(defaultCutAt([]), [0, 0, 0]);
  const cut = addAssemblyCut(doc, { name: 'Bolt hole', profile: { kind: 'circle', radius: 5 }, at: [20, 20, 20], dir: [0, 0, -1], depth: 'through', targets: ['p2'] }).doc.assemblyCuts![0];
  assert.equal(cutLabel(cut, id => doc.instances!.find(i => i.id === id)!.name), 'Bolt hole · Ø10 through · Plate p2');
  assert.equal(cutLabel({ ...cut, name: undefined, depth: 4, profile: { kind: 'rectangle', w: 6, d: 3 } }, id => id), 'cut1 · 6 × 3 × 4 · p2');
});

test('Add selected adds the selected cuttable parts to the parts to cut: the ones there stay, in order, none twice', () => {
  assert.deepEqual(withAddedTargets(['p2'], ['p1']), ['p2', 'p1']);
  assert.deepEqual(withAddedTargets(['p2', 'p1'], ['p1', 'p3']), ['p2', 'p1', 'p3']);
  assert.deepEqual(withAddedTargets([], []), []);
  assert.deepEqual(withAddedTargets(['p1'], cuttableOf(doc, ['p1', 'p2/lid'])), ['p1'], 'a nested path is not a part to add');
});

test('the HUD refuses what would remove a part, off the typing path: the cheap checks pass, the build trial refuses a cut larger than the part and a centre the kernel cannot hold', () => {
  const draft = newCutDraft(['p2'], [20, 20, 20]), big = { ...draft, profile: 'rectangle' as const, w: '500', d: '500' }, far = { ...draft, at: ['50000', '20', '20'] as [string, string, string], through: false, depth: '5' };
  assert.equal(draftProblem(doc, big), undefined, 'the typing path does no build');
  assert.match(draftTrialProblem(doc, big) ?? '', /Plate p2 \(p2\) would not stand with it/);
  assert.match(draftTrialProblem(doc, far) ?? '', /would not stand with it/);
  assert.equal(draftTrialProblem(doc, draft), undefined);
  assert.equal(draftTrialProblem(doc, { ...draft, radius: '0' }), undefined, 'a draft that is not a cut yet is the cheap check\'s');
});
