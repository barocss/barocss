// One authored browser packet plus an OS-network-denied CLI metadata decoder, no inference.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshotCatalog, catalogHash, inspectCatalog, verifyCatalogOffline } from './model-catalog.mjs';
import { preparePacket, validatePacket, digest, DECLARATION_DIGEST, buildArgv } from './launch-packet.mjs';
import { runExperiment, executionCommand, hasLiveTimingEvidence } from './run-packet.mjs';
import { createCodexTransport, disposePacketTransport } from './codex-transport.mjs';
import { fakeCodex } from './fake-codex.mjs';
import { REQUEST_CONTRACT } from './scenario.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-render catalog-'));
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(root, name), typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 });
let driftGenerate;
try {
  const source = process.env.CATALOG_SOURCE || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'models_cache.json');
  const catalog = snapshotCatalog(source, 'gpt-6.1-sol', 'high');
  write('model-catalog.json', catalog.text);
  const value = read('model-catalog.json');
  assert.deepEqual(Object.keys(value), ['models']); assert.equal(value.models.length, 1);
  const cliPath = execFileSync('which', ['codex'], { encoding: 'utf8' }).trim();
  assert.equal(execFileSync(cliPath, ['--version'], { encoding: 'utf8' }).trim(), 'codex-cli 0.156.1');
  const checked = verifyCatalogOffline(path.join(root, 'model-catalog.json'), { root, cliPath, nodeBin: path.dirname(process.execPath),
    model: 'gpt-6.1-sol', effort: 'high', digest: catalog.digest });
  assert.equal(checked.status, 'verified-offline'); assert.equal(checked.modelInference, false); assert.equal(checked.auth, 'none');
  assert.equal(fs.existsSync(path.join(root, 'catalog-check/codex-home/auth.json')), false);
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const packet = preparePacket({ candidateSha, cliPath: '/authored/never-executed', nodeBin: '/authored/bin', root, modelCatalogDigest: catalog.digest });
  assert.equal(packet.version, 'request-ui-packet-v2');
  const runId = '11111111-2222-4333-8444-555555555555';
  const scenario = {
    request: 'Use a single-column Layout without a Card. Give the name and topic fields concise labels and the review button the label Review details. Keep the permitted host fields and summaries.',
    input: { draft: { name: '민지', topic: '커피' } }, edits: ['Tea 차 두 잔', 'Hot tea 따뜻한 차'], actions: ['review', 'edit', 'review', 'confirm'],
  };
  const experiment = { version: 'browser-packet-v1', candidateSha, packet, packetDigest: validatePacket(packet), declarationsDigest: DECLARATION_DIGEST,
    runId, runnerDigest: digest(fs.readFileSync(new URL('./run-packet.mjs', import.meta.url), 'utf8')), command: executionCommand(root), scenario };
  const approval = { kind: 'fake-test', candidateSha, packetDigest: experiment.packetDigest, declarationsDigest: DECLARATION_DIGEST,
    experimentDigest: digest(experiment), runId };
  const fake = fakeCodex();
  const result = await runExperiment(experiment, { approval, spawnProcess: fake.spawnProcess });
  assert.equal(result.status, 'completed'); assert.equal(result.counts.useful, 5); assert.equal(fake.calls.length, 5);
  const report = read('report.json');
  assert.equal(report.modelCatalogDigest, catalog.digest); assert.equal(report.latency.liveModelEvidence, false);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.csp, []); assert.deepEqual(report.external, []);
  for (const [index, call] of fake.calls.entries()) {
    assert.equal(call.file, '/authored/never-executed');
    const args = call.argv.filter((arg) => arg.startsWith('model_catalog_json='));
    assert.deepEqual(args, [`model_catalog_json=${JSON.stringify(path.join(root, 'model-catalog.json'))}`]);
    if (index) assert.equal(call.argv[1], 'resume');
    assert.equal(read(`turn-${index + 1}-result.json`).modelCatalogDigest, catalog.digest);
  }
  assert.equal(catalogHash(fs.readFileSync(path.join(root, 'model-catalog.json'))), catalog.digest);
  assert.equal(hasLiveTimingEvidence('codex-cli', 0), false);
  assert.equal(hasLiveTimingEvidence('codex-cli', 4), true);
  assert.equal(hasLiveTimingEvidence('codex-cli-fake', 4), false);
  // Historical packet construction remains detached and valid for authored fixtures.
  const legacy = preparePacket({ candidateSha, cliPath: '/authored/no', nodeBin: '/authored/bin', root });
  assert.equal(legacy.version, 'request-ui-packet-v1'); validatePacket(legacy);
  assert.equal(buildArgv(legacy, { finalPath: path.join(root, 'legacy.txt') }).some((arg) => arg.startsWith('model_catalog_json=')), false);

  const privateInput = { client_version: 'authored', identity: 'PRIVATE-IDENTITY', etag: 'PRIVATE-ETAG', tokens: 'PRIVATE-AUTH', models: value.models };
  write('source.json', privateInput);
  assert.equal(snapshotCatalog(path.join(root, 'source.json'), 'gpt-6.1-sol', 'high').text, catalog.text);
  for (const models of [[], [...value.models, ...value.models], [{ ...value.models[0], supported_reasoning_levels: [{ effort: 'low' }] }]]) {
    write('source.json', { ...privateInput, models });
    assert.throws(() => snapshotCatalog(path.join(root, 'source.json'), 'gpt-6.1-sol', 'high'));
  }
  write('source.json', { models: [{ ...value.models[0], description: 'x'.repeat(1_048_576) }] });
  assert.throws(() => snapshotCatalog(path.join(root, 'source.json'), 'gpt-6.1-sol', 'high'), /too large/);
  fs.chmodSync(path.join(root, 'model-catalog.json'), 0o644);
  assert.throws(() => inspectCatalog(path.join(root, 'model-catalog.json'), catalog.digest, 'gpt-6.1-sol', 'high'));
  fs.chmodSync(path.join(root, 'model-catalog.json'), 0o600);
  fs.symlinkSync(path.join(root, 'model-catalog.json'), path.join(root, 'linked-catalog.json'));
  assert.throws(() => inspectCatalog(path.join(root, 'linked-catalog.json'), catalog.digest, 'gpt-6.1-sol', 'high'));
  assert.throws(() => inspectCatalog(path.join(root, 'model-catalog.json'), '0'.repeat(64), 'gpt-6.1-sol', 'high'));

  // A change after an accepted initial response must fail before any resume, then remain halted.
  const driftRoot = path.join(root, 'drift'); fs.mkdirSync(driftRoot, { mode: 0o700 });
  fs.writeFileSync(path.join(driftRoot, 'model-catalog.json'), catalog.text, { mode: 0o600 });
  const driftPacket = preparePacket({ candidateSha, cliPath: '/authored/never-executed', nodeBin: '/authored/bin', root: driftRoot, modelCatalogDigest: catalog.digest });
  const driftFake = fakeCodex();
  driftGenerate = createCodexTransport({ packet: driftPacket,
    approval: { kind: 'fake-test', candidateSha, packetDigest: validatePacket(driftPacket), runId }, spawnProcess: driftFake.spawnProcess });
  const request = { kind: 'initial', sessionId: runId, revision: 0, requestId: `${runId}:1`, action: null, target: 'form',
    input: scenario.input, screenRequest: scenario.request, contract: REQUEST_CONTRACT };
  await driftGenerate(request);
  fs.appendFileSync(path.join(driftRoot, 'model-catalog.json'), ' ');
  const next = { ...request, kind: 'next', revision: 1, requestId: `${runId}:2`, action: 'review', target: 'review' };
  await assert.rejects(driftGenerate(next), /catalog changed/); await assert.rejects(driftGenerate(next), /stopped/);
  assert.equal(driftFake.calls.length, 1); assert.equal(fs.existsSync(path.join(driftRoot, 'turn-2-reservation.json')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(driftRoot, 'invalidated.json'), 'utf8')).reason, 'model-catalog-drift');
  console.log(JSON.stringify({ status: 'passed', source: 'one authored browser packet; offline metadata parser', displays: 5,
    sourceVersion: catalog.sourceVersion, offlineCLI: '0.156.1', decoderNetwork: 'OS denied', decoderAuth: 'none',
    modelInference: false, catalogDriftStops: true, zeroSampleEvidence: false, legacyFixturesPreserved: true }));
} finally { disposePacketTransport(driftGenerate); fs.rmSync(root, { recursive: true, force: true }); }
