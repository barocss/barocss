// DATA only: verify retained bytes and summarize the completed bounded studies.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const here = fileURLToPath(new URL('.', import.meta.url)), root = resolve(here, '../..');
const evidence = join(here, 'evidence');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const read = p => JSON.parse(readFileSync(join(evidence, p), 'utf8'));
const preservation = read('preread/baseline-preservation.json');
for (const item of preservation.preserved) assert.equal(sha(join(root, item.path)), item.sha256);
const oldChanges = spawnSync('git', ['diff', '--name-only', preservation.base, '--', '.',
  ':(exclude)examples/physics-motion-nogo-2276/**'], { cwd: root, encoding: 'utf8' });
assert.equal(oldChanges.status, 0); assert.equal(oldChanges.stdout, '');
const runs = ['hinge-unit-01', 'stack-unit-01', 'hinge-study-01', 'stack-study-01',
  'equilibrium-unit-01', 'equilibrium-study-01'].map(name => ({ name, ...read(`${name}/command.json`) }));
for (const run of runs) assert.equal(run.exit, 0);
const currentPrograms = {
  'hinge-study-01': ['hinge-study.py', 'hinge-runtime.mjs'],
  'stack-study-01': ['stack-study.py'],
  'equilibrium-study-01': ['stack-equilibrium.py', 'stack-study.py'],
};
for (const [run, programs] of Object.entries(currentPrograms)) {
  const snapshot = read(`${run}/source.json`);
  for (const name of programs) {
    const input = snapshot.sourceFiles.find(x => x.path === relative(root, join(here, name)));
    assert.ok(input); assert.equal(sha(join(root, input.path)), input.sha256);
  }
}
const hinge = read('hinge-study-01/result.json'), stack = read('stack-study-01/result.json');
const equilibrium = read('equilibrium-study-01/result.json');
assert.equal(hinge.status, 'COMPLETE_SCALAR_CLASSIFICATION_ONLY');
assert.ok(hinge.certificates.every(c => c.matchesHistoricalBits && !c.matchesRecordedCandidateBits));
assert.equal(hinge.calls.atan2Completed, 4);
assert.equal(stack.status, 'DIAGNOSTIC_NORMAL_CONTACT_NO_GO');
assert.equal(stack.firstViolation.step, 1); assert.equal(stack.pointChecks, 1);
assert.equal(equilibrium.status, 'SAVED_FIRST_PATCH_EXACT_FIXED_POINT_CERTIFIED');
assert.equal(equilibrium.geometryPointChecks, 32); assert.equal(equilibrium.exactCertificateRows, 32);
assert.equal(equilibrium.certificate.exactVelocityAndSpinZero, true);
assert.equal(equilibrium.certificate.exactNormalComplementarityZero, true);
let tests = 0;
for (const name of ['hinge-unit-01', 'stack-unit-01', 'equilibrium-unit-01']) {
  const output = readFileSync(join(evidence, name, 'stderr.raw'), 'utf8');
  assert.match(output, /\nOK\n$/); tests += Number(output.match(/Ran (\d+) tests/)[1]);
}
assert.equal(tests, 37);
const result = { work_id: 'physics-motion-nogo-2276', artifact_type: 'verified-diagnostic-summary',
  status: 'BOUNDED_DIAGNOSTICS_COMPLETE_PUBLIC_NO_GO_PRESERVED', runs,
  newSyntheticTestsPassed: tests, originalFilesUnchanged: true, preservedReceipts: preservation.preserved,
  worldCalls: 0, nativeSolverCalls: 0, publicActivation: 'NO_GO',
  hinge: { certifiedHistoricalReportBits: hinge.certificates[0].doubledCorrectlyRoundedAtan2Bits,
    runtimeVersions: hinge.runtimeAttempts.map(x => x.reply.runtime.node),
    candidateOperandsObserved: false, historicalBankCorrectlyRoundedAtReconstructedOperands: true },
  stack: { firstDiagnosticStep: stack.firstViolation.step, firstPoint: stack.firstViolation.pointId,
    finalNormalSpeedMps: stack.firstViolation.decimal120.normalSpeedMps,
    complementarityJ: stack.firstViolation.decimal120.residuals.complementarityJ,
    allOriginalRecordsAuthenticated: stack.archiveRecordsHashed,
    sameFirstFrameFixedPointExists: true, exactCertifiedRows: equilibrium.exactCertificateRows,
    causalLawDefect: 'UNKNOWN', originalEightBoxPhysicalGO: false },
  sourceVersionAudit: read('source-version-audit.json'),
  notRun: ['candidate7178434World', 'oldWorldReplay', 'newNativeLaw', 'publicAdmissionChange',
    'original1200StepNewCampaign', 'Studio', 'Integration', 'hardware', 'release'],
};
writeFileSync(join(evidence, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
const files = [];
function collect(dir) {
  for (const name of readdirSync(dir).sort()) {
    if (name === 'manifest.json' || name === '__pycache__') continue;
    const path = join(dir, name), info = lstatSync(path);
    if (info.isDirectory()) collect(path);
    else if (info.isFile()) files.push({ path: relative(root, path), bytes: info.size, sha256: sha(path) });
  }
}
collect(here);
writeFileSync(join(evidence, 'manifest.json'), JSON.stringify({ work_id: result.work_id,
  base: preservation.base, files }, null, 2) + '\n');
process.stdout.write(JSON.stringify({ tests, runs: runs.length, files: files.length,
  originalFilesUnchanged: true, status: result.status }) + '\n');
