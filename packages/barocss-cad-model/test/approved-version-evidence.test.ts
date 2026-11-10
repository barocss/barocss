import assert from 'node:assert/strict';
import test from 'node:test';
import { outputSchemaOf, validate } from '../src/chat/contract';
import { runTool, type Evaluate } from '../src/chat/tools';
import type { StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { requirementEvidenceRevision, sha256Hex } from '../src/util/digest';
import { idOf, makeBranch, makeVersion, turnLog } from '../src/versions/log';
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

test('the saved follow-up keeps the historic recovery and compares the third pin independently of working state', async () => {
  const { before, state, args, working } = await savedApprovalFixture();
  const input = { ...args, later: working.id };
  const current = { ...state, doc: before };
  const out = await runTool(current, 'history', input, evaluate);
  assert.equal(out.isError, false, out.content);
  assert.equal(out.changed, false);
  assert.equal(out.state.doc, current.doc);
  assert.equal(out.state.versions, current.versions);
  const report = JSON.parse(JSON.parse(out.content).files[0].text);
  assert.deepEqual(report.recoveries, [{ id: 'HEIGHT', from: 6, to: 4, unit: 'mm' }]);
  assert.deepEqual(report.followUp.version, { id: working.id, snapshot: working.snapshot, revision: working.revision,
    evidenceRevision: requirementEvidenceRevision(state.doc) });
  assert.deepEqual(report.followUp.findings, [{ id: 'HEIGHT', status: 'regressed' }]);
  assert.deepEqual([report.followUp.evidence.evidence[0].result.number, report.followUp.evidence.evidence[0].result.run],
    [8, report.followUp.version.evidenceRevision]);
  const unavailable = await runTool(current, 'history', input, async doc => doc.parameters.H === 8 ? null : evaluate(doc));
  const unverified = JSON.parse(JSON.parse(unavailable.content).files[0].text);
  assert.deepEqual(unverified.recoveries, report.recoveries);
  assert.deepEqual(unverified.followUp.findings, [{ id: 'HEIGHT', status: 'unresolved' }]);
  const rejected = await runTool(current, 'history', input, async doc => {
    if (doc.parameters.H === 8) throw new Error('Later-only evaluation failure');
    return evaluate(doc);
  });
  assert.equal(rejected.isError, false, rejected.content);
  const failedRead = JSON.parse(JSON.parse(rejected.content).files[0].text);
  assert.deepEqual(failedRead.recoveries, report.recoveries);
  assert.equal(failedRead.followUp.reason, 'The later requirement evaluation failed.');
  assert.deepEqual(failedRead.followUp.findings, [{ id: 'HEIGHT', status: 'unresolved' }]);

  const noSnapshots = { ...state.versions, snapshots: {} };
  const missing = await runTool({ ...state, versions: noSnapshots }, 'history', input, async () => assert.fail('No snapshots to evaluate'));
  assert.deepEqual(JSON.parse(missing.content).wanted, [args.from, args.to, working.id]);
  assert.deepEqual(JSON.parse(missing.content).missing, [args.from, args.to, working.id]);
});

test('changed, withdrawn, missing and replaced scopes never inherit the approved pass', async () => {
  const { after, state, args } = await savedApprovalFixture();
  const log = { ...state.versions, versions: state.versions.versions.slice(0, 2),
    branches: [{ ...state.versions.branches[0], head: args.to }] };
  const cases: [string, (doc: StudioDoc) => void, string][] = [
    ['passing', doc => { doc.instances![0].doc.instances![0].doc.parameters.H = 3; }, 'checked'],
    ['requirement-changed', doc => { doc.instances![0].doc.instances![0].doc.requirements![0].check.value = 10; }, 'checked'],
    ['requirement-withdrawn', doc => { doc.instances![0].doc.instances![0].doc.requirements = []; }, 'checked'],
    ['unresolved', doc => { doc.instances![0].doc.instances = []; }, 'unresolved'],
    ['unresolved', doc => { doc.instances![0].part = { id: 'replacement', rev: 'A' }; }, 'unresolved'],
    ['unresolved', doc => { doc.instances![0].doc.instances![0].doc.nodes = []; }, 'unresolved'],
    ['unresolved', doc => { doc.instances![1].doc.instances![0].doc.parameters.H = 2; }, 'unresolved'],
  ];
  for (const [status, modify, scopeStatus] of cases) {
    const doc = structuredClone(after);
    modify(doc);
    const saved = makeVersion(log, doc, { at: '2026-11-11T00:02:00Z' });
    const out = await runTool({ ...state, versions: saved.log }, 'history', { ...args, later: saved.version.id }, evaluate);
    assert.equal(out.isError, false, out.content);
    const report = JSON.parse(JSON.parse(out.content).files[0].text);
    assert.deepEqual(report.recoveries, [{ id: 'HEIGHT', from: 6, to: 4, unit: 'mm' }]);
    assert.equal(report.followUp.status, scopeStatus);
    assert.deepEqual(report.followUp.findings, [{ id: 'HEIGHT', status }]);
  }
});

test('a branch, skipped version, alias or damaged follow-up snapshot cannot be used as newer evidence', async () => {
  const { before, state, args, working } = await savedApprovalFixture();
  const branch = makeBranch(state.versions, 'other', { from: args.to });
  const branched = makeVersion({ ...branch, current: 'other' }, state.doc, { at: '2026-11-11T00:02:00Z' });
  const skipped = makeVersion(state.versions, before, { at: '2026-11-11T00:03:00Z' });
  const damaged = { ...state.versions, snapshots: { ...state.versions.snapshots, [working.snapshot]: before } };
  const cases = [
    [branched.log, branched.version.id, 'VERSION_LINEAGE'],
    [skipped.log, skipped.version.id, 'VERSION_LINEAGE'],
    [damaged, working.id, 'VERSION_LOG'],
    [state.versions, 'current', undefined],
  ] as const;
  for (const [versions, later, code] of cases) {
    const out = await runTool({ ...state, versions }, 'history', { ...args, later }, async () => assert.fail('Refuse before evaluating'));
    assert.equal(out.isError, true, out.content);
    const reply = JSON.parse(out.content);
    assert.equal(reply.code, code);
    assert.equal(reply.files, undefined);
  }
});

test('a self-consistent hash does not admit invalid branch metadata or array-like parent edges', async () => {
  const { state, args } = await savedApprovalFixture();
  const [first, approved, later] = state.versions.versions;
  for (const malformed of ['array-like', 'missing-branch', 'reversed-index'] as const) {
    const a = { ...first, ...(malformed === 'missing-branch' ? { branch: undefined as unknown as string } : {}) };
    a.id = idOf(a);
    const parents = malformed === 'array-like' ? { 0: a.id, length: 1 } as unknown as string[] : [a.id];
    const b = { ...approved, branch: a.branch, parents };
    b.id = idOf(b);
    const c = { ...later, branch: a.branch, parents: [b.id] };
    c.id = idOf(c);
    const versions = { ...state.versions, versions: malformed === 'reversed-index' ? [a, c, b] : [a, b, c] };
    const out = await runTool({ ...state, versions }, 'history', { ...args, from: a.id, to: b.id, later: c.id },
      async () => assert.fail('Malformed lineage must not be evaluated'));
    assert.equal(out.isError, true, malformed);
    assert.equal(JSON.parse(out.content).code, 'VERSION_LINEAGE', malformed);
  }
});
