import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runOracleFile, sha256 } from './flow-helper.mjs';

const input = { title: 'Bore Ø10', lengths: [30, 12, 6] };
const stderrBytes = Buffer.from([0x65, 0x72, 0x72, 0xff, 0x0a]);
const cases = [
  { name: 'default PASS', stdout: '{"status":"PASS","value":10}' },
  { name: 'explicit status', expectedStatus: 'PASS_D550', stdout: '{"status":"PASS_D550"}' },
  { name: 'exact status mismatch', expectedStatus: 'PASS_D550', stdout: '{"status":"PASS_D550 "}', failure: /expected status "PASS_D550", got "PASS_D550 "/ },
  { name: 'malformed JSON', stdout: '{"status":', failure: /malformed stdout JSON/ },
  { name: 'nonzero exit with PASS', stdout: '{"status":"PASS"}', exit: 7, failure: /exit 7/ },
  { name: 'missing status', stdout: '{"value":10}', failure: /expected status "PASS", got undefined/ },
];

for (const scenario of cases) {
  test(`shared Studio oracle: ${scenario.name}`, async t => {
    const output = await mkdtemp(join(tmpdir(), 'barocss-flow-oracle-'));
    t.after(() => rm(output, { recursive: true, force: true }));
    const script = join(output, 'stub.py');
    const actualStdin = join(output, 'actual-stdin.bin');
    const label = 'sample';
    const stdoutBytes = Buffer.from(scenario.stdout);
    const exit = scenario.exit ?? 0;
    await writeFile(script, `
from pathlib import Path
import sys
Path(__file__).with_name('actual-stdin.bin').write_bytes(sys.stdin.buffer.read())
sys.stdout.buffer.write(bytes.fromhex('${stdoutBytes.toString('hex')}'))
sys.stderr.buffer.write(bytes.fromhex('${stderrBytes.toString('hex')}'))
sys.exit(${exit})
`);

    const report = { oracles: [] };
    let persisted = false;
    const invocation = runOracleFile({
      output, report, script, input, label, expectedStatus: scenario.expectedStatus,
      persist: async () => {
        assert.equal(report.oracles.length, 1);
        const row = report.oracles[0];
        const inputPath = join(output, 'sample-oracle-input.json');
        const stdoutPath = join(output, 'sample-oracle.json');
        const stderrPath = join(output, 'sample-oracle.stderr.txt');
        const exitPath = join(output, 'sample-oracle-exit.json');
        const [inputBytes, readStdin, stdout, stderr, originalExit] = await Promise.all(
          [inputPath, actualStdin, stdoutPath, stderrPath, exitPath].map(path => readFile(path)),
        );
        assert.deepEqual(readStdin, inputBytes);
        assert.deepEqual(JSON.parse(inputBytes), input);
        assert.deepEqual(stdout, stdoutBytes);
        assert.deepEqual(stderr, stderrBytes);
        const custody = JSON.parse(originalExit);
        assert.deepEqual(custody, {
          label, expectedStatus: scenario.expectedStatus ?? 'PASS',
          inputPath, inputSHA256: sha256(inputBytes), stdoutPath, stderrPath, exitPath,
          stdoutSHA256: sha256(stdoutBytes), stderrSHA256: sha256(stderrBytes),
          exit, signal: null, error: null,
        });
        assert.equal(row.exit, exit);
        assert.equal(row.stderr, stderrBytes.toString('utf8'));
        if (scenario.name === 'malformed JSON') {
          assert.equal(row.stdout, null);
          assert.ok(row.parseError);
        } else {
          assert.deepEqual(row.stdout, JSON.parse(stdoutBytes));
          assert.equal(row.parseError, null);
        }
        persisted = true;
      },
    });
    if (scenario.failure) await assert.rejects(invocation, scenario.failure);
    else assert.deepEqual(await invocation, JSON.parse(stdoutBytes));
    assert.equal(persisted, true, 'Custody persisted before settling the invocation');
  });
}
