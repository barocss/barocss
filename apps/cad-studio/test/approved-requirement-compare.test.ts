import assert from 'node:assert/strict';
import test from 'node:test';
import { PassThrough } from 'node:stream';
import { validate } from '@barocss/cad-model/chat/contract';
import { outputFile } from '@barocss/cad-model/chat/outputFile';
import { editNestedDefinition } from '@barocss/cad-model/chat/nestedParameterProposal';
import { acceptProposal, runTool } from '@barocss/cad-model/chat/tools';
import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { Op } from '@barocss/cad-model/engine/schema/proposals';
import type { Requirement } from '@barocss/cad-model/engine/schema/spec';
import { requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { nestedRequirementScope } from '@barocss/cad-model/team/requirementScope';
import { approvedRequirementComparison, compareApprovedRequirements as evidenceOf } from '@barocss/cad-model/versions/approvedRequirements';
import { approvalEvidenceFile, approvalEvidencePin } from '@barocss/cad-model/versions/approvalEvidenceReport';
import { applyBranch, makeBranch, makeVersion, makeVersions } from '@barocss/cad-model/versions/log';
import { requirementFollowUp } from '@barocss/cad-model/versions/requirementFollowUp';
import { bindSavedApproval, bindSavedFollowUp, readSavedApprovalEvidence, readSavedFollowUpEvidence, saveApprovalEvidence,
  saveFollowUpEvidence } from '../src/storage/savedApprovalEvidence';
import { memoryStore } from '../src/storage/memoryStore';
import { serveMcp } from '../server/cadMcp';
import { SELECTED_APPROVAL_EVIDENCE, SELECTED_FOLLOW_UP_REPAIR, readSelectedApprovalForTurn, selectedApprovalEvidenceTool,
  selectedApprovalForTurn } from '../server/selectedApprovalEvidence';
import { prepareSelectedFollowUpRepair } from '../server/selectedFollowUpRepair';
import { checkSavedFollowUpRepair } from '../src/storage/savedFollowUpRepair';

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

test('D651 keeps an exact saved approval once and refuses altered evidence without replacing it', async () => {
  const { pending, accepted } = await approve(nestedTwins, [nestedOp()]);
  const comparison = approvedRequirementComparison(pending, accepted);
  assert.ok(comparison?.nested);
  const evidence = await evidenceOf(comparison, 'p1/p1', evaluate);
  assert.ok(!('error' in evidence));
  const first = makeVersions(pending, { at: '2026-11-11T00:00:00Z' });
  const { version: to } = makeVersion(first, accepted, { at: '2026-11-11T00:01:00Z' });
  const store = memoryStore(), pair = { store, document: 'assembly.bcad', from: first.versions[0], to };
  const review = bindSavedApproval(pair, comparison, 'p1/p1');
  assert.equal(await readSavedApprovalEvidence(review), null);
  await Promise.all([saveApprovalEvidence(review, evidence), saveApprovalEvidence(review, evidence)]);
  const kept = await store.read(review.path);
  assert.ok(kept);
  assert.deepEqual(await readSavedApprovalEvidence(review), JSON.parse(JSON.stringify(evidence)));
  await saveApprovalEvidence(review, evidence);
  assert.deepEqual(await store.read(review.path), kept);
  const anotherFile = bindSavedApproval({ ...pair, document: 'copy.bcad' }, comparison, 'p1/p1');
  assert.equal(await readSavedApprovalEvidence(anotherFile), null);

  const original = approvalEvidenceFile(review.context, evidence);
  const reencode = (context = review.context, next = evidence) => approvalEvidenceFile(context, next);
  const altered = structuredClone(evidence);
  altered.before.evidence[0].result.run = to.id;
  const invalid = [
    { ...original, sha256: '0'.repeat(64) },
    reencode({ ...review.context, part: 'p2/p1' }),
    reencode(review.context, altered),
    reencode(review.context, { ...evidence, recoveries: [{ ...evidence.recoveries[0], from: 99 }] }),
  ];
  for (const artifact of invalid) {
    const bytes = new TextEncoder().encode(JSON.stringify(artifact));
    await store.write(review.path, bytes);
    assert.deepEqual(await readSavedApprovalEvidence(review), { error: 'Saved approval evidence does not match this review.' });
    await assert.rejects(saveApprovalEvidence(review, evidence), { code: 'STORAGE_CHANGED' });
    assert.deepEqual((await store.read(review.path))?.bytes, bytes);
  }
  await store.write(review.path, new Uint8Array());
  assert.equal(await readSavedApprovalEvidence(review), null);
  await saveApprovalEvidence(review, evidence);
  assert.deepEqual((await store.read(review.path))?.bytes, kept.bytes);
});

test('D653 and D654 retain a direct saved regression and admit only its exact attachment', async () => {
  const { pending, accepted } = await approve(nestedTwins, [nestedOp()]);
  const comparison = approvedRequirementComparison(pending, accepted);
  assert.ok(comparison?.nested);
  const part = 'p1/p1', operation = comparison.nested.ops[0];
  const approval = await evidenceOf(comparison, part, evaluate);
  assert.ok(!('error' in approval));
  const leaf = nestedRequirementScope(accepted, part);
  assert.ok(!('error' in leaf));
  const changed = editNestedDefinition(accepted, leaf, { ...leaf.leaf.doc, parameters: { ...leaf.leaf.doc.parameters, H: 12 } });
  assert.ok(!('error' in changed));
  const first = makeVersions(pending, { at: '2026-11-11T00:00:00Z' });
  const approved = makeVersion(first, accepted, { at: '2026-11-11T00:01:00Z' });
  const later = makeVersion(approved.log, changed.doc, { at: '2026-11-11T00:02:00Z' });
  const repaired = editNestedDefinition(accepted, leaf, { ...leaf.leaf.doc, parameters: { ...leaf.leaf.doc.parameters, H: 9 } });
  assert.ok(!('error' in repaired));
  const skipped = makeVersion(later.log, repaired.doc, { at: '2026-11-11T00:03:00Z' });
  const store = memoryStore();
  const review = bindSavedApproval({ store, document: 'assembly.bcad', from: first.versions[0], to: approved.version }, comparison, part);
  const source = bindSavedFollowUp(review, later.log, later.version, operation);
  assert.ok(source);
  assert.equal(bindSavedFollowUp(review, skipped.log, skipped.version, operation), null);
  const followUp = await requirementFollowUp(accepted, changed.doc, operation, part, ['H-CAP'], approval.after,
    source.version.evidenceRevision, evaluate);
  assert.ok(followUp.status === 'checked');
  assert.deepEqual(followUp.findings, [{ id: 'H-CAP', status: 'regressed' }]);
  await saveApprovalEvidence(review, approval);
  const pair = await store.read(review.path);
  await Promise.all([saveFollowUpEvidence(source, approval, followUp), saveFollowUpEvidence(source, approval, followUp)]);
  const retained = await store.read(source.path);
  assert.ok(retained);
  assert.deepEqual(await readSavedFollowUpEvidence(source), JSON.parse(JSON.stringify({ approval, followUp: { version: source.version, ...followUp } })));
  const attachment = JSON.parse(new TextDecoder().decode(retained.bytes));
  assert.deepEqual(await selectedApprovalForTurn(attachment, later.log), attachment);
  const selected = await readSelectedApprovalForTurn(attachment, later.log);
  assert.ok(selected?.repair);
  const evalState = await evaluate(changed.doc);
  assert.ok(evalState.ok);
  const evaluateRepair = (doc: StudioDoc) => prepareSelectedFollowUpRepair({ doc, bodies: evalState.bodies },
    { working_revision: requirementEvidenceRevision(doc) }, selected.repair!, evaluate);
  const genuine = await evaluateRepair(changed.doc);
  assert.equal(genuine.isError, false, genuine.content);
  assert.deepEqual(genuine.state.doc.instances, changed.doc.instances);
  const stale = await prepareSelectedFollowUpRepair({ doc: changed.doc, bodies: evalState.bodies },
    { working_revision: requirementEvidenceRevision(repaired.doc) }, selected.repair, evaluate);
  assert.equal(JSON.parse(stale.content).code, 'REPAIR_STALE');
  assert.equal(stale.state.doc, changed.doc);
  const passing = await evaluateRepair(repaired.doc);
  assert.equal(JSON.parse(passing.content).code, 'REPAIR_ALREADY_PASSING');
  assert.equal(passing.state.doc, repaired.doc);
  const displaced = { ...changed.doc, instances: changed.doc.instances!.map((instance, index) =>
    index === 1 ? { ...instance, position: [99, 0, 0] as [number, number, number] } : instance) };
  const rejected = await evaluateRepair(displaced);
  assert.equal(JSON.parse(rejected.content).code, 'REPAIR_SCOPE_CHANGED');
  assert.equal(rejected.state.doc, displaced);
  const floor: Requirement = { id: 'H-FLOOR', source: 'Minimum 11 mm', hard: true,
    check: { ...requirement.check, op: '>=', value: 11 } };
  const blocked = editNestedDefinition(accepted, leaf, { ...leaf.leaf.doc,
    parameters: { H: 12 }, requirements: [requirement, floor] });
  assert.ok(!('error' in blocked));
  const unsafe = await evaluateRepair(blocked.doc);
  assert.match(unsafe.content, /preserve the passing hard checks/);
  assert.equal(unsafe.state.doc, blocked.doc);
  assert.equal(await selectedApprovalForTurn(attachment, approved.log), undefined);
  assert.equal(await selectedApprovalForTurn(attachment, { ...later.log, snapshots: approved.log.snapshots }), undefined);
  const skippedPin = approvalEvidencePin(skipped.version, requirementEvidenceRevision(repaired.doc));
  const apparentRecovery = await requirementFollowUp(accepted, repaired.doc, operation, part, ['H-CAP'], approval.after,
    skippedPin.evidenceRevision, evaluate);
  assert.ok(apparentRecovery.status === 'checked');
  assert.deepEqual(apparentRecovery.findings, [{ id: 'H-CAP', status: 'passing' }]);
  const nonconsecutive = approvalEvidenceFile(review.context, approval, { version: skippedPin, ...apparentRecovery });
  assert.equal(await selectedApprovalForTurn(nonconsecutive, skipped.log), undefined);
  for (const invalid of [
    { ...followUp, version: { ...source.version, id: skipped.version.id } },
    { ...followUp, version: { ...source.version, snapshot: approved.version.snapshot } },
    { ...followUp, version: source.version, findings: [{ id: 'H-CAP', status: 'passing' as const }] },
    { ...followUp, version: source.version, status: 'unresolved' as const, reason: 'The check did not complete.' },
  ]) {
    const artifact = approvalEvidenceFile(review.context, approval, invalid);
    assert.equal(await selectedApprovalForTurn(artifact, skipped.log), undefined);
    const bytes = new TextEncoder().encode(JSON.stringify(artifact));
    await store.write(source.path, bytes);
    assert.deepEqual(await readSavedFollowUpEvidence(source), { error: 'Saved follow-up evidence does not match this review.' });
    await assert.rejects(saveFollowUpEvidence(source, approval, followUp), { code: 'STORAGE_CHANGED' });
    assert.deepEqual((await store.read(source.path))?.bytes, bytes);
    assert.deepEqual(await store.read(review.path), pair);
  }
  await store.write(review.path, retained.bytes);
  assert.deepEqual(await readSavedApprovalEvidence(review), { error: 'Saved approval evidence does not match this review.' });
});

test('D656 proves a later saved user repair on the same lineage, occurrence and authored criterion', async () => {
  const { pending, accepted } = await approve(nestedTwins, [nestedOp()]);
  const comparison = approvedRequirementComparison(pending, accepted), part = 'p1/p1';
  assert.ok(comparison?.nested);
  const operation = comparison.nested.ops[0], approval = await evidenceOf(comparison, part, evaluate);
  assert.ok(!('error' in approval));
  const scope = nestedRequirementScope(accepted, part);
  assert.ok(!('error' in scope));
  const at = (minute: number) => ({ at: `2026-11-11T00:0${minute}:00Z` });
  const edit = (H: number, criterion = requirement) => {
    const out = editNestedDefinition(accepted, scope, { ...scope.leaf.doc, parameters: { H }, requirements: [criterion] });
    assert.ok(!('error' in out));
    return out.doc;
  };
  const first = makeVersions(pending, at(0)), fixed = makeVersion(first, accepted, at(1));
  const failed = edit(12), savedFailure = makeVersion(fixed.log, failed, at(2)), store = memoryStore();
  const review = bindSavedApproval({ store, document: 'assembly.bcad', from: first.versions[0], to: fixed.version }, comparison, part);
  const source = bindSavedFollowUp(review, savedFailure.log, savedFailure.version, operation);
  assert.ok(source);
  const followUp = await requirementFollowUp(accepted, failed, operation, part, ['H-CAP'], approval.after, source.version.evidenceRevision, evaluate);
  assert.ok(followUp.status === 'checked');
  await saveFollowUpEvidence(source, approval, followUp);
  const original = await store.read(source.path);
  assert.ok(original);
  const artifact = JSON.parse(new TextDecoder().decode(original.bytes));
  const metadata = { evidence_sha256: artifact.sha256, part, version: savedFailure.version.id, requirements: ['H-CAP'] };
  const acceptLinked = async (base: StudioDoc, target = part, H = 10, follow_up_repair = metadata) => {
    const built = await evaluate(base);
    assert.ok(built.ok);
    const draft = await runTool({ doc: base, bodies: built.bodies }, 'propose',
      { title: 'Repair', ops: [{ tool: 'set_parameters', args: { part: target, set: { H } } }] }, evaluate);
    assert.ok(!draft.isError, draft.content);
    const proposal = draft.state.doc.proposals!.at(-1)!;
    const doc = { ...draft.state.doc, proposals: [...draft.state.doc.proposals!.slice(0, -1), { ...proposal, follow_up_repair }] };
    const result = await acceptProposal({ ...draft.state, doc }, proposal.id, evaluate);
    assert.ok('state' in result, JSON.stringify(result));
    return result.state.doc;
  };
  const newerFailure = edit(13), savedBase = makeVersion(savedFailure.log, newerFailure, at(3));
  const repaired = await acceptLinked(newerFailure), saved = makeVersion(savedBase.log, repaired, at(4));
  const verified = await checkSavedFollowUpRepair(source, saved.log, saved.version.id, evaluate);
  assert.ok(!('error' in verified) && !verified.saved);
  const recoveries = [{ id: 'H-CAP', from: 13, to: 10, unit: 'mm' }];
  assert.deepEqual(verified.recoveries, recoveries);
  const resultWithoutBase = makeVersion(savedFailure.log, repaired, at(4));
  const other = applyBranch(makeBranch(savedBase.log, 'separate', { from: fixed.version.id }), 'separate', newerFailure).log;
  const unrelated = makeVersion(other, repaired, at(4));
  const sibling = makeVersion(savedBase.log, await acceptLinked(newerFailure, 'p2/p1'), at(4));
  const wrongValue = makeVersion(savedBase.log, await acceptLinked(newerFailure, part, 9), at(4));
  const wrongFile = makeVersion(savedBase.log, await acceptLinked(newerFailure, part, 10, { ...metadata, evidence_sha256: 'f'.repeat(64) }), at(4));
  const revised = edit(13, { ...requirement, check: { ...requirement.check, value: 11 } });
  const revisedBase = makeVersion(savedFailure.log, revised, at(3));
  const revisedRepair = makeVersion(revisedBase.log, await acceptLinked(revised), at(4));
  for (const refusal of [resultWithoutBase, unrelated, sibling, wrongValue, wrongFile, revisedRepair]) {
    const result = await checkSavedFollowUpRepair(source, refusal.log, refusal.version.id, evaluate);
    assert.ok('error' in result, refusal.version.id);
  }
  assert.ok('error' in await checkSavedFollowUpRepair(source, saved.log, saved.version.id, async () => null));
  assert.deepEqual(await store.read(source.path), original);
  const proofPath = source.path.replace(/\.json$/, `-repair-${saved.version.id}.json`);
  assert.equal(await store.read(proofPath), null);
  await Promise.all([verified.saveEvidence(), verified.saveEvidence()]);
  const kept = await store.read(proofPath);
  assert.ok(kept);
  const never = async () => assert.fail('A retained repair check must not evaluate geometry.');
  const read = () => checkSavedFollowUpRepair(source, saved.log, saved.version.id, never);
  assert.deepEqual(await read(), { version: saved.version, proposal: 'P2', recoveries, saved: true });
  const repairFile = JSON.parse(new TextDecoder().decode(kept.bytes)), report = JSON.parse(repairFile.text);
  assert.deepEqual([report.context.followUp.id, report.context.base.id, report.context.repaired.id],
    [savedFailure.version.id, savedBase.version.id, saved.version.id]);
  const changedBase = { ...report, context: { ...report.context, base: { ...report.context.base, id: savedFailure.version.id } } };
  const changedRun = structuredClone(report);
  changedRun.after.evidence[0].result.run = report.context.base.evidenceRevision;
  const changedVerdict = structuredClone(report);
  changedVerdict.after.evidence[0].result.verdict = 'fail';
  const changedCriterion = structuredClone(report);
  changedCriterion.after.evidence[0].requirement.check.value = 15;
  for (const other of [changedBase, changedRun, changedVerdict, changedCriterion]) {
    const bytes = new TextEncoder().encode(JSON.stringify(outputFile(repairFile.path, repairFile.mime, JSON.stringify(other))));
    await store.write(proofPath, bytes);
    assert.deepEqual(await read(), { error: 'Saved repair evidence does not match this review.' });
    await assert.rejects(verified.saveEvidence(), { code: 'STORAGE_CHANGED' });
    assert.deepEqual((await store.read(proofPath))?.bytes, bytes);
  }
  await store.write(proofPath, kept.bytes);
  await store.write(source.path, new Uint8Array());
  assert.deepEqual(await read(), { error: 'Saved follow-up evidence does not match this review.' });
  await assert.rejects(verified.saveEvidence(), /Saved follow-up evidence does not match/);
  await store.write(source.path, original.bytes);
  assert.deepEqual((await store.read(proofPath))?.bytes, kept.bytes);
  assert.deepEqual(await read(), { version: saved.version, proposal: 'P2', recoveries, saved: true });
});

test('D652 lists the read-only tool only for a retained approval bound to the turn snapshots', async () => {
  const { pending, accepted } = await approve(nestedTwins, [nestedOp()]);
  const comparison = approvedRequirementComparison(pending, accepted);
  assert.ok(comparison?.nested);
  const evidence = await evidenceOf(comparison, 'p1/p1', evaluate);
  assert.ok(!('error' in evidence));
  const first = makeVersions(pending, { at: '2026-11-11T00:00:00Z' });
  const { log, version: to } = makeVersion(first, accepted, { at: '2026-11-11T00:01:00Z' });
  const review = bindSavedApproval({ store: memoryStore(), document: 'assembly.bcad', from: first.versions[0], to }, comparison, 'p1/p1');
  const file = approvalEvidenceFile(review.context, evidence);
  const selectedApproval = await selectedApprovalForTurn(file, log);
  assert.deepEqual(selectedApproval, file);
  assert.ok(selectedApproval);
  const mcp = async (versions: typeof log) => {
    const input = new PassThrough(), output = new PassThrough();
    let wire = '';
    output.setEncoding('utf8').on('data', chunk => { wire += chunk; });
    const served = serveMcp({
      open: async () => ({ doc: pending, versions, selectedApproval, changed: false, version: 0 }),
      save: () => assert.fail('The approval tool must not write the model or versions'),
    }, input, output);
    input.end([
      { id: 1, method: 'tools/list' },
      { id: 2, method: 'tools/call', params: { name: SELECTED_APPROVAL_EVIDENCE, arguments: {} } },
    ].map(message => JSON.stringify({ jsonrpc: '2.0', ...message })).join('\n') + '\n');
    await served;
    return wire.trim().split('\n').map(line => JSON.parse(line));
  };
  const [listed, read] = await mcp(log);
  assert.deepEqual(listed.result.tools.at(-1), selectedApprovalEvidenceTool);
  assert.ok(listed.result.tools.every((entry: { name: string }) => entry.name !== SELECTED_FOLLOW_UP_REPAIR));
  assert.deepEqual(read.result.structuredContent, { file });
  assert.deepEqual(read.result.structuredContent, JSON.parse(read.result.content[0].text));
  assert.deepEqual(validate(selectedApprovalEvidenceTool.outputSchema, read.result.structuredContent), []);
  const [unlisted, refused] = await mcp({ ...log, snapshots: {} });
  assert.ok(unlisted.result.tools.every((entry: { name: string }) => entry.name !== SELECTED_APPROVAL_EVIDENCE));
  assert.equal(refused.error.code, -32602);
});

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
