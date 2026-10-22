// FRk6 timing run (D178): baseline and candidate on the same host, serially, apart from the correctness tests.
// Prints the samples; FRK6_REQUIRE_TARGET=1 asserts the unchanged 2000 ms median.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadavg } from 'node:os';
const api = await import(process.env.FRK6_CAD_MODULE ? pathToFileURL(resolve(process.env.FRK6_CAD_MODULE)).href : '../dist/index.js');
const document = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{
  id: 't', kind: 'frame', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 }, corners: { multi: 'order' },
  points: [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 700], [600, 0, 700], [600, 400, 700], [0, 400, 700]],
  segments: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]],
}] };
const samples = [];
for (let i = 0; i < 4; i++) {
  const load = loadavg(), start = performance.now(), snapshot = api.evaluateCadPart(document);
  snapshot.outputs.forEach(o => o.brep);
  assert.equal(snapshot.outputs.length, 8);
  samples.push({ warmup: i === 0, milliseconds: performance.now() - start, load });
}
const measured = samples.slice(1).map(s => s.milliseconds).sort((a, b) => a - b), median = measured[1];
console.log(JSON.stringify({ module: process.env.FRK6_CAD_MODULE ?? '../dist/index.js', node: process.version, samples, N: 3, medianMS: median, minMS: measured[0], maxMS: measured[2], targetMS: 2000, targetMet: median <= 2000 }, null, 2));
if (process.env.FRK6_REQUIRE_TARGET === '1') assert.ok(median <= 2000, `${median}ms exceeds the unchanged 2000ms target`);
