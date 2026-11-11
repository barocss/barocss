import assert from 'node:assert/strict';
import test from 'node:test';
import { identifyNestedFaceRepair, nestedFaceRepairOp } from '../src/chat/nestedFaceRepair';
import { requirementEvidenceOf } from '../src/chat/requirementEvidence';
import { acceptProposal, previewProposal, proposeNestedFaceReferenceRepair, rebaseProposal, runTool,
  type ChatState, type Evaluate } from '../src/chat/tools';
import { newTransactions } from '../src/chat/transactions';
import { emptyDoc, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';

const evaluate: Evaluate = async doc => evaluateDoc(doc, 1);
const path = 'p1/p1', oldFace = 'n1.side[west]', newFace = 'n1.side[west2]';
const at = (id: string, doc: StudioDoc, x: number): PartInstance => ({ id, name: id, doc, position: [x, 0, 0], rotation: [0, 0, 0] });
const assembly = (...instances: PartInstance[]): StudioDoc => ({ ...emptyDoc(), instances });
function plate(tag: string, depth = 8): StudioDoc {
  return { ...emptyDoc(), nextId: 2, nodes: [
    { id: 'n0', kind: 'sketch', profile: 'polygon', points: [[0, 0], [12, 0], [12, depth], [0, depth]],
      sideTags: { outer: ['south', 'east', 'north', tag] } },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 4 },
  ], outputs: { b1: { node: 1, side: 'solid' } },
    requirements: [{ id: 'WIDTH', source: '12 mm between named faces', hard: true,
      check: { query: { fn: 'distance_between', a: oldFace, b: 'n1.side[east]' }, op: '==', value: 12, unit: 'mm' } }],
  };
}
const sibling = at('p2', assembly(at('p1', plate('west'), 0)), 35);
const root = (part: StudioDoc, x = 0) => assembly(at('p1', assembly(at('p1', part, 0)), x), sibling);
const approved = root(plate('west')), renamed = root(plate('west2'));
const state: ChatState = { doc: renamed, bodies: [] };
async function fixture() {
  const report = await requirementEvidenceOf(approved, path, evaluate);
  if ('error' in report) assert.fail(report.error);
  const source = { version: 'v' + '1'.repeat(16), evidenceRevision: report.revision, sha256: 'a'.repeat(64) };
  const repair = identifyNestedFaceRepair(approved, renamed, report, 'WIDTH', source);
  assert.ok(repair);
  return { report, source, repair };
}

test('offer one saved tag-only face replacement on the same occurrence', async () => {
  const { report, source, repair } = await fixture();
  assert.deepEqual([repair.part, repair.from, repair.to], [path, oldFace, newFace]);
  const changedShape = root(plate('west2', 10));
  const moved = root(plate('west2'), 5);
  for (const doc of [changedShape, moved, approved])
    assert.equal(identifyNestedFaceRepair(approved, doc, report, 'WIDTH', source), null);
  assert.equal(identifyNestedFaceRepair(approved, renamed, report, 'WIDTH', { ...source, evidenceRevision: 'b'.repeat(64) }), null);
  assert.equal(identifyNestedFaceRepair(approved, renamed, report, 'UNKNOWN', source), null);
});

test('generic tools and agent deciders cannot apply the Studio repair, and stale proposals cannot replay', async () => {
  const { repair } = await fixture();
  const refused = await runTool(state, 'proposals', { action: 'propose', title: 'Repair face', ops: [nestedFaceRepairOp(repair)] }, evaluate);
  assert.equal(refused.isError, true);
  assert.equal(refused.state.doc, renamed);
  assert.match(refused.content, /Select the replacement face in Studio/);
  const made = await proposeNestedFaceReferenceRepair(state, repair, evaluate);
  assert.equal(made.isError, false, made.content);
  assert.equal(made.state.doc.instances, renamed.instances);
  const [proposal] = made.state.doc.proposals!;
  assert.equal(proposal.by.agent, 'user');
  const tool = await runTool(made.state, 'proposals', { action: 'accept', id: proposal.id }, evaluate);
  assert.equal(tool.isError, true);
  assert.equal(tool.state.doc, made.state.doc);
  assert.match(tool.content, /needs selection and approval by the user/);
  const agent = await acceptProposal(made.state, proposal.id, evaluate, { by: { agent: 'chat' } });
  assert.ok('error' in agent);
  assert.match(agent.error, /needs selection and approval by the user/);
  const repeated = { ...made.state, tx: { ...newTransactions(), applied: ['repeated'] }, doc: { ...made.state.doc,
    proposals: [{ ...proposal, ops: [{ ...proposal.ops[0], opId: 'repeated' }] }],
  } };
  for (const action of [previewProposal, acceptProposal]) {
    const result = await action(repeated, proposal.id, evaluate);
    assert.ok('error' in result);
    assert.match(result.error, /operation was already applied/);
  }
  const stale = { ...made.state, doc: { ...made.state.doc, instances: root(plate('west2', 10)).instances } };
  for (const action of [previewProposal, rebaseProposal, acceptProposal]) {
    const result = await action(stale, proposal.id, evaluate);
    assert.ok('error' in result);
    assert.match(result.error, /earlier revision.*new proposal/);
  }

  const preview = await previewProposal(made.state, proposal.id, evaluate);
  if ('error' in preview) assert.fail(preview.error);
  assert.equal(preview.doc.instances![1], sibling);
  const expected = plate('west2');
  const query = expected.requirements![0].check.query;
  assert.equal(query.fn, 'distance_between');
  if (query.fn === 'distance_between') query.a = newFace;
  assert.deepEqual(preview.doc.instances![0].doc.instances![0].doc, expected);
  const fresh = await requirementEvidenceOf(preview.doc, path, evaluate);
  if ('error' in fresh) assert.fail(fresh.error);
  assert.equal(fresh.evidence[0].result.verdict, 'pass');
  assert.equal(fresh.evidence[0].result.number, 12);
  const accepted = await acceptProposal(made.state, proposal.id, evaluate);
  if ('error' in accepted) assert.fail(accepted.error);
  assert.deepEqual(accepted.state.doc.instances, preview.doc.instances);
});
