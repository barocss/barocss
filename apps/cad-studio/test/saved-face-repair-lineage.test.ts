import assert from 'node:assert/strict';
import test from 'node:test';
import { identifyNestedFaceRepair } from '@barocss/cad-model/chat/nestedFaceRepair';
import { editNestedDefinition } from '@barocss/cad-model/chat/nestedParameterProposal';
import { modelHash } from '@barocss/cad-model/chat/spec';
import { outputFile } from '@barocss/cad-model/chat/outputFile';
import { acceptProposal, proposeNestedFaceReferenceRepair, runTool, type Evaluate } from '@barocss/cad-model/chat/tools';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { nestedRequirementScope } from '@barocss/cad-model/team/requirementScope';
import { digestOf, requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { approvedRequirementComparison, compareApprovedRequirements } from '@barocss/cad-model/versions/approvedRequirements';
import { applyBranch, makeBranch, makeVersion, makeVersions, readVersion } from '@barocss/cad-model/versions/log';
import { memoryStore } from '../src/storage/memoryStore';
import { bindSavedApproval, readSavedApprovalArtifact, saveApprovalEvidence } from '../src/storage/savedApprovalEvidence';
import { readSelectedApprovalForTurn } from '../server/selectedApprovalEvidence';
import { checkSavedFaceRepair, readSavedFaceRepairAttachment } from '../src/storage/checkSavedFaceRepair';

const part = 'p1/p1', requirement = 'WIDTH', oldFace = 'n1.side[west]', newFace = 'n1.side[west2]';
const at = (minute: number) => ({ at: `2026-11-11T00:0${minute}:00Z` });
const evaluate: Evaluate = async doc => evaluateDoc(doc, 1);
const never: Evaluate = async () => assert.fail('Saved lineage must not evaluate geometry.');
const encoder = new TextEncoder(), decoder = new TextDecoder();
function assembly(doc: StudioDoc): StudioDoc {
  return { ...emptyDoc(), instances: [{ id: 'p1', name: 'Plate', doc, position: [0, 0, 0], rotation: [0, 0, 0] }] };
}
const plate: StudioDoc = {
  ...emptyDoc(), parameters: { W: 14 }, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'polygon',
      points: [[0, 0], [{ parameter: 'W' }, 0], [{ parameter: 'W' }, 8], [0, 8]],
      sideTags: { outer: ['south', 'east', 'north', 'west'] } },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 4 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
  requirements: [{ id: requirement, source: '12 mm between named sides', hard: true,
    check: { query: { fn: 'distance_between', a: oldFace, b: 'n1.side[east]' }, op: '==', value: 12, unit: 'mm' } }],
};

async function fixture() {
  const doc = assembly(assembly(plate));
  const made = await runTool({ doc, bodies: [] }, 'propose', { title: 'Correct the width',
    ops: [{ tool: 'set_parameters', args: { part, set: { W: 12 } } }] }, evaluate);
  assert.equal(made.isError, false, made.content);
  const width = await acceptProposal(made.state, 'P1', evaluate);
  if ('error' in width) assert.fail(width.error);
  const approved = width.state.doc;
  const pair = approvedRequirementComparison(made.state.doc, approved);
  assert.ok(pair);
  const evidence = await compareApprovedRequirements(pair, part, evaluate);
  assert.ok(!('error' in evidence) && evidence.after);
  const first = makeVersions(made.state.doc, at(0)), original = makeVersion(first, approved, at(1));
  const store = memoryStore();
  const review = bindSavedApproval({ store, document: 'assembly.bcad', from: first.versions[0], to: original.version }, pair, part);
  await saveApprovalEvidence(review, evidence);
  const retained = await readSavedApprovalArtifact(review);
  assert.ok(retained && 'evidence' in retained);
  const scope = nestedRequirementScope(approved, part);
  if ('error' in scope) assert.fail(scope.error);
  const leaf = scope.leaf.doc, [sketch, extrude] = leaf.nodes;
  assert.equal(sketch.kind, 'sketch');
  const rename = editNestedDefinition(approved, scope, { ...leaf, nodes: [
    { ...sketch, sideTags: { outer: ['south', 'east', 'north', 'west2'] } }, extrude,
  ] });
  if ('error' in rename) assert.fail(rename.error);
  const broken = makeVersion(original.log, rename.doc, at(2));
  const repair = identifyNestedFaceRepair(approved, rename.doc, evidence.after, requirement, {
    version: original.version.id, evidenceRevision: evidence.after.revision, sha256: retained.file.sha256,
  });
  assert.ok(repair);
  const proposed = await proposeNestedFaceReferenceRepair({ doc: rename.doc, bodies: [] }, repair, evaluate);
  assert.equal(proposed.isError, false, proposed.content);
  const accepted = await acceptProposal(proposed.state, 'P2', evaluate);
  if ('error' in accepted) assert.fail(accepted.error);
  const fixed = makeVersion(broken.log, accepted.state.doc, at(3));
  return { store, review, original, broken, fixed, repaired: accepted.state.doc };
}

