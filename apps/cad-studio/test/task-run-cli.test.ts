import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
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
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
