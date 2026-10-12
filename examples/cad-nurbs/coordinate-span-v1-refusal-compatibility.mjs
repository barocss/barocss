import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, statfsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Session } from 'node:inspector';
const [input, directory] = process.argv.slice(2); assert.ok(input && directory);
assert.equal(process.versions.node, '22.23.3'); assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const output = resolve(directory); mkdirSync(output, { recursive: true });
assert.ok(statfsSync(output).bavail * statfsSync(output).bsize >= 500 * 1024 * 1024);
const api = await import(pathToFileURL(resolve('packages/barocss-cad/dist/index.js')));
const prior = JSON.parse(readFileSync(input, 'utf8'));
const json = v => typeof v === 'number' && Object.is(v, -0) ? '-0' : Array.isArray(v) ? '[' + v.map(json).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ':' + json(x)).join(',') + '}' : JSON.stringify(v);
const hash = v => createHash('sha256').update(json(v)).digest('hex'), before = hash(prior);
const session = new Session(); session.connect();
const post = (method, params = {}) => new Promise((yes, no) => session.post(method, params, (e, r) => e ? no(e) : yes(r)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
const names = ['compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'SectionRationalContext', 'ExactAffinePlane', 'admitConvexNativeLineLoop', 'buildConvexPlanarFaceWithHoles', 'booleanCoplanarFaces', 'clipCurveWithConvexLineLoop', 'work'];
const count = data => Object.fromEntries(names.map(n => [n, data.result.flatMap(s => s.functions.filter(f => f.functionName === n)).reduce((a, f) => a + f.ranges[0].count, 0)]));
const rows = []; let pendingCounts = null;
try {
  for (const [parameterId, valueMM] of [['parentHeight', 6], ['rearX', 20]]) {
    pendingCounts = null;
    let failure;
    try { api.updateXYAffinePrismFeatureDocumentV1(prior, { expectedRevision: prior.document.revision, revision: prior.document.revision + 1, parameterEdits: [{ parameterId, valueMM }] }); } catch (error) { failure = error; }
    assert.ok(failure instanceof api.XYAffinePrismFeatureError); assert.equal(failure.code, 'NATIVE');
    const causes = []; for (let error = failure; error; error = error.cause) causes.push(error.message);
    assert.match(causes.join(' | '), /lift.*exact|pcurve.*exact/i);
    assert.equal(hash(prior), before);
    const data = await post('Profiler.takePreciseCoverage');
    const counts = count(data); pendingCounts = counts;
    assert.ok(counts.compileCadModel <= 408 && counts.buildConvexPlanarFace <= 394 && counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= 17820);
    assert.equal(counts.buildConvexPlanarFaceWithHoles + counts.booleanCoplanarFaces + counts.clipCurveWithConvexLineLoop, 0);
    assert.equal(counts.ExactAffinePlane, counts.admitConvexNativeLineLoop); assert.ok(counts.ExactAffinePlane <= counts.buildConvexPlanarFace);
    const legacy = counts.SectionRationalContext - counts.ExactAffinePlane; assert.ok(legacy >= 0 && legacy <= 40); assert.ok(counts.work <= 8000000);
    rows.push({ parameterId, valueMM, code: failure.code, stage: failure.stage, causes, beforeHash: before, afterHash: hash(prior), counts }); pendingCounts = null;
    writeFileSync(resolve(output, 'refusal-compatibility.json'), JSON.stringify({ status: 'in-progress', rows }, null, 2) + '\n');
  }
  writeFileSync(resolve(output, 'refusal-compatibility.json'), JSON.stringify({ status: 'passed', rows }, null, 2) + '\n');
} catch (error) {
  const failureCounts = count(await post('Profiler.takePreciseCoverage'));
  writeFileSync(resolve(output, 'first-failure.json'), JSON.stringify({ message: error.message, stack: error.stack, completed: rows, pendingCounts, failureCounts }, null, 2) + '\n'); throw error;
} finally { await post('Profiler.stopPreciseCoverage'); session.disconnect(); }
