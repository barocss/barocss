// cad-cli as a shell runs it: apps/cad-studio/scripts/cad-cli.mjs spawned, a script to a part, STEP and its checks.
// The cad-mcp and cad-cli page includes the script and the runs between the #region markers. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cadCli = resolve(import.meta.dirname, '../../cad-studio/scripts/cad-cli.mjs');
/** cad-cli with these arguments (and stdin): its exit code, its output parsed when it is JSON, and stderr. */
function cli(args, stdin) {
  return new Promise(done => {
    const child = spawn(process.execPath, [cadCli, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', x => { out += x; }); child.stderr.on('data', x => { err += x; });
    child.on('close', code => { let json = null; try { json = JSON.parse(out); } catch { /* not JSON */ } done({ code, json, err }); });
    child.stdin.end(stdin ?? '');
  });
}

test('cad-cli run: a script to .bcad and STEP, its hard requirement checked; a failing one exits 3; a bad line exits 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'docs-cli-'));
  // #region script
  // plate.cad.js: a plate, and a hard requirement that it is 80 mm long.
  const script = `box({w: 80, d: 40, h: 8})
requirements([{id: "R1", source: "80 long", hard: true,
  check: {op: "==", query: {fn: "bbox", axis: "x"}, value: 80, tol: 0.1}}])`;
  // #endregion script
  writeFileSync(join(dir, 'plate.cad.js'), script);

  // #region run
  // cad-cli run plate.cad.js -o plate.bcad --step plate.step --check
  const run = await cli(['run', join(dir, 'plate.cad.js'), '-o', join(dir, 'plate.bcad'), '--step', join(dir, 'plate.step'), '--check']);
  assert.equal(run.code, 0);
  assert.equal(run.json.checks.summary.hard_failing, 0);

  // cad-cli check plate.bcad: the saved part's requirements again.
  assert.equal((await cli(['check', join(dir, 'plate.bcad')])).code, 0);

  // The same requirement on a 90 mm plate fails: exit 3.
  const wide = await cli(['run', '-', '-o', join(dir, 'wide.bcad'), '--check'], script.replace('w: 80', 'w: 90'));
  assert.equal(wide.code, 3);

  // A line the tools refuse: exit 1, where it is, and nothing written.
  const bad = await cli(['run', '-', '-o', join(dir, 'bad.bcad')], 'box({w: 5, d: 5, h: 5, q: 2})');
  assert.equal(bad.code, 1);
  assert.match(bad.err, /<stdin>:1:\d+: \[REFUSED\] Box has no value "q"/);
  // #endregion run
  assert.match(readFileSync(join(dir, 'plate.step'), 'latin1'), /^ISO-10303-21;/);
  assert.ok(!existsSync(join(dir, 'bad.bcad')));
});
