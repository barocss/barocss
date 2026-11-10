import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptProposal, runTool } from '@barocss/cad-model/chat/tools';
import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { Op } from '@barocss/cad-model/engine/schema/proposals';
import type { Requirement } from '@barocss/cad-model/engine/schema/spec';
import { requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { approvedRequirementComparison, compareApprovedRequirements as evidenceOf } from '@barocss/cad-model/versions/approvedRequirements';

const requirement: Requirement = { id: 'H-CAP', source: 'Maximum 10 mm', hard: true,
  check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 10, unit: 'mm' } };
const plate = { ...rectanglePart(20, 10, 11), requirements: [requirement] };
const twins: StudioDoc = { ...emptyDoc(), instances: [
  { id: 'p1', name: 'Target', doc: plate, position: [0, 0, 0], rotation: [0, 0, 0] },
  { id: 'p2', name: 'Control', doc: plate, position: [40, 0, 0], rotation: [0, 0, 0] },
] };
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function compareApprovedRequirements(...args: Parameters<typeof evidenceOf>) {
  const result = await evidenceOf(...args);
  return 'error' in result ? result : { recoveries: result.recoveries, changed: result.changed };
}

async function approve(doc: StudioDoc, ops: Op[], agent = 'user') {
  const start = await evaluate(doc);
  assert.ok(start.ok);
  const proposed = await runTool({ doc, bodies: start.bodies }, 'propose', { title: 'Correction', ops }, evaluate);
  assert.equal(proposed.isError, false, proposed.content);
  const accepted = await acceptProposal(proposed.state, 'P1', evaluate, { by: { agent } });
  assert.ok('state' in accepted, JSON.stringify(accepted));
  return { pending: proposed.state.doc, accepted: accepted.state.doc };
}

test('exact user acceptance links only the same occurrence and criterion', async () => {
  const { pending, accepted } = await approve(twins, [{ tool: 'edit_feature', args: { part: 'p1', index: 1, values: { h: 10 } } }]);
  const pair = approvedRequirementComparison(twins, accepted);
  assert.ok(pair);
  assert.equal(pair.proposal, 'P1');
  assert.deepEqual(await compareApprovedRequirements(pair, 'p1', evaluate), { recoveries: [{ id: 'H-CAP', from: 11, to: 10, unit: 'mm' }], changed: [] });
  assert.deepEqual(await compareApprovedRequirements(pair, 'p2', evaluate), { recoveries: [], changed: [] });
  const unavailable = await compareApprovedRequirements(pair, 'missing', evaluate);
  assert.ok('error' in unavailable);

  const unapproved = { ...accepted, proposals: pending.proposals, history: pending.history };
  const later = { ...accepted, instances: accepted.instances!.map(inst => inst.id === 'p2' ? { ...inst, position: [45, 0, 0] as [number, number, number] } : inst) };
  for (const current of [unapproved, later, { ...accepted, history: [...accepted.history!, accepted.history!.at(-1)!] },
    { ...accepted, proposals: [...accepted.proposals!, accepted.proposals![0]] },
    { ...accepted, history: accepted.history!.map(entry => ({ ...entry, at: '2000-01-01T00:00:00.000Z' })) }]) {
    assert.equal(approvedRequirementComparison(twins, current), null);
  }
  assert.equal(approvedRequirementComparison(accepted, accepted), null);
  assert.equal(approvedRequirementComparison(plate, accepted), null);
});

test('approval that relaxes a requirement is a criterion change, even if the new result passes', async () => {
  const changed = { ...requirement, check: { ...requirement.check, value: 11 } };
  const { accepted } = await approve(plate, [{ tool: 'set_requirements', args: { requirements: [changed] } }]);
  const pair = approvedRequirementComparison(plate, accepted);
  assert.ok(pair);
  assert.deepEqual(await compareApprovedRequirements(pair, 'base', evaluate), { recoveries: [], changed: [{
    id: 'H-CAP', kind: 'changed', priorFailure: { measured: 11, unit: 'mm', expected: '<= 10 mm' }, criterion: '<= 11 mm',
  }] });
});

test('withdrawing the final criterion preserves its failure and pins the empty revision', async () => {
  const { accepted } = await approve(plate, [{ tool: 'set_requirements', args: { requirements: [], replace: true } }]);
  const pair = approvedRequirementComparison(plate, accepted);
  assert.ok(pair);
  assert.deepEqual(await compareApprovedRequirements(pair, 'base', evaluate), { recoveries: [], changed: [{
    id: 'H-CAP', kind: 'withdrawn', priorFailure: { measured: 11, unit: 'mm', expected: '<= 10 mm' },
  }] });
  const moved = { ...pair, after: { ...pair.after, parameters: { H: 12 } } };
  assert.ok('error' in await compareApprovedRequirements(moved, 'base', evaluate));
});

test('agent acceptance does not supply a user decision', async () => {
  const { accepted } = await approve(plate, [{ tool: 'edit_feature', args: { index: 1, values: { h: 10 } } }], 'chat');
  assert.equal(approvedRequirementComparison(plate, accepted), null);
});

