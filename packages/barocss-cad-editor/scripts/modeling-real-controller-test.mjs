// Replays exact source/cold native replies through the real controller; no geometry is rerun.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), evidence = resolve(process.argv[2] ?? resolve(import.meta.dirname, 'fixtures/modeling-native')), output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-modeling-real-controller');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({ entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/modeling-controller.ts')], bundle: true, platform: 'node', format: 'esm', write: false,
  alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src/index.ts') } });
writeFileSync(resolve(output, 'controller.mjs'), bundle.outputFiles[0].text);
const { createCadEditorModelingController: create } = await import(pathToFileURL(resolve(output, 'controller.mjs')));
const source = JSON.parse(readFileSync(resolve(evidence, 'source-observed.json'), 'utf8'));
const cold = JSON.parse(readFileSync(resolve(evidence, 'cold-observed.json'), 'utf8'));
const workers = [];
globalThis.Worker = class {
  callbacks = new Map(); requests = [];
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks.set(kind, callback); }
  postMessage(request) { this.requests.push(request); }
  terminate() {}
  send(reply) { this.callbacks.get('message')({ data: { ...structuredClone(reply), id: this.requests.at(-1).id } }); }
};
const session = create(); let p = session.example(), worker = workers.at(-1); worker.send(source[0]); await p;
assert.ok(session.getSnapshot().accepted, session.getSnapshot().error);
session.stage('height', '6'); session.stage('rearX', '20'); p = session.apply(); worker.send(source[1]); await p;
assert.equal(session.getSnapshot().accepted.parameters.height, 6); assert.equal(session.getSnapshot().history.count, 2);
const generation = session.getSnapshot().generation;
p = session.open(cold[0].text); worker.send(cold[0]); await p;
assert.equal(session.getSnapshot().error, null); assert.equal(session.getSnapshot().history.count, 1);
assert.throws(() => session.pick(100, 100, 50, 50, generation), /stale/);
session.stage('setback', '2'); p = session.apply(); worker.send(cold[1]); await p;
assert.equal(session.getSnapshot().error, null); assert.equal(session.getSnapshot().accepted.parameters.setback, 2);
assert.deepEqual(session.getSnapshot().accepted.outputs.find(o => o.name === 'part').volumeMM3, { numerator: '2464', denominator: '1' });
assert.equal(session.getSnapshot().authoredText, cold[1].text); session.dispose();
const result = { ok: true, acceptedNativeReplies: 4, checks: ['initial model', 'batch dimensions', 'cold saved-state open', 'continued edit', 'stale selection', 'named output volume'],
  evidence: 'recorded real native outputs through actual controller + mocked Worker; no new native, browser/GPU or OS file calls' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
