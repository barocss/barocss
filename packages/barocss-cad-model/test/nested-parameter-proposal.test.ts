import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDoc, rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { acceptProposal, dispatchTool, previewProposal, rebaseProposal, runTool, type ChatState, type Evaluate } from '../src/chat/tools';
import { newTransactions } from '../src/chat/transactions';
import { requirementEvidenceRevision } from '../src/util/digest';

const evaluate: Evaluate = async doc => evaluateDoc(doc, 1);
const at = (id: string, doc: StudioDoc): PartInstance => ({ id, name: id, doc, position: [10, 0, 0], rotation: [0, 0, 0] });
const assembly = (...instances: PartInstance[]): StudioDoc => ({ ...emptyDoc(), instances });
function plate(height: number): StudioDoc {
  const doc = rectanglePart(20, 10, height);
  return { ...doc, parameters: { H: height, spare: 2 }, requirements: [{ id: 'HEIGHT', source: '5 mm max', hard: true,
    check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 5, unit: 'mm' } }], nodes: doc.nodes.map(node =>
    node.kind === 'extrude' ? { ...node, height: { parameter: 'H' } } : node) };
}
const left = { ...at('p1', assembly(at('p1', plate(6)))), part: { id: 'left', rev: 'A' }, looks: { 'p1/b1': { material: 'steel' } } };
const right = { ...at('p2', assembly(at('p1', plate(7)))), part: { id: 'right', rev: 'A' } };
const doc = assembly(left, right), state: ChatState = { doc, bodies: [] };
const op = (part = 'p1/p1', set: Record<string, number> = { H: 4 }) => ({ tool: 'features', args: { action: 'parameters', part, set } });
const propose = (root = state, ops = [op()], use = evaluate) => runTool(root, 'proposals', { action: 'propose', title: 'Repair plate height', ops }, use);

test('a root proposal changes one nested definition and binds the Studio approval to exact root evidence revisions', async () => {
  const made = await propose();
  assert.equal(made.isError, false, made.content);
  const waiting = made.state, [proposal] = waiting.doc.proposals!;
  assert.equal(waiting.doc.instances, doc.instances);
  assert.equal(proposal.base_evidence_revision, requirementEvidenceRevision(doc));
  assert.match(proposal.summary, /p1\/p1: H 6 → 4, p1\/p1 local checks 0\/1\/0 → 1\/0\/0/);
  assert.equal(proposal.risk.level, 'high');
  assert.deepEqual(proposal.risk.hard_requirements_changed, ['p1/p1:HEIGHT']);
  assert.deepEqual(proposal.risk.approval, ['assembly']);
  const preview = await previewProposal(waiting, proposal.id, evaluate);
  if ('error' in preview) assert.fail(preview.error);
  const [next, untouched] = preview.doc.instances!;
  assert.equal(untouched, right);
  assert.deepEqual(next.part, { id: 'left', rev: 'B' });
  assert.equal(next.looks, left.looks);
  assert.equal(next.position, left.position);
  assert.equal(next.rotation, left.rotation);
  const [leaf] = next.doc.instances!, original = left.doc.instances![0].doc;
  assert.deepEqual(leaf.doc, { ...original, parameters: { ...original.parameters, H: 4 } });
  const accepted = await acceptProposal(waiting, proposal.id, evaluate);
  if ('error' in accepted) assert.fail(accepted.error);
  assert.deepEqual(accepted.state.doc.instances, preview.doc.instances);
  const decision = accepted.state.doc.history!.at(-1)!;
  assert.equal(decision.by.agent, 'user');
  assert.deepEqual(decision.evidence_revisions, {
    before: requirementEvidenceRevision(doc),
    after: requirementEvidenceRevision(accepted.state.doc),
  });
  assert.notEqual(decision.evidence_revisions!.after, decision.evidence_revisions!.before);
});

test('direct, batch, dry run, and agent acceptance refuse nested writes even with forged risk', async () => {
  let calls = 0;
  const noEvaluate: Evaluate = async () => { calls++; return null; };
  for (const [name, args] of [
    ['features', op().args],
    ['features', { action: 'batch', ops: [op()] }],
    ['features', { action: 'batch', ops: [op()], dryRun: true }],
  ] as const) {
    const refusal = await dispatchTool(state, name, args, noEvaluate);
    assert.equal(refusal.state.doc, doc);
    assert.equal(refusal.isError, true);
    assert.match(refusal.content, /requires a root proposal/);
  }
  const made = await propose(), proposal = made.state.doc.proposals![0];
  const forged = { ...proposal, risk: { ...proposal.risk, approval: [] } };
  const waiting = { ...made.state, doc: { ...made.state.doc, proposals: [forged] } };
  const refusal = await runTool(waiting, 'proposals', { action: 'accept', id: proposal.id }, noEvaluate);
  assert.equal(refusal.state.doc, waiting.doc);
  assert.equal(refusal.isError, true);
  assert.match(refusal.content, /always needs the user.s approval/);
  const api = await acceptProposal(waiting, proposal.id, noEvaluate, { by: { agent: 'chat' } });
  assert.ok('error' in api);
  assert.match(api.error, /always needs the user.s approval/);
  assert.equal(calls, 0);
});

