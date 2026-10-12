import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { provePart, work, bodyHash } from '../test/modeling-regeneration-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const directory = resolve(process.argv[2]), entry = resolve(process.argv[3] ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad } = await import(pathToFileURL(entry).href);
const flow = { status: 'running', modelCalls: 0, stages: [], entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'cold-flow.json'), JSON.stringify(flow, null, 2) + '\n');
const stage = (label, action) => { const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024); assert.ok(++flow.modelCalls <= 2); const start = performance.now(), result = action(); flow.stages.push({ label, elapsedMS: performance.now() - start, recomputation: result.recomputation }); return result; };
try {
  const source = JSON.parse(readFileSync(resolve(directory, 'source-flow.json'), 'utf8'));
  const text = readFileSync(resolve(directory, 'edited.cad-model.json'), 'utf8');
  const reopened = stage('emitted cold edited file', () => cad.load(text));
  work(reopened, [], [0,1,2,3]); flow.reopened = provePart(reopened, 32, 8, 1, 3); assert.equal(reopened.save(), text);
  assert.equal(bodyHash(reopened), source.editedBodySHA256);
  const edited = stage('emitted second-distance re-edit', () => reopened.withParameters({ backDistance: 2 }));
  work(edited, [0,1,2], [3], reopened); flow.reedited = provePart(edited, 32, 8, 1, 2);
  assert.equal(edited.save(), readFileSync(resolve(directory, 'initial.cad-model.json'), 'utf8'));
  assert.equal(bodyHash(edited), source.initialBodySHA256); assert.equal(reopened.save(), text);
  flow.status = 'passed'; flow.authoredInputSHA256 = createHash('sha256').update(text).digest('hex'); flow.reopenedBodySHA256 = bodyHash(reopened); flow.reeditedBodySHA256 = bodyHash(edited); write();
} catch (error) { flow.status = 'failed'; flow.failure = { message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
