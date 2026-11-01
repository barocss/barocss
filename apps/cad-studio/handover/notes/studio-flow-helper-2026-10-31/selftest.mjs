import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const H = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/test/flow-helper.mjs';
const { createFlow, capsule, sha256 } = await import(H);
const out = join(import.meta.dirname, 'run1'); await mkdir(out, { recursive: true });
const sample = join(import.meta.dirname, 'sample.txt'); await writeFile(sample, 'hello');
const f = await createFlow({ name: 'self', envFrozen: 'SELF_FROZEN', output: out, qualification: 'SELF', limits: ['x'],
  oracleSource: 'import json, sys\nd = json.load(sys.stdin)\nassert d["n"] == 2\nprint(json.dumps({"status": "PASS", "n": d["n"]}))\n' });
// capsule: repo-relative hashing, deterministic, change detected
const a = await f.capsule('a', [sample, sample]); assert.equal(Object.keys(a).length, 1); assert.equal(Object.values(a)[0], sha256('hello'));
await writeFile(sample, 'hello2'); const b = await f.capsule('b', [sample]); assert.notDeepEqual(a, b);
assert.equal(JSON.parse(await readFile(join(out, 'source-b.json'), 'utf8')).count, 1);
// oracle runner: pass, files, receipt
const r = await f.runOracle({ n: 2 }, 'ok'); assert.equal(r.n, 2); assert.equal(f.report.oracles.length, 1);
for (const x of ['ok-oracle-input.json', 'ok-oracle.json', 'ok-oracle.stderr.txt', 'self-oracle.py']) await readFile(join(out, x));
await assert.rejects(() => f.runOracle({ n: 3 }, 'bad'), /ORACLE bad/); assert.equal(f.report.oracles.length, 2); assert.notEqual(f.report.oracles[1].exit, 0);
// receipt persistence carries phase
f.phase = 'phase-x'; await f.persist(); const rec = JSON.parse(await readFile(join(out, 'receipt.json'), 'utf8')); assert.equal(rec.phase, 'phase-x'); assert.equal(rec.oracles.length, 2); assert.deepEqual(rec.errors, []);
// env guard
delete process.env.SELF_FROZEN; await assert.rejects(() => createFlow({ name: 's', envFrozen: 'SELF_FROZEN', output: out }), /freeze all writers/);
console.log('selftest PASS');
