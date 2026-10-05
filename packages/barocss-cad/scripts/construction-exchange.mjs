import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { constructionEvidenceRoot } from './construction-evidence.mjs';

export function runConstructionExchange() {
  const output = constructionEvidenceRoot(), python = process.env.BAROCSS_CAD_PYTHON;
  assert.ok(python, 'BAROCSS_CAD_PYTHON must name the installed isolated interpreter');
  const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(import.meta.dirname, '../../..'), encoding: 'utf8' }).trim();
  assert.equal(manifest.head, head, 'Run packed consumer on current HEAD before constructed exchange');
  const adapter = resolve(import.meta.dirname, 'read-construction-ocp.py');
  const run = mode => spawnSync(python, [adapter, output, ...(mode ? [mode] : [])], { encoding: 'utf8' });
  const accepted = run();
  writeFileSync(resolve(output, 'reader.stdout.txt'), accepted.stdout ?? '');
  writeFileSync(resolve(output, 'reader.stderr.txt'), accepted.stderr ?? '');
  assert.equal(accepted.status, 0, 'Constructed OCP exchange failed: ' + accepted.stderr + accepted.stdout);
  const name = manifest.fixtures[0].name;
  const original = readFileSync(resolve(output, name + '.iges'), 'utf8');
  const records = original.trimEnd().split('\n');
  const index = records.findIndex(line => line[72] === 'P' && line.slice(0, 64).includes('10.0'));
  assert.ok(index >= 0, 'Expected constructed pole token missing');
  records[index] = records[index].replace('10.0', '11.0');
  writeFileSync(resolve(output, 'corrupted-pole.iges'), records.join('\n') + '\n');
  const badPole = run('--corrupt-pole'), badParameter = run('--corrupt-parameter');
  for (const [label, result] of [['pole', badPole], ['parameter', badParameter]]) {
    writeFileSync(resolve(output, 'negative-' + label + '.txt'), (result.stdout ?? '') + '\n' + (result.stderr ?? ''));
    assert.equal(result.status, 1, 'Corrupted construction unexpectedly passed: ' + label);
    assert.match(result.stderr, /Geometric comparison failed/, 'Negative control must reach geometric comparison');
  }
  const report = JSON.parse(readFileSync(resolve(output, 'readback.json'), 'utf8'));
  report.negativeControls = { poleStatus: badPole.status, sourceParameterStatus: badParameter.status, reachedGeometry: true };
  const bytes = JSON.stringify(report, null, 2) + '\n';
  writeFileSync(resolve(output, 'report.json'), bytes);
  writeFileSync(resolve(output, 'report.sha256'), createHash('sha256').update(bytes).digest('hex') + '\n');
  console.log('Constructed independent OCP gate passed: ' + JSON.stringify(report));
  return report;
}
