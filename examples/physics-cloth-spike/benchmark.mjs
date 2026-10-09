import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { CLOTH_FIXTURE, FEASIBILITY } from './fixture.mjs';
import { runTrial } from './trial.mjs';

const hash = positions => createHash('sha256').update(new Uint8Array(positions.buffer)).digest('hex');
const trials = [];
const schedules = [
  ...['pbd', 'xpbd'].flatMap(model => [4, 8, 16].map(iterations => ({ size: 17, model, iterations, substeps: 1 }))),
  ...['pbd', 'xpbd'].map(model => ({ size: 33, model, iterations: 8, substeps: 1 })),
  ...[[4, 2], [8, 2], [16, 1]].map(([substeps, iterations]) => ({ size: 17, model: 'xpbd', substeps, iterations })),
];
for (const { size, model, iterations, substeps } of schedules) {
    const fixture = { ...CLOTH_FIXTURE, size };
    const result = runTrial(fixture, model, iterations, size === 17 && substeps === 8, substeps);
    const repeat = runTrial(fixture, model, iterations, false, substeps);
    const sha256 = hash(result.finalPositionsM);
    assert.equal(sha256, hash(repeat.finalPositionsM), 'Repeat changed accepted positions');
    const { finalPositionsM, ...record } = result;
    trials.push({ ...record, sha256, repeatEqual: true });
}
const report = { format: 'cloth-discovery-report', version: 0,
  node: process.version, platform: process.platform, arch: process.arch,
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceTreeDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0,
  fixture: CLOTH_FIXTURE, thresholds: FEASIBILITY, trials,
  publicApi: false, viewerAcceptance: false, materialCalibration: false };
const target = process.argv[2];
if (target) { await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ result: 'measured', trials: trials.map(({ snapshots, ...trial }) => trial),
  report: target ?? null, publicApi: false, viewerAcceptance: false }));
