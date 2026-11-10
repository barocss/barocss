import assert from 'node:assert/strict';
import test from 'node:test';
import { outputSchemaOf, validate } from '../src/chat/contract';
import { runTool, type Evaluate } from '../src/chat/tools';
import { evaluateDoc } from '../src/engine/evaluate';
import { requirementEvidenceRevision, sha256Hex } from '../src/util/digest';
import { turnLog } from '../src/versions/log';
import { savedApprovalFixture } from './helpers/saved-approval';

const evaluate: Evaluate = async doc => evaluateDoc(doc, 1);

test('saved approval reports preserve exact pins, original failure and approved check without reading working geometry', async () => {
  const { before, after, state, args } = await savedApprovalFixture();
  const original = JSON.stringify(state);
  const out = await runTool(state, 'history', args, evaluate);
  assert.equal(out.isError, false, out.content);
  assert.equal(out.changed, false);
  assert.equal(out.state.doc, state.doc);
  assert.equal(out.state.versions, state.versions);
  assert.equal(JSON.stringify(state), original);
  const body = JSON.parse(out.content);
  assert.deepEqual(validate(outputSchemaOf('approved_requirement_evidence')!, body), []);
  const [file] = body.files;
  assert.equal(file.path, 'approved-requirement-evidence.json');
  assert.equal(file.sha256, sha256Hex(new TextEncoder().encode(file.text)));
  assert.equal(file.bytes, Buffer.byteLength(file.text));
  const report = JSON.parse(file.text);
  const [first, accepted] = state.versions.versions;
  assert.deepEqual(report.from, { id: first.id, snapshot: first.snapshot, revision: first.revision, evidenceRevision: requirementEvidenceRevision(before) });
  assert.deepEqual(report.to, { id: accepted.id, snapshot: accepted.snapshot, revision: accepted.revision, evidenceRevision: requirementEvidenceRevision(after) });
  assert.deepEqual([report.format, report.version, report.part, report.proposal], ['barocss-approved-requirement-evidence', 1, 'p1/p1', 'P1']);
  assert.deepEqual(report.recoveries, [{ id: 'HEIGHT', from: 6, to: 4, unit: 'mm' }]);
  assert.deepEqual(report.before.evidence[0].requirement, report.after.evidence[0].requirement);
  assert.deepEqual([report.before.evidence[0].result.verdict, report.after.evidence[0].result.verdict], ['fail', 'pass']);
  assert.equal(state.doc.instances[0].doc.instances![0].doc.parameters.H, 8);
});

test('an unloaded pair asks for both IDs without evaluating or moving the log', async () => {
  const { state, args } = await savedApprovalFixture();
  const loaded = turnLog(state.versions).log;
  const warm = turnLog(state.versions, { wanted: [args.from] }).log;
  for (const [versions, missing] of [[loaded, [args.from, args.to]], [warm, [args.to]]] as const) {
    const out = await runTool({ ...state, versions }, 'history', args, async () => assert.fail('A missing snapshot must not be evaluated'));
    assert.equal(out.isError, true);
    assert.equal(out.state.versions, versions);
    assert.equal(out.changed, false);
    const refusal = JSON.parse(out.content);
    assert.equal(refusal.code, 'VERSION_NOT_LOADED');
    assert.deepEqual(refusal.wanted, [args.from, args.to]);
    assert.deepEqual(refusal.missing, missing);
    assert.equal(refusal.files, undefined);
  }
});

test('aliases, duplicate identities, wrong paths, unrelated saved approvals and corrupted snapshots refuse', async () => {
  const { state, args, working } = await savedApprovalFixture();
  const alias = { ...state.versions.versions[2], name: args.from };
  const duplicate = { ...state, versions: { ...state.versions, versions: [...state.versions.versions.slice(0, 2), alias] } };
  const version = state.versions.versions[0];
  const damaged = { ...state, versions: { ...state.versions, snapshots: { ...state.versions.snapshots, [version.snapshot]: state.doc } } };
  for (const [start, input, reason] of [
    [state, { ...args, to: 'current' }, /distinct saved version IDs/],
    [state, { ...args, part: 'p1//p1' }, /exact nested leaf/],
    [state, { ...args, from: args.to }, /distinct saved version IDs/],
    [state, { ...args, to: working.id }, /no.*matching nested approval/],
    [state, { ...args, part: 'p2/p1' }, /cannot be matched/],
    [duplicate, args, /unique versions/],
    [damaged, args, /VERSION_LOG/],
  ] as const) {
    const out = await runTool(start, 'history', input, async () => assert.fail('Refuse before evaluation'));
    assert.equal(out.isError, true);
    assert.equal(out.changed, false);
    const refusal = JSON.parse(out.content);
    assert.match(refusal.error, reason);
    assert.equal(refusal.files, undefined);
  }
});
