import { convexBody } from '../test/modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { prove, bounds, capPair } from '../test/modeling-cardinal-split-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const directory = resolve(process.argv[2]), entry = resolve(process.argv[3] ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad } = await import(pathToFileURL(entry).href);
const flow = { status: 'running', evaluations: 0, stages: [], entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'cold-flow.json'), JSON.stringify(flow, null, 2) + '\n');
const stage = (label, action) => { const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024); assert.ok(++flow.evaluations <= 2); const start = performance.now(), result = action(); flow.stages.push({ label, elapsedMS: performance.now() - start }); return result; };
try {
  const text = readFileSync(resolve(directory, 'edited.cad-model.json'), 'utf8');
  const reopened = stage('emitted cold X24', () => cad.load(text));
  prove(convexBody(reopened,'negative'), 5888); prove(convexBody(reopened,'positive'), 1280);
  bounds(convexBody(reopened,'negative'), 0, 0, 24); bounds(convexBody(reopened,'positive'), 0, 24, 32); capPair(reopened.evidence[2].native, 0);
  assert.equal(reopened.save(), text); assert.deepEqual(reopened.features[2], { kind: 'split', index: 2, dependencies: [1] });
  const edited = stage('emitted re-edit X16', () => reopened.withParameters({ splitAt: 16 }));
  prove(convexBody(edited,'negative'), 4096); prove(convexBody(edited,'positive'), 3072);
  bounds(convexBody(edited,'negative'), 0, 0, 16); bounds(convexBody(edited,'positive'), 0, 16, 32); capPair(edited.evidence[2].native, 0);
  assert.equal(reopened.save(), text); flow.status = 'passed'; flow.reopenedVolumes = [5888,1280]; flow.reeditedVolumes = [4096,3072];
  flow.authoredInputSHA256 = createHash('sha256').update(text).digest('hex'); flow.reeditedAuthored = edited.save(); write();
} catch (error) { flow.status = 'failed'; flow.failure = { message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
