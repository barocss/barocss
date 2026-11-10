import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import { encodeTaskCheckpoint, readTaskCheckpoint, verifyTaskCheckpoint, type TaskCheckpoint } from '../src/files/taskCheckpoint';
import { fixtureDoc, fixtureLimits, fixturePlan } from './task-run-fixture';

const terminalApproval = String.raw`
import os, pty, select, subprocess, sys, time
challenge, *command = sys.argv[1:]
master, slave = pty.openpty()
child = subprocess.Popen(command, stdin=slave, stderr=slave, stdout=subprocess.PIPE)
os.close(slave)
try:
    deadline, prompt = time.monotonic() + 20, b''
    while b'> ' not in prompt and time.monotonic() < deadline:
        if select.select([master], [], [], 0.2)[0]:
            prompt += os.read(master, 4096)
    if ('Type "' + challenge + '" to continue.').encode() not in prompt:
        raise RuntimeError(prompt.decode(errors='replace'))
    os.write(master, (challenge + '\n').encode())
    stdout, _ = child.communicate(timeout=20)
    sys.stdout.buffer.write(stdout)
    sys.exit(child.returncode)
finally:
    if child.poll() is None:
        child.kill()
        child.wait()
    os.close(master)
`;

test('D586 the existing CAD CLI runs real local workers and holds terminal authority', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'barocss-run-cli-'));
  try {
    const source = join(dir, 'source.bcad'), config = join(dir, 'config.json'), run = join(dir, 'run'), saved = join(dir, 'exported.bcad');
    const checkpoint = join(dir, 'exported.bcad-run');
    const original = encodeStudioFile(fixtureDoc());
    writeFileSync(source, original);
    writeFileSync(config, JSON.stringify({ name: 'cli-housing', source, plan: fixturePlan, limits: fixtureLimits, budget: 8, heightsMm: { base: 6, lid: 4 } }));
    const launch = (...args: string[]) => spawnSync(process.execPath, ['scripts/cad-cli.mjs', 'task-run', ...args], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
    });
    const started = launch('start', run, config);
    assert.equal(started.status, 0, started.stderr);
    const status = JSON.parse(started.stdout);
    assert.deepEqual(status.tasks.map((task: { phase: string }) => task.phase), ['awaiting-decision', 'awaiting-decision']);
    assert.deepEqual(status.tasks.map((task: { geometry: { volumeMm3: number } }) => task.geometry.volumeMm3), [1200, 384]);
    assert.deepEqual(status.budget, { limit: 8, used: 2, unknown: 0 });
    const repeated = launch('work', run, 'initial:base', 'base', '6');
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(JSON.parse(repeated.stdout).outcome.duplicate, true);
    const conflict = launch('work', run, 'initial:base', 'base', '7');
    assert.equal(conflict.status, 1, conflict.stderr);
    assert.equal(JSON.parse(conflict.stdout).outcome.code, 'RUN_OPERATION_CONFLICT');
    const denied = launch('decide', run, 'external-approve', 'base', 'approve');
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /requires a terminal operator/);
    const unapproved = launch('export', run, checkpoint);
    assert.equal(unapproved.status, 1, unapproved.stderr);
    assert.match(unapproved.stderr, /requires a committed task/);
    assert.equal(existsSync(checkpoint), false);
    const exported = launch('export', run, saved);
    assert.equal(exported.status, 0, exported.stderr);
    assert.deepEqual(readFileSync(saved), Buffer.from(original));

    const digest = status.tasks[0].candidateDigest;
    const approved = spawnSync('python3', ['-I', '-c', terminalApproval, 'approve base ' + digest.slice(0, 12),
      process.execPath, 'scripts/cad-cli.mjs', 'task-run', 'decide', run, 'terminal-approve', 'base', 'approve'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 45000 });
    assert.equal(approved.status, 0, approved.stderr);
    assert.equal(JSON.parse(approved.stdout.trim().split('\n').at(-1)!).outcome.code, 'RUN_ACCEPTED');
    const accepted = launch('export', run, saved);
    assert.equal(accepted.status, 0, accepted.stderr);
    const doc = await readStudioFile(readFileSync(saved));
    assert.ok(!('error' in doc));
    assert.deepEqual(doc.doc.instances?.map(instance => 'height' in instance.doc.nodes[1] ? instance.doc.nodes[1].height : null), [6, 3]);

    const record = readFileSync(join(run, 'run.json')), entries = readdirSync(run).sort();
    const bundle = launch('export', run, checkpoint);
    assert.equal(bundle.status, 0, bundle.stderr);
    assert.deepEqual(readFileSync(join(run, 'run.json')), record);
    assert.deepEqual(readdirSync(run).sort(), entries);
    const receipt = JSON.parse(bundle.stdout).checkpoint as TaskCheckpoint;
    assert.deepEqual([receipt.taskId, receipt.operationId, receipt.scope.occurrence], ['base', 'terminal-approve', 'p1']);
    const decoded = await readTaskCheckpoint(readFileSync(checkpoint));
    assert.ok(decoded && !('error' in decoded), JSON.stringify(decoded));
    assert.deepEqual(decoded.receipt, receipt);
    assert.deepEqual(decoded.doc, doc.doc);
    const native = await verifyTaskCheckpoint(decoded, async input => evaluatePart(input, 1), () => true);
    assert.ok(native && !('error' in native) && native.checks === 1, JSON.stringify(native));
    const failed = await verifyTaskCheckpoint(decoded, async () => null, () => true);
    assert.match(failed && 'error' in failed ? failed.error : '', /did not pass/);
    assert.equal(await readTaskCheckpoint(readFileSync(checkpoint), () => false), null);

    const after = readFileSync(saved);
    const reformatted = Buffer.concat([after, Buffer.from('\n')]);
    for (const [pin, a, b, error] of [
      [receipt, after, original, /native files do not match/],
      [{ ...receipt, accepted: { ...receipt.accepted, modelDigest: '0'.repeat(64) } }, original, after, /document digests/],
      [{ ...receipt, accepted: { ...receipt.accepted, sha256: sha256Hex(reformatted) } }, original, reformatted, /would change its recorded native bytes/],
      [{ ...receipt, specRevision: '0'.repeat(64) }, original, after, /original specification/],
      [{ ...receipt, plan: { ...receipt.plan, policyRevision: 'new-policy' } }, original, after, /original specification/],
      [{ ...receipt, proposalId: 'P999' }, original, after, /saved approval does not match/],
      [{ ...receipt, candidateDigest: '0'.repeat(64) }, original, after, /candidate or approval/],
      [{ ...receipt, scope: { ...receipt.scope, occurrence: 'p2' } }, original, after, /checkpoint scope/],
    ] as const) {
      const tampered = await readTaskCheckpoint(encodeTaskCheckpoint(pin, a, b));
      assert.match(tampered && 'error' in tampered ? tampered.error : '', error);
    }

    const currentSpec = JSON.parse(launch('status', run).stdout).specRevision;
    const policy = spawnSync('python3', ['-I', '-c', terminalApproval, 'policy new-policy ' + currentSpec.slice(0, 12),
      process.execPath, 'scripts/cad-cli.mjs', 'task-run', 'policy', run, 'terminal-policy', 'new-policy', '1'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 45000 });
    assert.equal(policy.status, 0, policy.stderr);
    const policyRecord = readFileSync(join(run, 'run.json'));
    const afterPolicy = launch('export', run, checkpoint);
    assert.equal(afterPolicy.status, 0, afterPolicy.stderr);
    const carried = JSON.parse(afterPolicy.stdout).checkpoint as TaskCheckpoint;
    assert.deepEqual([carried.plan, carried.specRevision, carried.accepted], [receipt.plan, receipt.specRevision, receipt.accepted]);
    assert.ok(carried.revision > receipt.revision);
    assert.deepEqual(readFileSync(join(run, 'run.json')), policyRecord);

    // An older store lacks the commit-time plan. A different current policy cannot vouch for it.
    const legacy = JSON.parse(policyRecord.toString('utf8'));
    delete legacy.record.commits.at(-1).plan;
    legacy.digest = digestOf(legacy.record);
    writeFileSync(join(run, 'run.json'), JSON.stringify(legacy));
    const legacyFile = join(dir, 'legacy.bcad-run'), missingPlan = launch('export', run, legacyFile);
    assert.equal(missingPlan.status, 1);
    assert.match(missingPlan.stderr, /original specification/);
    assert.equal(existsSync(legacyFile), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
