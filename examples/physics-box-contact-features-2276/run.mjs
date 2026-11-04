import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..');
const [buildId, runId] = process.argv.slice(2);
if (![buildId, runId].every(id => /^[a-z0-9-]+$/.test(id ?? ''))) throw Error('build ID and fresh run ID required');
const build = resolve(home, 'evidence', buildId), out = resolve(home, 'evidence', runId);
mkdirSync(out);
const sha = data => createHash('sha256').update(data).digest('hex');
const pinned = JSON.parse(readFileSync(resolve(build, 'source-pins.json')));
for (const [name, pin] of Object.entries(pinned)) {
  const b = readFileSync(resolve(home, name)); assert.equal(b.length, pin.bytes, 'byte drift ' + name); assert.equal(sha(b), pin.sha256, 'source drift ' + name);
}
const buildResult = JSON.parse(readFileSync(resolve(build, 'result.json'))); assert.equal(buildResult.status, 'PASS_PRIVATE_BUILD');
const bank = JSON.parse(readFileSync(resolve(home, 'cases.json')));
for (const [name, pin] of Object.entries(bank.pins)) {
  const b = readFileSync(resolve(root, name)); assert.equal(b.length, pin.bytes); assert.equal(sha(b), pin.sha256);
}
assert(bank.cases.length <= 24); assert.equal(bank.cases.filter(c => c.populationGroup === 'original-P4-32').flatMap(c => c.expectedOriginalPoints).length, 32);
const words = value => {
  const result = {};
  function walk(x, path) {
    if (typeof x === 'number') { const b = Buffer.alloc(8); b.writeDoubleBE(x); result[path] = b.toString('hex'); }
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) walk(v, path + '/' + k);
  }
  walk(value, ''); return result;
};
let bytes = 0, graphBytes = 0;
const put = (name, value) => {
  const s = JSON.stringify(value, null, 2) + '\n'; graphBytes += Buffer.byteLength(s); bytes += Buffer.byteLength(s);
  assert(graphBytes <= 16 * 1024 ** 2, 'per-graph evidence budget');
  writeFileSync(resolve(out, name), s, { flag: 'wx' });
};
put('frozen-inputs.json', { sources: pinned, bank, words: words(bank), buildResult });
const outputs = new Map(), counts = {}, population = {};
let currentGraph = '', currentCase = '', firstFailure = null;
try {
  for (const graph of ['source', 'strict-nodenext']) {
    currentGraph = graph; graphBytes = 0;
    const modulePath = graph === 'source' ? resolve(build, 'source.mjs') : resolve(build, 'strict/candidate.js');
    const expected = buildResult.outputs[graph === 'source' ? 'source' : 'strict'];
    const code = readFileSync(modulePath); assert.equal(code.length, expected.bytes); assert.equal(sha(code), expected.sha256);
    const api = await import(pathToFileURL(modulePath));
    counts[graph] = { attemptedCases: 0, completedCases: 0, returnedPoints: 0, WorldCalls: 0 };
    population[graph] = { originalRows: 0, returnedRows: 0, sameRawPointRows: 0, maximumMatchedMovementM: 0 };
    for (const [index, c] of bank.cases.entries()) {
      currentCase = c.id;
      const name = graph + '-' + String(index).padStart(2, '0') + '-' + c.id;
      const input = structuredClone({ id: c.id, a: c.a, b: c.b });
      put(name + '-input.json', { caseId: c.id, phase: c.phase, input, words: words(input) });
      counts[graph].attemptedCases++;
      const result = api.boxContact(input);
      put(name + '-output.json', { caseId: c.id, phase: c.phase, result, words: words(result) });
      if (graph === 'source') outputs.set(c.id, { result, words: words(result) });
      else assert.deepEqual({ result, words: words(result) }, outputs.get(c.id), 'Source/strict raw parity ' + c.id);
      assert.notEqual(result.status, 'UNRESOLVED', 'unresolved ' + c.id + ': ' + result.reason);
      if (c.expectedFeature === 'MISS') assert.equal(result.status, 'MISS', 'classification ' + c.id);
      else {
        assert.equal(result.status, 'HIT', 'contact ' + c.id);
        if (c.expectedFeature) assert.equal(result.feature.kind, c.expectedFeature, 'feature ' + c.id);
        assert(result.points.length > 0 && result.points.length <= 4);
        for (const p of result.points) assert.equal(p.nativeHalfspacesCertified, 12);
        if (c.acceptedGapGateM) for (const p of result.points) assert(Math.hypot(...p.bPointM.map((x, i) => x - p.aPointM[i])) <= c.acceptedGapGateM, 'accepted paired gap ' + c.id);
      }
      counts[graph].returnedPoints += result.points.length; assert(counts[graph].returnedPoints <= 96);
      if (c.populationGroup === 'original-P4-32') {
        const audit = population[graph]; audit.originalRows += c.expectedOriginalPoints.length; audit.returnedRows += result.points.length;
        assert.equal(result.points.length, c.expectedOriginalPoints.length, 'original point population ' + c.id);
        const unused = [...result.points];
        for (const original of c.expectedOriginalPoints) {
          const distance = p => Math.hypot(...p.pointM.map((x, i) => x - original.pointM[i]));
          const best = unused.reduce((a, b) => distance(a) <= distance(b) ? a : b);
          audit.maximumMatchedMovementM = Math.max(audit.maximumMatchedMovementM, distance(best));
          if (Object.values(words(best.pointM)).every((x, i) => x === Object.values(words(original.pointM))[i])) audit.sameRawPointRows++;
          unused.splice(unused.indexOf(best), 1);
        }
      }
      counts[graph].completedCases++;
    }
    assert.equal(population[graph].originalRows, 32); assert.equal(population[graph].returnedRows, 32);
  }
} catch (error) {
  firstFailure = { graph: currentGraph, caseId: currentCase, name: error.name, message: error.message, stack: error.stack };
  process.exitCode = 1;
}
put('result.json', { status: firstFailure ? 'PRIVATE_GEOMETRY_NO_GO' : 'PASS_PRIVATE_CONSTRUCTION_AND_GRAPH_PARITY',
  counts, population, firstFailure, evidenceBytes: bytes, independentNativeGeometry: 'NOT_RUN',
  physicalDynamics: 'NOT_QUALIFIED', productionIntegration: 'NOT_RUN', publicBaseline: 'UNCHANGED_NO_GO', originalP4: 'UNCHANGED_NO_GO' });
console.log(JSON.stringify({ status: firstFailure ? 'PRIVATE_GEOMETRY_NO_GO' : 'PASS_PRIVATE_CONSTRUCTION_AND_GRAPH_PARITY', counts, population, firstFailure }));
