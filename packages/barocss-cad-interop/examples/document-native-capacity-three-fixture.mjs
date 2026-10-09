import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCadDocument, serializeCadDocument, parseCadDocument, validateCadDocumentResult } from '@barocss/cad';

export const dataDirectory = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/document-native-capacity-three-data');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function negativeZeroCount(value) {
  if (typeof value === 'number') return Object.is(value, -0) ? 1 : 0;
  if (value === null || typeof value !== 'object') return 0;
  return Object.values(value).reduce((count, child) => count + negativeZeroCount(child), 0);
}
export function reproduceDocumentFixture() {
  const manifest = JSON.parse(readFileSync(resolve(dataDirectory, 'manifest.json'), 'utf8'));
  const readPinned = artifact => {
    const bytes = readFileSync(resolve(dataDirectory, artifact.file));
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(sha256(bytes), artifact.sha256);
    return bytes.toString('utf8');
  };
  const source = readPinned(manifest.source);
  const documentText = readPinned(manifest.document);
  const ownedText = readPinned(manifest.owned);
  const input = {
    schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
    documentId: manifest.documentId, revision: manifest.revision,
    units: { length: 'mm', angle: 'rad' }, nativeFrame: 'authored-xyz-no-axis-conversion',
    assets: [{ id: manifest.assetId, revision: manifest.assetRevision, role: 'authored-native-source',
      sourceVersion: 0, sourceFrame: 'authored-xyz-no-axis-conversion', source }],
    bodies: manifest.bodyIds.map((id, index) => ({ id, name: index === 0 ? 'Pattern seed' : `Pattern copy ${index}`,
      kind: 'direct-geometry-object', assetId: manifest.assetId, geometryId: manifest.geometryIds[index] })),
    features: [], parameters: [], constraints: [], placements: [], derivedCaches: [],
  };
  const created = createCadDocument(input);
  const wire = serializeCadDocument(created.document);
  assert.equal(wire, documentText);
  const parsed = parseCadDocument(wire);
  assert.deepEqual(parsed, created);
  assert.deepEqual(validateCadDocumentResult(created), created.report);
  assert.deepEqual(validateCadDocumentResult(parsed), parsed.report);
  assert.equal(typeof JSON.rawJSON, 'function', 'Run this fixture with Node22 JSON.rawJSON support');
  const preserved = JSON.stringify(created, (_key, value) =>
    typeof value === 'number' && Object.is(value, -0) ? JSON.rawJSON('-0') : value, 2) + '\n';
  assert.equal(preserved, ownedText);
  const owned = JSON.parse(ownedText);
  assert.deepEqual(validateCadDocumentResult(owned), owned.report);
  assert.deepEqual(owned, created);
  assert.equal(negativeZeroCount(owned), manifest.owned.negativeZeroCount);
  assert.equal(created.compiledAssets[0].source, source);
  assert.equal(created.compiledAssets[0].model.name, manifest.modelName);
  assert.deepEqual(created.compiledAssets[0].model.objects.map(object => object.id), manifest.geometryIds);
  assert.deepEqual(created.bodyBindings.map(binding => binding.bodyId), manifest.bodyIds);
  assert.equal(created.report.assetCount, 1);
  assert.equal(created.report.bodyCount, 5);
  assert.equal(created.report.nativeObjectCount, 5);
  assert.equal(created.report.aggregateSourceBytes, manifest.source.bytes);
  return { manifest, source, documentText, ownedText, created, parsed, owned, publicValidatorCalls: 3 };
}
