import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { putBlob } from '@barocss/cad-model/engine/blobs';
import { encodeStudioFile, isContainer } from '@barocss/cad-model/engine/container';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import { cliMain } from '../server/cadCli';
import { encodeTaskRunHandoff } from '../src/files/taskRunHandoff';
import { LocalRunRequestError, readLocalTaskBaseline, runLocalTaskHandoff } from '../server/taskRun/localService';
import { deriveLocalRunPlan } from '../server/taskRun/localPlan';
import { fixtureDoc, singleRepairDoc, threeOccurrenceDoc } from './task-run-fixture';

const selected = ['p1', 'p2'];
const derive = (doc = fixtureDoc(), occurrences = selected) =>
  deriveLocalRunPlan(doc, '/native/housing.bcad', sha256Hex(encodeStudioFile(doc)), occurrences);

test('D616 derives selected work from the saved hard checks and exact source', () => {
  const doc = fixtureDoc(), plan = derive(doc);
  assert.equal(plan.modelDigest, digestOf(doc));
  assert.equal(plan.sourceSHA256, sha256Hex(encodeStudioFile(doc)));
  assert.deepEqual(plan.plan.tasks.map(task => [task.id, task.occurrence, task.feature]), [['p1', 'p1', 'n1'], ['p2', 'p2', 'n1']]);
  assert.deepEqual(plan.targets.map(target => [target.id, target.requirementId, target.currentHeightMm, target.heightMm, target.toleranceMm]),
    [['p1', 'height', 5, 6, 0.001], ['p2', 'height', 3, 4, 0.001]]);
  assert.deepEqual(plan, derive(doc));
  assert.deepEqual(derive(doc, ['p2', 'p1']).targets.map(target => target.id), ['p2', 'p1']);
});

test('D624 accepts three distinct ordered selections and retains the two-worker limit', () => {
  const source = threeOccurrenceDoc();
  const plan = derive(source, ['p3', 'p1', 'p2']);
  assert.deepEqual(plan.targets.map(target => [target.id, target.heightMm]), [['p3', 5], ['p1', 6], ['p2', 4]]);
  assert.equal(plan.plan.maxTasks, 3);
  assert.equal(plan.limits.concurrent, 2);
  assert.equal(plan.budget, 12);
  for (const ids of [[], ['p1', 'p2', 'p1'], ['p1', 'p2', 'p3', 'p4']])
    assert.throws(() => derive(source, ids), /one to three distinct occurrence IDs/);
});

test('D627 derives one repair without including already satisfied occurrences', () => {
  const source = singleRepairDoc();
  const plan = derive(source, ['p3']);
  assert.deepEqual(plan.targets.map(target => [target.id, target.currentHeightMm, target.heightMm]), [['p3', 7, 5]]);
  assert.equal(plan.plan.maxTasks, 1);
  assert.equal(plan.limits.concurrent, 1);
  assert.equal(plan.budget, 4);
  assert.deepEqual(plan.plan.protectedOccurrences, ['p1', 'p2']);
  assert.throws(() => derive(source, ['p1']), /UNCOVERED_REQUIREMENT.*p3/);
  source.instances![2].doc.requirements![0].check.value = 7;
  assert.throws(() => derive(source, ['p1']), /already at its stated height/);
});