test('save and reopen both face results with exact version and criterion pins', async () => {
  const { store, review, broken, fixed } = await fixture();
  const approvalFile = await store.read(review.path);
  const read = (use: Evaluate) => checkSavedFaceRepair(review, fixed.log, broken.version.id, fixed.version.id, requirement, use);
  const result = await read(evaluate);
  assert.ok(!('error' in result) && !result.saved);
  await Promise.all([result.saveEvidence(), result.saveEvidence()]);
  assert.deepEqual(await read(never), { saved: true, base: broken.version, target: fixed.version, proposal: 'P2',
    requirement, from: oldFace, to: newFace, measured: 12, unit: 'mm' });
  const path = review.path.replace(/\.json$/, `-face-${fixed.version.id}-${digestOf(requirement)}.json`);
  const kept = await store.read(path);
  assert.ok(kept);
  const file = JSON.parse(decoder.decode(kept.bytes)), report = JSON.parse(file.text);
  assert.deepEqual([report.before.evidence[0].result.status, report.before.evidence[0].result.number,
    report.after.evidence[0].result.verdict, report.after.evidence[0].result.number], ['unsupported', null, 'pass', 12]);
  assert.equal(report.context.repair.from, oldFace);
  assert.equal(report.context.repair.to, newFace);
  for (const tamper of [
    (r: typeof report) => { r.context.base.id = fixed.version.id; },
    (r: typeof report) => { r.before.evidence[0].result.why = 'no face or edge named "something else"'; },
    (r: typeof report) => { r.after.evidence[0].result.run = r.context.base.evidenceRevision; },
    (r: typeof report) => { r.after.evidence[0].result.number = 8; },
    (r: typeof report) => { r.after.evidence[0].requirement.check.value = 8; },
  ]) {
    const changed = structuredClone(report);
    tamper(changed);
    const bytes = encoder.encode(JSON.stringify(outputFile(file.path, file.mime, JSON.stringify(changed))));
    await store.write(path, bytes);
    assert.match(JSON.stringify(await read(never)), /does not match this review/);
    await assert.rejects(result.saveEvidence(), { code: 'STORAGE_CHANGED' });
    assert.deepEqual((await store.read(path))?.bytes, bytes);
  }
  assert.deepEqual(await store.read(review.path), approvalFile);
  await store.write(path, kept.bytes);
  await store.remove(review.path);
  assert.ok('error' in await read(never));
  await assert.rejects(result.saveEvidence(), /does not match this review/);
});

