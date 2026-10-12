import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { chainProof } from '../test/modeling-chamfer-chain-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const directory = resolve(process.argv[2]), entry = resolve(process.argv[3] ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad } = await import(pathToFileURL(entry).href);
const flow = { status: 'running', evaluations: 0, stages: [], entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'cold-flow.json'), JSON.stringify(flow, null, 2) + '\n');
const stage = (label, action) => { const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024); assert.ok(++flow.evaluations <= 2); const start = performance.now(), result = action(); flow.stages.push({ label, elapsedMS: performance.now() - start }); return result; };
try {
  const text = readFileSync(resolve(directory, 'edited.cad-model.json'), 'utf8');
  const reopened = stage('emitted cold front1 back3', () => cad.load(text));
  flow.reopened = chainProof(reopened, 16, 144, 5984); assert.equal(reopened.save(), text);
  const edited = stage('emitted re-edit back2', () => reopened.withParameters({ backDistance: 2 }));
  flow.reedited = chainProof(edited, 16, 64, 6064); assert.equal(reopened.save(), text);
  flow.status = 'passed'; flow.authoredInputSHA256 = createHash('sha256').update(text).digest('hex'); flow.reeditedAuthored = edited.save(); write();
} catch (error) { flow.status = 'failed'; flow.failure = { message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