test('reusing a deleted occurrence ID does not link the replacement to the old failure', async () => {
  const { accepted } = await approve(twins, [
    { tool: 'delete_part', args: { part: 'p1' } },
    { tool: 'add_part', args: { name: 'Target', copy_of: 'p2' } },
    { tool: 'edit_feature', args: { part: 'p1', index: 1, values: { h: 10 } } },
  ]);
  const replacement = accepted.instances?.find(inst => inst.id === 'p1');
  assert.equal(replacement?.name, 'Target');
  assert.equal(replacement?.part, undefined);
  assert.deepEqual(replacement?.doc.requirements, [requirement]);
  assert.equal(approvedRequirementComparison(twins, accepted), null);
});

const nestedPlate: StudioDoc = {
  ...plate, parameters: { H: 11 }, nodes: plate.nodes.map(node => node.kind === 'extrude' ? { ...node, height: { parameter: 'H' } } : node),
};
const nestedTwins: StudioDoc = { ...emptyDoc(), instances: twins.instances!.map((instance, index) => ({
  ...instance, name: index === 0 ? 'Left module' : 'Right module', part: { id: 'host' + index, rev: 'A' },
  doc: { ...emptyDoc(), instances: [{ ...twins.instances![0], doc: nestedPlate }] },
})) };
const nestedOp = (part = 'p1/p1'): Op => ({ tool: 'features', args: { action: 'parameters', part, set: { H: 10 } } });

test('historical nested approval replays only its recorded path and retains the original failure', async () => {
  const { pending, accepted } = await approve(nestedTwins, [nestedOp()]);
  for (const before of [nestedTwins, pending]) {
    const pair = approvedRequirementComparison(before, accepted);
    assert.ok(pair);
    assert.deepEqual(pair.scopes, [{ id: 'p1/p1', label: 'Left module › Target' }]);
    const first = JSON.stringify(before), last = JSON.stringify(accepted);
    assert.deepEqual(await compareApprovedRequirements(pair, 'p1/p1', evaluate), {
      recoveries: [{ id: 'H-CAP', from: 11, to: 10, unit: 'mm' }], changed: [],
    });
    assert.deepEqual([JSON.stringify(before), JSON.stringify(accepted)], [first, last]);
    const sibling = await compareApprovedRequirements(pair, 'p2/p1', async () => assert.fail('Must not evaluate a sibling'));
    assert.ok('error' in sibling);
  }
  const unrelated = { ...pending, proposals: pending.proposals!.map(proposal => ({ ...proposal, ops: [nestedOp('p2/p1')] })) };
  assert.equal(approvedRequirementComparison(unrelated, accepted), null);
  const later = { ...accepted, parameters: { later: 2 } };
  assert.equal(approvedRequirementComparison(pending, later), null);
});

test('matching approval metadata cannot relabel a replacement or unrelated operation as a repair', async () => {
  const { accepted } = await approve(nestedTwins, [nestedOp()]);
  const incorrect = structuredClone(accepted);
  const leaf = incorrect.instances![0].doc.instances![0].doc;
  leaf.nodes = leaf.nodes.map(node => node.kind === 'sketch' && node.profile === 'rectangle'
    ? { ...node, max: [25, 10] } : node);
  const forgedAfter = requirementEvidenceRevision(incorrect);
  incorrect.history!.at(-1)!.evidence_revisions!.after = forgedAfter;
  incorrect.proposals![0].decided!.evidence_revisions!.after = forgedAfter;
  const reused = approvedRequirementComparison(nestedTwins, incorrect);
  assert.ok(reused);
  const replay = await compareApprovedRequirements(reused, 'p1/p1', evaluate);
  assert.ok('error' in replay);
  assert.match(replay.error, /does not reproduce the saved revision/);

  const unrelated = { ...accepted, proposals: accepted.proposals!.map(proposal => ({ ...proposal, ops: [nestedOp('p2/p1')] })) };
  const wrongPart = approvedRequirementComparison(nestedTwins, unrelated);
  assert.ok(wrongPart);
  const wrongReplay = await compareApprovedRequirements(wrongPart, 'p2/p1', evaluate);
  assert.ok('error' in wrongReplay);
  assert.match(wrongReplay.error, /does not reproduce the saved revision/);

  const malformed: StudioDoc = JSON.parse(JSON.stringify(accepted));
  const [record] = malformed.proposals!;
  for (const tool of ['constructor', '__proto__', 'toString']) {
    record.ops = [{ tool, args: nestedOp().args }];
    assert.equal(approvedRequirementComparison(nestedTwins, malformed), null);
  }
  const nullOp: StudioDoc = JSON.parse(JSON.stringify(accepted).replace('"ops":[', '"ops":[null,'));
  assert.equal(approvedRequirementComparison(nestedTwins, nullOp), null);
  for (const invalid of [{ history: {} }, { proposals: {} }, { history: [null] }, { proposals: [null] }]) {
    const bad = JSON.parse(JSON.stringify({ ...accepted, ...invalid }));
    assert.equal(approvedRequirementComparison(nestedTwins, bad), null);
  }
  const wrongHash = structuredClone(accepted);
  wrongHash.history!.at(-1)!.model_hash = 'forged';
  wrongHash.proposals![0].decided!.model_hash = 'forged';
  assert.equal(approvedRequirementComparison(nestedTwins, wrongHash), null);

  const stale = { ...reused, after: accepted };
  const refused = await compareApprovedRequirements(stale, 'p1/p1', async () => assert.fail('Must not evaluate a stale comparison'));
  assert.ok('error' in refused);
  assert.match(refused.error, /approval revision changed/i);
});
