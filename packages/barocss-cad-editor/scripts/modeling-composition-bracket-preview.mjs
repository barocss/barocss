// #1751: separately granted retained-body capture only. Never evaluates a model.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, statfsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cadTests = resolve(here, '../../barocss-cad/test');
const transferPath = join(cadTests, 'modeling-composition-evidence/baseline-transfer.json');
const verificationPath = join(cadTests, 'modeling-composition-evidence/verification.json');
const helperPath = join(cadTests, 'stored-circle-prism-solid-fixture.mjs');
const sha = value => createHash('sha256').update(value).digest('hex');
const TRANSFER_SHA = '9a8ac520f0d4577b3a7e0ff411182e1c176eaaf8c73ac75073c129ae6380b79f';
const VERIFICATION_SHA = '45447cd9d8ecc62303997182df56d656d752fc6ea9971374d3c6617e17a366fa';
const HELPER_SHA = '4b21c827ae6fee1b3882ca037e00902a1d8301b48d2936b3cce507a8406d6850';
assert.equal(process.argv.length, 4, 'Usage: node driver.mjs <verified-runtime-directory> <new-output-file>');
assert.equal(process.versions.node, '22.23.3', 'Use the frozen Node22 toolchain');
const runtimeDirectory = resolve(process.argv[2]), output = resolve(process.argv[3]);
const transferBytes = readFileSync(transferPath), verificationBytes = readFileSync(verificationPath);
assert.equal(sha(transferBytes), TRANSFER_SHA); assert.equal(sha(verificationBytes), VERIFICATION_SHA);
assert.equal(sha(readFileSync(helperPath)), HELPER_SHA);
// The existing, hash-pinned helper only serializes/copied data and arithmetic.
const { signedData, dataHash } = await import(pathToFileURL(helperPath).href);
const transfer = JSON.parse(transferBytes), verification = JSON.parse(verificationBytes);
const runtimeHashes = verification.emittedRuntimeHashes;
assert.equal(Object.keys(runtimeHashes).length, 268);
function runtimeFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? runtimeFiles(join(directory, entry.name), prefix + entry.name + '/')
    : entry.name.endsWith('.js') ? [prefix + entry.name] : []);
}
assert.deepEqual(runtimeFiles(runtimeDirectory).sort(), Object.keys(runtimeHashes).sort(), 'Complete exact emitted runtime inventory');
for (const [path, expected] of Object.entries(runtimeHashes)) assert.equal(sha(readFileSync(join(runtimeDirectory, path))), expected, path);
const body = transfer.bodies.bracket;
assert.equal(body.family, 'orthogonal-cell'); const native = body.native;
assert.equal(native.report.schema, 'barocss-axis-box-solid-boolean');
assert.equal(native.report.operation, 'union'); assert.equal(native.report.volumeMM3, 3072);
assert.equal(native.panels.length, 14); assert.equal(native.sources.length, 14);
const bodyBefore = signedData(native), transferBefore = signedData(transfer);
const free = () => { const s = statfsSync(dirname(output)); return s.bavail * s.bsize; };
assert.ok(free() >= 500 * 1024 * 1024, '500MiB disk floor');
const receipt = {
  issue: 1751, status: 'started', providerCommit: '4cd5237c400784d8ce51cccbce02a22929832950',
  input: { transferSHA256: TRANSFER_SHA, transferBytes: transferBytes.length, providerVerificationSHA256: VERIFICATION_SHA,
    pureHelperSHA256: HELPER_SHA, nativeBodySHA256: dataHash(native), driverSHA256: sha(readFileSync(fileURLToPath(import.meta.url))), runtimeHashes },
  runtime: process.versions.node, basis: 'authored XYZ; no coordinate conversion',
  scope: 'Fourteen retained bracket Surfaces only; no model, Boolean revalidation, compiler, Face reconstruction, classifier or repeated slotted sampling is invoked by this driver.',
  modelCalls: 0, booleanRevalidations: 0, tessellationAttempts: 0, returnedPackets: 0,
  minimumFreeBytes: free(), preview: [],
};
writeFileSync(output, signedData(receipt) + '\n', { flag: 'wx' });
const persist = () => writeFileSync(output, signedData(receipt) + '\n');
try {
  const { tessellateSurface } = await import(pathToFileURL(join(runtimeDirectory, 'index.js')).href);
  assert.equal(typeof tessellateSurface, 'function');
  for (const panel of native.panels) {
    receipt.minimumFreeBytes = Math.min(receipt.minimumFreeBytes, free());
    assert.ok(receipt.minimumFreeBytes >= 500 * 1024 * 1024, '500MiB disk floor');
    const source = native.sources.find(value => value.sourceId === panel.sourceId);
    assert.ok(source); assert.equal(source.panelId, panel.id);
    assert.equal(signedData(source.model), signedData(panel.bundle.geometry));
    const surface = source.model.objects.find(value => value.kind === 'surface' && value.id === panel.bundle.topology.face.surfaceId);
    assert.ok(surface); assert.equal(panel.bundle.topology.face.id, panel.id);
    const surfaceBefore = signedData(surface), options = { countU: 2, countV: 2, revision: 0 };
    receipt.tessellationAttempts++; persist();
    const result = tessellateSurface(surface, options);
    receipt.preview.push({ panelId: panel.id, sourceId: panel.sourceId, surfaceId: surface.id, options: { ...options }, result });
    receipt.returnedPackets++;
    // Persist every genuine raw return before an oracle can fail. Only this new
    // exclusive output is updated; no previous capture or provider file changes.
    persist();
    assert.equal(signedData(surface), surfaceBefore); assert.deepEqual(options, { countU: 2, countV: 2, revision: 0 });
    const packet = result.packet;
    assert.equal(packet.positions.length, 12); assert.equal(packet.normals.length, 12);
    assert.deepEqual(packet.parameters, [0, 0, 0, 1, 1, 0, 1, 1]);
    assert.deepEqual(packet.indices, [0, 2, 1, 2, 3, 1]);
    for (const [sample, corner] of [0, 3, 1, 2].entries()) {
      const vertex = native.vertices.find(value => value.id === panel.vertexIds[corner]); assert.ok(vertex);
      assert.deepEqual(packet.positions.slice(sample * 3, sample * 3 + 3), vertex.pointMM);
      for (let axis = 0; axis < 3; axis++) assert.ok(packet.normals[sample * 3 + axis] === (axis === panel.axis ? panel.sign : 0));
    }
  }
  assert.equal(receipt.tessellationAttempts, 14); assert.equal(receipt.returnedPackets, 14);
  assert.equal(signedData(native), bodyBefore); assert.equal(signedData(transfer), transferBefore);
  receipt.status = 'PASS'; receipt.previewSHA256 = dataHash(receipt.preview);
  receipt.vertexCount = receipt.preview.reduce((sum, value) => sum + value.result.packet.positions.length / 3, 0);
  receipt.triangleCount = receipt.preview.reduce((sum, value) => sum + value.result.packet.indices.length / 3, 0);
  assert.equal(receipt.vertexCount, 56); assert.equal(receipt.triangleCount, 28); persist();
  console.log(JSON.stringify({ status: receipt.status, tessellations: receipt.tessellationAttempts, modelCalls: 0,
    booleanRevalidations: 0, vertices: receipt.vertexCount, triangles: receipt.triangleCount, outputSHA256: sha(readFileSync(output)) }));
} catch (error) {
  receipt.status = 'FAIL'; receipt.failure = { name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: String(error?.stack ?? '') };
  persist(); throw error;
}
