import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {digest} from './proof-storage.mjs';

/** Immutable actual outputs, not a producer replay or an expected-answer cache. */
export function loadSourcePrefix(root, here) {
  const archive = resolve(here, 'evidence/first-world-039f4852');
  const manifestBytes = readFileSync(resolve(archive, 'manifest.json'));
  assert.equal(digest(manifestBytes), '8a1c5f7fd1b3e16fd311c456a87f5fcc9300fb447a515c75f2c76a1df721420f');
  const manifest = JSON.parse(manifestBytes);
  for (const pin of manifest.files) {
    const bytes = readFileSync(resolve(archive, pin.path));
    assert.equal(bytes.length, pin.bytes); assert.equal(digest(bytes), pin.sha256);
  }
  // Only the actual producer closure supports reuse of the completed constructor gates.
  const graph = JSON.parse(readFileSync(resolve(archive, 'flow/source-graph.json')));
  for (const pin of graph.audit.inputs) {
    const bytes = readFileSync(resolve(root, pin.path));
    assert.equal(digest(bytes), pin.sha256, 'passed producer source changed: ' + pin.path);
  }
  const recordBytes = readFileSync(resolve(archive, 'flow/source-proof/controls.records.jsonl'));
  const records = recordBytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  assert.equal(records.length, 20);
  assert.ok(records.slice(0, 18).every(record => record.passed === true));
  assert.equal(records[18].name, 'constructor-input-copy');
  assert.equal(records[19].name, 'W0-initial-native');
  const completed = resolve(here, 'evidence/saved-initial-04ffb17a');
  const input = readFileSync(resolve(completed, 'stdin.raw'));
  const output = readFileSync(resolve(completed, 'stdout.raw'));
  assert.equal(digest(input), '4f0a978500157b8ec7922f597a580d07f9dbdc3e485d7a941cc32c0672518f86');
  assert.equal(digest(output), 'a61debde83d4b92a5946ad75f178daacc699813f3b7056a565548032cdc9c524');
  const receipt = JSON.parse(readFileSync(resolve(completed, 'receipt.json')));
  assert.equal(receipt.exitCode, 0); assert.equal(receipt.savedInitialRequests, 1);
  const I0 = JSON.parse(input), initialReply = JSON.parse(output);
  assert.deepEqual(I0, records[19].request);
  assert.equal(initialReply.ok, true); assert.equal(initialReply.referenceStatus, 'RETURN');
  return {recordBytes, rawBytes: readFileSync(resolve(archive, 'flow/source-proof/controls.bodies.raw')),
    records, I0, initialReply, initialCheckpoint: records[19].snapshot,
    initialInputBytes: input, initialOutputBytes: output,
    historicalCounts: {publicConstructors: 1, privateConstructors: 18, failedInitialRequests: 1,
      completedInitialRequests: 1, worldSteps: 0, projectionCalls: 0},
    manifestSha256: digest(manifestBytes)};
}

export function retainPrefix(storage, prefix) {
  storage.append('controls.records.jsonl', prefix.recordBytes, 'controls');
  storage.append('controls.bodies.raw', prefix.rawBytes, 'controls');
  storage.append('completed-initial.stdin.raw', prefix.initialInputBytes, 'controls');
  storage.append('completed-initial.stdout.raw', prefix.initialOutputBytes, 'controls');
}

export function writeCompositeReference(directory, prefix, receipt) {
  for (const [stream, initial, current] of [
    ['reference.stdin.raw', 'completed-initial.stdin.raw', receipt.stdin],
    ['reference.stdout.raw', 'completed-initial.stdout.raw', receipt.stdout],
  ]) {
    const bytes = stream.includes('stdin') ? prefix.initialInputBytes.length : prefix.initialOutputBytes.length;
    const value = {representation: 'actual completed initial process plus actual continuation process',
      segments: [{path: initial, offset: 0, bytes,
        sha256: digest(stream.includes('stdin') ? prefix.initialInputBytes : prefix.initialOutputBytes),
        completeLines: 1, trailingBytes: 0, completeEOF: true},
        {path: stream, offset: 0, bytes: current.bytes, sha256: current.sha256,
          completeLines: current.completeLines, trailingBytes: current.trailingBytes, completeEOF: current.completeEOF}],
      logicalBytes: bytes + current.bytes, completeEOF: current.completeEOF,
      originalFailedInitialExcluded: true};
    writeFileSync(resolve(directory, stream + '.composite.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  }
}
