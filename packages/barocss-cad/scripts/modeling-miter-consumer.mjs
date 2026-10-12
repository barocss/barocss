import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { proveMiter, work, bodyHash } from '../test/modeling-miter-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const directory = resolve(process.argv[2]), entry = resolve(process.argv[3] ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad } = await import(pathToFileURL(entry).href);
const flow = { status: 'running', modelCalls: 0, stages: [], entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'cold-flow.json'), JSON.stringify(flow, null, 2) + '\n');
const stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024); assert.ok(++flow.modelCalls <= 2);
  flow.pending = label; write(); const start = performance.now(), result = action();
  flow.stages.push({ label, elapsedMS: performance.now() - start, recomputation: result.recomputation }); flow.pending = null; write(); return result;
};
const errorData = error => error instanceof Error ? { name: error.name, code: error.code, operation: error.operation, stage: error.stage, entity: error.entity, message: error.message, stack: error.stack, cause: errorData(error.cause) } : error;
try {
  const source = JSON.parse(readFileSync(resolve(directory, 'source-flow.json'), 'utf8'));
  const text = readFileSync(resolve(directory, 'edited.cad-model.json'), 'utf8');
  const reopened = stage('emitted cold miter sum28', () => cad.load(text));
  work(reopened, [], [0,1,2]); flow.reopened = proveMiter(reopened, 28, 3072, 3072);
  assert.equal(reopened.save(), text); assert.equal(bodyHash(reopened), source.editedBodySHA256);
  const edited = stage('emitted sum24 re-edit', () => reopened.withParameters({ cutPosition: 24 }));
  work(edited, [0,1], [2], reopened); flow.reedited = proveMiter(edited, 24, 2304, 3840);
  assert.equal(bodyHash(edited), source.initialBodySHA256);
  assert.equal(reopened.save(), text); assert.equal(bodyHash(reopened), source.editedBodySHA256);
  assert.equal(flow.modelCalls, 2); flow.status = 'passed'; flow.authoredInputSHA256 = createHash('sha256').update(text).digest('hex'); flow.reopenedBodySHA256 = bodyHash(reopened); flow.reeditedBodySHA256 = bodyHash(edited); write();
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); write(); throw error; }
