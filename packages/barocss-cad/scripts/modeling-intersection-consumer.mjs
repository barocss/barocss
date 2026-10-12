import { convexBody } from '../test/modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { prove } from '../test/modeling-intersection-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const directory = resolve(process.argv[2]), entry = resolve(process.argv[3] ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad } = await import(pathToFileURL(entry).href);
const stages = [], stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(stages.length < 2); const start = performance.now(), result = action();
  stages.push({ label, elapsedMS: performance.now() - start }); return result;
};
try {
  const text = readFileSync(resolve(directory, 'edited.cad-model.json'), 'utf8');
  const reopened = stage('emitted fresh-process authored file load', () => cad.load(text));
  prove(convexBody(reopened,'overlap'), 1408, [7, 15, 10]); assert.equal(reopened.save(), text);
  assert.deepEqual(Object.keys(reopened.bodies), ['overlap']);
  assert.deepEqual(reopened.features[4], { kind: 'intersect', index: 4, dependencies: [1, 3] });
  const edited = stage('emitted reopened height2 edit', () => reopened.withParameters({ height: 2 }));
  prove(convexBody(edited,'overlap'), 704, [7, 15, 10]); assert.equal(reopened.save(), text);
  writeFileSync(resolve(directory, 'cold-reedited.cad-model.json'), edited.save());
  writeFileSync(resolve(directory, 'cold-result.json'), JSON.stringify({ status: 'passed', evaluations: 2, stages,
    entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex'), inputSHA256: createHash('sha256').update(text).digest('hex'),
    reopenedVolumeMM3: 1408, reeditedVolumeMM3: 704 }, null, 2) + '\n');
} catch (error) {
  writeFileSync(resolve(directory, 'cold-failure.json'), JSON.stringify({ stages, message: error.message, stack: error.stack, cause: error.cause?.message }, null, 2) + '\n');
  throw error;
}
