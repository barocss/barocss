import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { runScene } from '../physics-rigid-contact-reference/producer.mjs';
import { bundle, here, root } from './bundle.mjs';
import { observer } from './observer.mjs';
import { fields, sha } from './raw.mjs';

const directory = resolve(process.argv[2] ?? '/tmp/physics-1188-canonical');
const baselineDirectory = resolve(here, '../physics-rigid-contact-reference/evidence/native-9c4192e7');
await mkdir(directory, { recursive: true });
const geometry = observer(resolve(here, '../physics-rigid-contact-reference/geometry-reference.py'));
const results = [], audits = [], reports = [];
try {
  for (const graph of ['source', 'source-repeat', 'compiled-dependencies']) {
    const built = await bundle(graph, directory); audits.push(built.audit);
    const module = await import(pathToFileURL(built.modulePath));
    for (const scene of ['ALIGNED', 'OFFSET', 'YAW']) {
      const recorder = new module.DiagnosticRecorder();
      const shim = { ...module, createCandidateWorld: config => module.createDiagnosticWorld(config, recorder) };
      const report = await runScene(shim, geometry, graph, scene, directory);
      const traces = recorder.snapshot();
      assert.equal(traces.length, 126);
      const clone = recorder.snapshot();
      clone[0].state.bodies[0].positionM[0] = 999;
      assert.deepEqual(recorder.snapshot(), traces, 'trace snapshot exposed its internal state');
      const baseline = JSON.parse(gunzipSync(await readFile(resolve(baselineDirectory, `${graph}-${scene}-report.json.gz`))));
      const accepted = fields(report.states, report.ids);
      const oldRaw = gunzipSync(await readFile(resolve(baselineDirectory, `${graph}-${scene}-fields.f64le.gz`)));
      assert.deepEqual(accepted, oldRaw, 'instrumentation changed original raw accepted fields');
      // JSON drops zero signs; exact signed-zero equality was already established with raw bytes.
      assert.deepEqual(JSON.parse(JSON.stringify(report.states)), baseline.states, 'instrumentation changed public output');
      assert.deepEqual(report.observations, baseline.observations);
      assert.deepEqual(report.failure, baseline.failure);
      assert.equal(report.acceptedSnapshots, 7);
      assert.equal(report.failure.kind, 'independent-quality');
      assert.equal(report.failure.step, 6);
      const traceRaw = fields(traces.map(frame => frame.state), report.ids);
      const full = { ...report, traces, traceRawSha256: sha(traceRaw), originalParity: true, traceCopyIsolation: true };
      await writeFile(resolve(directory, `${graph}-${scene}-accepted.f64le.gz`), gzipSync(accepted));
      await writeFile(resolve(directory, `${graph}-${scene}-trace.f64le.gz`), gzipSync(traceRaw));
      await writeFile(resolve(directory, `${graph}-${scene}-report.json.gz`), gzipSync(JSON.stringify(full)));
      reports.push(full);
      results.push({ graph, scene, acceptedSnapshots: 7, traceFrames: 126, rawSha256: sha(accepted), traceRawSha256: sha(traceRaw), originalParity: true });
      console.log(JSON.stringify(results.at(-1)));
    }
  }
  for (const scene of ['ALIGNED', 'OFFSET', 'YAW']) {
    const rows = reports.filter(report => report.scene === scene);
    for (const other of rows.slice(1)) {
      assert.equal(other.traceRawSha256, rows[0].traceRawSha256);
      assert.deepEqual(other.traces, rows[0].traces, 'phase metadata/fields differ across graphs');
    }
  }
  const summary = { base: 'd2ad0f050c302e1d8082aedc48474064b625353b', measuredHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), node: process.version, audits, results, acceptedRawParity: true, phaseGraphParity: true, physicalModelGO: false, costMeasured: false, browserExecuted: false, observerStderr: geometry.stderr() };
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
} finally { geometry.close(); }