test('a stale proposal cannot preview, accept or rebase onto a recycled path', async () => {
  const made = await propose();
  assert.equal(made.isError, false, made.content);
  const replacement = { ...left, doc: assembly(at('p1', plate(9))) };
  const stale = { ...made.state, doc: { ...made.state.doc, instances: [replacement, right] } };
  let calls = 0;
  const noEvaluate: Evaluate = async () => { calls++; return null; };
  for (const action of [previewProposal, rebaseProposal, acceptProposal]) {
    const refusal = await action(stale, 'P1', noEvaluate);
    assert.ok('error' in refusal);
    assert.match(refusal.error, /earlier revision.*new proposal/);
  }
  assert.equal(calls, 0);
  assert.equal(stale.doc.instances[0].doc.instances![0].doc.parameters.H, 9);
});

test('invalid scope, unsafe ownership and unsupported operation shapes are refused before evaluation', async () => {
  const shared = { ...right, part: left.part };
  const hidden = { ...left, hidden: true };
  const duplicate = { ...left, doc: assembly(left.doc.instances![0], left.doc.instances![0]) };
  const cut = { ...left, doc: { ...left.doc, assemblyCuts: [{
    id: 'c1', profile: { kind: 'circle' as const, radius: 2 }, at: [5, 5, 0] as [number, number, number],
    dir: [0, 0, 1] as [number, number, number], depth: 'through' as const, targets: ['p1'],
  }] } };
  const mated: StudioDoc = { ...doc, mates: [{ id: 'm1', kind: 'coincident', a: { part: 'p1/p1', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } }] };
  const skeletal = plate(6);
  skeletal.nodes = [...skeletal.nodes, { kind: 'skeleton', points: [[0, 0, 0], [10, 0, 0]], segments: [[0, 1]] }];
  const linked = { ...left, part: { ...left.part, source: './host.bcad' } };
  const pending = { ...doc, pendingParts: { left: { rev: 'B', name: 'host.bcad', doc: left.doc } } };
  const cases: [StudioDoc, ReturnType<typeof op>[], RegExp][] = [
    [doc, [op('p1//p1')], /Invalid occurrence path/],
    [doc, [op('p1/p9')], /No part/],
    [assembly(hidden, right), [op()], /hidden/],
    [assembly(duplicate, right), [op()], /Ambiguous/],
    [assembly(left, shared), [op()], /shared definition/],
    [assembly(linked, right), [op()], /file-backed definition/],
    [pending, [op()], /pending revision/],
    [assembly(cut, right), [op()], /assembly cut/],
    [mated, [op()], /assembly mate/],
    [assembly({ ...left, doc: assembly(at('p1', skeletal)) }, right), [op()], /frame and skeleton/],
    [doc, [op('p1/p1', { H: 4, spare: 1 })], /exactly one/],
    [doc, [op('p1/p1', { missing: 4 })], /no parameter missing/],
    [doc, [op('p1/p1', { H: 6 })], /already 6/],
    [doc, [op(), op('p2/p1')], /one nested parameter operation/],
  ];
  for (const [root, ops, reason] of cases) {
    let calls = 0;
    const refused = await propose({ ...state, doc: root }, ops, async () => { calls++; return null; });
    assert.equal(refused.isError, true, refused.content);
    assert.match(JSON.parse(refused.content).error, reason);
    assert.equal(refused.state.doc, root);
    assert.equal(calls, 0);
  }
});

test('invalid geometry or a missing validation reply leaves the proposal and document unchanged', async () => {
  const invalid = await propose(state, [op('p1/p1', { H: 0 })]);
  assert.equal(invalid.isError, true, invalid.content);
  assert.match(invalid.content, /Could not build p1\/p1/);
  assert.equal(invalid.state.doc, doc);
  const interrupted = await propose(state, [op()], async () => null);
  assert.equal(interrupted.isError, true, interrupted.content);
  assert.match(interrupted.content, /evaluation was superseded/);
  assert.equal(interrupted.state.doc, doc);
});

test('a reused operation ID cannot store an empty nested proposal', async () => {
  const tx = { ...newTransactions(), applied: ['old'] };
  const replay = { ...op(), opId: 'old' };
  const out = await propose({ ...state, tx }, [replay]);
  assert.equal(out.isError, true, out.content);
  assert.match(out.content, /already applied/);
  assert.equal(out.state.doc, doc);
});

test('both authored local parameters and the outer placed recipe must build', async () => {
  const broken = plate(6);
  broken.nodes = broken.nodes.map(node => node.kind === 'extrude' ? { ...node, height: { parameter: 'Missing' } } : node);
  const badLeaf = { ...state, doc: assembly({ ...left, doc: assembly(at('p1', broken)) }, right) };
  const badPlacement = { ...state, doc: assembly({ ...left, position: [20000, 0, 0] }, right) };
  for (const [input, reason] of [[badLeaf, /Could not build p1\/p1/], [badPlacement, /Could not build the placement of p1\/p1/]] as const) {
    const result = await propose(input);
    assert.equal(result.isError, true, result.content);
    assert.match(result.content, reason);
    assert.equal(result.state.doc, input.doc);
  }
});

test('unverified hard requirements remain high risk even when neither side has a verdict', async () => {
  const leaf: StudioDoc = { ...plate(6), requirements: [{ id: 'MASS', source: '20 g max', hard: true,
    check: { query: { fn: 'mass' }, op: '<=', value: 20, unit: 'g' } }] };
  const root = assembly({ ...left, looks: undefined, doc: assembly(at('p1', leaf)) }, right);
  const result = await propose({ ...state, doc: root });
  assert.equal(result.isError, false, result.content);
  const [proposal] = result.state.doc.proposals!;
  assert.equal(proposal.risk.level, 'high');
  assert.deepEqual(proposal.risk.hard_requirements_changed, []);
  assert.match(proposal.summary, /p1\/p1 local checks 0\/0\/1 → 0\/0\/1/);
});
