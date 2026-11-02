// Read saved results only. This script makes no solver or compiler call.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url)), root = resolve(here, '../..');
const evidence = join(here, 'evidence');
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const metrics = p => readFileSync(p, 'utf8').split('\n').filter(s => s.startsWith('# {')).map(s => JSON.parse(s.slice(2)));
const runs = readdirSync(evidence).filter(n => {
  try { return lstatSync(join(evidence, n, 'commands.json')).isFile(); } catch { return false; }
}).sort().map(name => ({ name, ...JSON.parse(readFileSync(join(evidence, name, 'commands.json'), 'utf8')) }));
for (const [name, source, emitted] of [
  ['world', 'dynamics-source-01', 'dynamics-compiled-01'],
  ['pendulum', 'dynamics-source-01', 'dynamics-compiled-01'],
  ['contact', 'contact-source-01', 'contact-compiled-01'],
]) assert.deepEqual(metrics(join(evidence, source, `${name}.stdout`)), metrics(join(evidence, emitted, `${name}.stdout`)));
const compiledGraphs = [];
for (const graphFile of ['kinematics-metrics-01/kinematics.graph.json', 'inputs-final-01/motion-input.graph.json',
  'dynamics-source-01/world.graph.json', 'dynamics-source-01/pendulum.graph.json',
  'contact-source-01/contact.graph.json', 'units-source-01/units.graph.json']) {
  const graph = JSON.parse(readFileSync(join(evidence, graphFile), 'utf8'));
  for (const input of graph.inputs.filter(i => i.path.startsWith('packages/'))) assert.equal(hash(join(root, input.path)), input.sha256);
}
for (const dir of ['dynamics-compiled-01', 'contact-compiled-01']) {
  for (const name of readdirSync(join(evidence, dir)).filter(n => n.endsWith('.graph.json'))) {
    const graph = JSON.parse(readFileSync(join(evidence, dir, name), 'utf8'));
    assert.ok(graph.compiled);
    assert.ok(!graph.inputs.some(i => i.path.startsWith('packages/barocss-physics/src/')));
    // Reopen each emitted provider and bind its actual bytes to the saved graph.
    for (const input of graph.inputs.filter(i => i.path.includes('/physics/'))) assert.equal(hash(join(root, input.path)), input.sha256);
    compiledGraphs.push({ file: `${dir}/${name}`, inputs: graph.inputs.length, physicsSourceProviders: 0 });
  }
}
const summary = {
  workId: 'physics-motion-foundations-2276', status: 'BOUNDED_PROFILES_PASS_WITH_RETAINED_NO_GO',
  runs, retainedNonzeroCommands: runs.flatMap(run => run.records.filter(r => r.exit !== 0).map(r => ({ run: run.name, ...r }))),
  finalOrchestrationAudit: JSON.parse(readFileSync(join(evidence, 'final-audit.json'), 'utf8')),
  compiledGraphs, sourceEmittedMetricEquality: true,
  kinematics: metrics(join(evidence, 'kinematics-metrics-01/kinematics.stdout')),
  units: metrics(join(evidence, 'units-source-01/units.stdout')),
  world: metrics(join(evidence, 'dynamics-source-01/world.stdout')),
  pendulum: metrics(join(evidence, 'dynamics-source-01/pendulum.stdout')),
  contact: metrics(join(evidence, 'contact-source-01/contact.stdout')),
  originalMiniStacks: readFileSync(join(evidence, 'baseline-01/original-mini-stacks.stdout'), 'utf8').trim().split('\n').map(s => JSON.parse(s)),
  notQualified: ['public-disjoint-hinge', 'original-eight-box-stack', 'connected-multibody', 'control', 'Studio-integration', 'hardware-correlation', 'manufacturing-safety', 'release'],
};
writeFileSync(join(evidence, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
const files = [];
function collect(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name), stat = lstatSync(p);
    if (stat.isSymbolicLink() || name === 'node_modules' || name === 'manifest.json') continue;
    if (stat.isDirectory()) collect(p);
    else files.push({ path: relative(root, p), bytes: stat.size, sha256: hash(p) });
  }
}
collect(here);
for (const p of ['packages/barocss-physics/src/pendulum.ts', 'packages/barocss-physics/src/index.ts',
  'packages/barocss-cad-model/src/robot/motion.ts', '.changeset/physics-motion-foundations-2276.md']) {
  files.push({ path: p, bytes: lstatSync(join(root, p)).size, sha256: hash(join(root, p)) });
}
writeFileSync(join(evidence, 'manifest.json'), JSON.stringify({ workId: summary.workId,
  base: '12411c89b9a0f9de7e5066a5ea8f3d292c9476a8', files }, null, 2) + '\n');
process.stdout.write(JSON.stringify({ runs: runs.length, retainedNonzeroCommands: summary.retainedNonzeroCommands.length,
  compiledGraphs: compiledGraphs.length, manifestFiles: files.length, status: summary.status }) + '\n');