test('D629 reopens an exact started handoff without creating or advancing a writer', async () => {
  const root = mkdtempSync(join(tmpdir(), 'barocss-reopen-handoff-'));
  try {
    const doc = fixtureDoc(), { targets, modelDigest: revision } = derive(doc);
    const handoff = await encodeTaskRunHandoff({ targets, revision, occurrences: selected }, encodeStudioFile(doc));
    const missing = join(root, 'missing');
    assert.deepEqual(await runLocalTaskHandoff(missing, handoff, 'reopen'),
      { status: 404, error: 'No local task run has been started for this handoff.' });
    assert.equal(existsSync(missing), false);
    const started = await runLocalTaskHandoff(root, handoff);
    assert.ok('result' in started, JSON.stringify(started));
    const { directory } = started.result;
    const file = join(directory, 'run.json');
    const saved = readFileSync(file), files = readdirSync(directory).sort();
    assert.deepEqual(await runLocalTaskHandoff(root, handoff, 'reopen'), { result: { ...started.result, reused: true } });
    assert.deepEqual(readFileSync(file), saved);
    assert.deepEqual(readdirSync(directory).sort(), files);

    const { runKey, runId, baselineDigest } = started.result;
    const baselineRequest = { runKey, runId, baselineDigest };
    const baseline = readLocalTaskBaseline(root, baselineRequest);
    assert.deepEqual(Buffer.from(baseline.bytes), Buffer.from(encodeStudioFile(doc)));
    assert.equal(baseline.sha256, sha256Hex(baseline.bytes));
    for (const patch of [{ runId: 'other-run' }, { baselineDigest: 'e'.repeat(64) }]) {
      assert.throws(() => readLocalTaskBaseline(root, { ...baselineRequest, ...patch }),
        error => error instanceof LocalRunRequestError && error.status === 409);
    }
    assert.throws(() => readLocalTaskBaseline(root, { ...baselineRequest, path: directory }),
      error => error instanceof LocalRunRequestError && error.status === 400);
    assert.deepEqual(readFileSync(file), saved);
    assert.deepEqual(readdirSync(directory).sort(), files);

    const envelope = JSON.parse(saved.toString());
    envelope.record.state.plan.tasks[0].feature = 'n8';
    envelope.digest = digestOf(envelope.record);
    writeFileSync(file, JSON.stringify(envelope));
    const mismatched = readFileSync(file);
    const refused = await runLocalTaskHandoff(root, handoff, 'reopen');
    assert.equal('status' in refused && refused.status, 409);
    assert.deepEqual(readFileSync(file), mismatched);
    assert.deepEqual(readdirSync(directory).sort(), files);

    const unreadable = '{';
    writeFileSync(file, unreadable);
    assert.deepEqual(await runLocalTaskHandoff(root, handoff), {
      status: 409, error: 'Could not read the existing local task run.',
    });
    assert.equal(readFileSync(file, 'utf8'), unreadable);
    assert.deepEqual(readdirSync(directory).sort(), files);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('D616 refuses unconfirmed, ambiguous, incompatible, no-op and out-of-scope targets', () => {
  assert.throws(() => derive(fixtureDoc(), ['p1', 'p1']), /one to three distinct occurrence IDs/);
  assert.throws(() => derive(fixtureDoc(), ['p1', 'missing']), /Supply task, holder, occurrence, and feature IDs/);
  const missing = fixtureDoc();
  delete missing.instances![0].doc.requirements;
  assert.throws(() => derive(missing), /MISSING_REQUIRED_CHECK/);
  const assumed = fixtureDoc();
  assumed.instances![0].doc.requirements![0].basis = 'assumed';
  assert.throws(() => derive(assumed), /unresolved design inputs/);
  const withoutBasis = fixtureDoc();
  delete withoutBasis.instances![0].doc.requirements![0].basis;
  assert.throws(() => derive(withoutBasis), /one stated positive exact height/);
  const multiple = fixtureDoc(), base = multiple.instances![0].doc.requirements![0];
  multiple.instances![0].doc.requirements!.push({ ...base, id: 'height-2', check: { ...base.check, value: 6.0005 } });
  assert.throws(() => derive(multiple), /one stated positive exact height/);
  const incompatible = fixtureDoc(), original = incompatible.instances![0].doc.requirements![0];
  incompatible.instances![0].doc.requirements!.push({ ...original, id: 'height-min', check: { ...original.check, op: '>=', value: 6.0005, tol: 0 } });
  assert.throws(() => derive(incompatible), /does not satisfy its other hard height checks/);
  const wrongUnit = fixtureDoc();
  wrongUnit.instances![0].doc.requirements![0].check.unit = 'inch';
  assert.throws(() => derive(wrongUnit), /UNSUPPORTED_CHECK/);
  const already = fixtureDoc();
  already.instances![0].doc.requirements![0].check.value = 5;
  assert.throws(() => derive(already), /already at its stated height/);
});

async function runCli(...args: string[]) {
  let stdout = '', stderr = '';
  const status = await cliMain(['task-run', ...args], {
    stdout: new Writable({ write(chunk, _encoding, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _encoding, done) { stderr += chunk.toString(); done(); } }),
  });
  return { status, stdout, stderr };
}

test('D616 plans read-only and refuses stale bytes or altered plan fields before creating a writer', async () => {
  const root = mkdtempSync(join(tmpdir(), 'barocss-local-plan-'));
  try {
    const source = join(root, 'source.bcad'), file = join(root, 'plan.json'), run = join(root, 'run');
    const bytes = Buffer.from(encodeStudioFile(fixtureDoc()));
    writeFileSync(source, bytes);
    const result = await runCli('plan', source, ...selected);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(root), ['source.bcad']);
    assert.deepEqual(readFileSync(source), bytes);
    const plan = JSON.parse(result.stdout) as ReturnType<typeof derive>;
    assert.equal(plan.sourceSHA256, sha256Hex(bytes));
    assert.deepEqual(plan.targets.map(target => target.heightMm), [6, 4]);
    for (const changed of [
      { ...plan, targets: plan.targets.map(target => ({ ...target, heightMm: 7 })) },
      { ...plan, specRevision: '0'.repeat(64) },
      { ...plan, budget: 100 },
      { ...plan, plan: { ...plan.plan, tasks: plan.plan.tasks.map(task => ({ ...task, feature: 'n2' })) } },
    ]) {
      writeFileSync(file, JSON.stringify(changed));
      const refused = await runCli('start', run, '--plan', file);
      assert.equal(refused.status, 1, refused.stderr);
      assert.match(refused.stderr, /plan differs from the authored source/);
      assert.equal(existsSync(run), false);
    }
    writeFileSync(file, result.stdout);
    writeFileSync(source, Buffer.concat([bytes, Buffer.from('\n')]));
    const stale = await runCli('start', run, '--plan', file);
    assert.equal(stale.status, 1, stale.stderr);
    assert.match(stale.stderr, /source bytes changed/);
    assert.equal(existsSync(run), false);
    const unitless = { ...fixtureDoc(), units: undefined };
    writeFileSync(source, JSON.stringify(unitless));
    const noUnit = await runCli('plan', source, ...selected);
    assert.equal(noUnit.status, 1, noUnit.stderr);
    assert.match(noUnit.stderr, /no units given/);
    assert.equal(existsSync(run), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('D616 a packed native source keeps an inactive mesh through plan, dispatch and run reopen', async () => {
  const root = mkdtempSync(join(tmpdir(), 'barocss-packed-plan-'));
  try {
    const doc = fixtureDoc(), source = join(root, 'packed.bcad'), file = join(root, 'plan.json'), run = join(root, 'run');
    const positions = await putBlob(new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
    const indices = await putBlob(new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]));
    doc.proposals = [{
      id: 'P1', title: 'Inactive mesh', status: 'open', by: { agent: 'test' }, at: '2026-11-11', base: 'x',
      ops: [{ tool: 'add_features', args: { features: [{ kind: 'mesh', name: 'm', unit: 'mm', representation: 'facets', blob: { positions, indices } }] } }],
      risk: { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] }, summary: '',
    }];
    const bytes = Buffer.from(encodeStudioFile(doc));
    assert.ok(isContainer(bytes));
    writeFileSync(source, bytes);
    const plan = await runCli('plan', source, ...selected);
    assert.equal(plan.status, 0, plan.stderr);
    assert.equal(JSON.parse(plan.stdout).sourceSHA256, sha256Hex(bytes));
    writeFileSync(file, plan.stdout);
    const start = spawnSync(process.execPath, ['scripts/cad-cli.mjs', 'task-run', 'start', run, '--plan', file],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 30000 });
    assert.equal(start.status, 0, start.error?.message ?? start.stderr + start.stdout);
    assert.deepEqual(JSON.parse(start.stdout).tasks.map((task: { phase: string }) => task.phase), ['awaiting-decision', 'awaiting-decision']);
    const exportPath = join(root, 'reopened.bcad');
    const reopened = await runCli('export', run, exportPath);
    assert.equal(reopened.status, 0, reopened.stderr);
    assert.deepEqual(readFileSync(exportPath), bytes);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