test('refuse unrelated saves, rejected proposals, and reuse of an old decision on edited criteria', async () => {
  const { review, original, broken, fixed, repaired } = await fixture();
  const elsewhere = applyBranch(makeBranch(broken.log, 'separate', { from: original.version.id }), 'separate', readVersion(broken.log, broken.version.id)).log;
  const unrelated = makeVersion(elsewhere, repaired, at(3));
  const rejected = structuredClone(repaired);
  rejected.proposals!.at(-1)!.status = 'rejected';
  const savedRejection = makeVersion(broken.log, rejected, at(3));
  const changed = structuredClone(repaired);
  changed.instances![0].doc.instances![0].doc.requirements![0].check.value = 15;
  const savedCriterion = makeVersion(broken.log, changed, at(3));

  // Even matching decision pins cannot make a changed tolerance part of the face replacement.
  const forged = structuredClone(changed), proposal = forged.proposals!.at(-1)!, entry = forged.history!.at(-1)!;
  const after = requirementEvidenceRevision(forged), hash = modelHash(forged);
  proposal.decided = { ...proposal.decided!, evidence_revisions: { ...proposal.decided!.evidence_revisions!, after }, model_hash: hash };
  entry.evidence_revisions = { ...entry.evidence_revisions!, after };
  entry.model_hash = hash;
  const savedForgery = makeVersion(broken.log, forged, at(3));

  for (const candidate of [unrelated, savedRejection, savedCriterion, savedForgery, broken]) {
    const result = await checkSavedFaceRepair(review, candidate.log, broken.version.id, candidate.version.id, requirement, never);
    assert.match(JSON.stringify(result), /No matching face repair approval/);
  }
  const wrongId = await checkSavedFaceRepair(review, fixed.log, broken.version.id, fixed.version.id, 'OTHER', never);
  assert.match(JSON.stringify(wrongId), /No matching face repair approval/);
});

test('an attached face repair needs both retained reports and all four exact saved snapshots', async () => {
  const { store, review, broken, fixed } = await fixture();
  const source = { kind: 'face-repair' as const, review, log: fixed.log, baseId: broken.version.id, targetId: fixed.version.id, requirement };
  assert.equal(await readSavedFaceRepairAttachment(source), null);
  const checked = await checkSavedFaceRepair(review, fixed.log, source.baseId, source.targetId, requirement, evaluate);
  assert.ok(!('error' in checked) && !checked.saved);
  await checked.saveEvidence();
  const attached = await readSavedFaceRepairAttachment(source);
  assert.ok(attached);
  const { payload, pins } = attached;
  assert.equal(attached.part, part);
  assert.deepEqual(pins.map(pin => pin.id), fixed.log.versions.map(version => version.id));
  assert.deepEqual(pins.map(pin => pin.snapshot), fixed.log.versions.map(version => version.snapshot));
  assert.deepEqual(await readSelectedApprovalForTurn(payload, fixed.log), { file: payload.file, payload });
  assert.equal(await readSelectedApprovalForTurn(payload.file, fixed.log), undefined);
  assert.equal(await readSelectedApprovalForTurn(undefined, fixed.log), undefined);

  for (const { snapshot } of fixed.log.versions) {
    const snapshots = { ...fixed.log.snapshots };
    delete snapshots[snapshot];
    assert.equal(await readSelectedApprovalForTurn(payload, { ...fixed.log, snapshots }), undefined);
  }
  const report = JSON.parse(payload.file.text);
  for (const alter of [
    (r: typeof report) => { r.context.approval.part = 'p2/p1'; },
    (r: typeof report) => { r.context.repair.criterion = 'a'.repeat(64); },
    (r: typeof report) => { r.context.repaired.evidenceRevision = r.context.base.evidenceRevision; },
    (r: typeof report) => { r.before.evidence[0].result.status = 'ok'; r.before.evidence[0].result.verdict = 'pass'; r.before.evidence[0].result.number = 12; },
    (r: typeof report) => { r.after.evidence[0].result.verdict = 'fail'; },
    (r: typeof report) => { r.note = 'Unexpected report field'; },
  ]) {
    const changed = structuredClone(report);
    alter(changed);
    const file = outputFile(payload.file.path, payload.file.mime, JSON.stringify(changed));
    assert.equal(await readSelectedApprovalForTurn({ ...payload, file }, fixed.log), undefined);
  }
  assert.equal(await readSelectedApprovalForTurn({ ...payload, approval: { ...payload.approval, sha256: '0'.repeat(64) } }, fixed.log), undefined);
  await store.remove(review.path);
  assert.equal(await readSavedFaceRepairAttachment(source), null);
});
