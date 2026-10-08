import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCurveOperationCases } from './curve-operations-fixture.mjs';

assert.equal(process.argv.length, 3, 'Usage: node curve-operations-generate.mjs <evidence-directory>');
const evidence = resolve(process.argv[2]);
const sources = fileURLToPath(new URL('./curve-operations-data/', import.meta.url));
mkdirSync(evidence, { recursive: true });
mkdirSync(sources, { recursive: true });

// JSON.stringify turns -0 into 0. Preserve native signed-zero bits in saved records.
function nativeJSON(value) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value));
    return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(nativeJSON).join(',')}]`;
  return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${nativeJSON(item)}`).join(',')}}`;
}

const summary = [];
for (const item of createCurveOperationCases()) {
  const { key, result } = item;
  writeFileSync(resolve(evidence, `${key}.owned-result.json`), `${nativeJSON(result)}\n`);
  writeFileSync(resolve(evidence, `${key}.original.barocad`), result.originalSource);
  writeFileSync(resolve(evidence, `${key}.output.barocad`), result.source);
  writeFileSync(resolve(sources, `${key}.barocad`), result.source);
  summary.push({ key, originalId: result.original.id, outputId: result.curve.id,
    originalPoles: result.original.controlPoints.length, outputPoles: result.curve.controlPoints.length,
    outputKnots: result.curve.knots.length, outputBytes: Buffer.byteLength(result.source) });
}
writeFileSync(resolve(evidence, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary));
