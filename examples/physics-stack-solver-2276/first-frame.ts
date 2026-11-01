import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { solveNormalContacts, type NormalProblem } from './candidate.js';
import { verifyNormalSolution, type VerificationOracle } from './verification.js';

const [fixturePath, outputPath, countText] = process.argv.slice(2);
const count = Number(countText);
assert.ok(fixturePath && outputPath && (count === 1 || count === 2));
const bytes = readFileSync(fixturePath);
const fixture = JSON.parse(bytes.toString('utf8')) as { problem: NormalProblem; oracle: VerificationOracle; baseline: unknown };
assert.equal(fixture.problem.bodies.length, 9);
assert.equal(fixture.problem.points.length, 32);
const before = JSON.stringify(fixture.problem);
const results = [];
let passed = true;
for (let attempt = 0; attempt < count; attempt++) {
  const candidate = solveNormalContacts(fixture.problem);
  assert.equal(JSON.stringify(fixture.problem), before, 'candidate mutated input');
  const verification = candidate.ok ? verifyNormalSolution(fixture.problem, candidate, fixture.oracle) : null;
  results.push({ candidate, verification });
  if (!candidate.ok || !verification?.passed) { passed = false; break; }
  assert.equal(candidate.stats.qrRank, 24, 'measured first-patch numerical rank');
  assert.ok(candidate.stats.outerIterations <= 64 && candidate.stats.blockQrFactorizations <= 64);
  if (attempt > 0) assert.deepEqual(results[attempt], results[0], 'same-runtime repeat differs');
}
const receipt = { status: passed ? 'FIRST_PATCH_SOLVER_AND_INDEPENDENT_ORACLE_PASS' : 'FIRST_PATCH_NO_GO',
  fixtureSha256: createHash('sha256').update(bytes).digest('hex'), requestedSolves: count,
  actualSolves: results.length, inputRetained: true, results,
  baseline: fixture.baseline, publicActivation: 'NO_GO', originalWorldRuns: 0 };
writeFileSync(outputPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ status: receipt.status, actualSolves: results.length,
  stats: results[0]?.candidate.stats, verification: results[0]?.verification?.maxima }) + '\n');
if (!passed) process.exitCode = 1;
