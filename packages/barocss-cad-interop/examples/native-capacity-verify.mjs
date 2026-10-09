import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateLinearGeometryPattern, validateCircularGeometryPattern } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { options, nativePreview } from './native-capacity-common.mjs';
assert.equal(process.argv.length, 4, 'Usage: node native-capacity-verify.mjs <CAD964-demo-output> <CAD967-demo-output>');
const manifest = JSON.parse(readFileSync(new URL('./native-capacity-data/manifest.json', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const cases = [];
for (const item of manifest.cases) {
  const directory = resolve(process.argv[item.producerIssue === 964 ? 2 : 3]);
  const full = readFileSync(new URL(`./native-capacity-data/${item.file}`, import.meta.url));
  assert.equal(sha(full), item.sourceSha256);
  assert.deepEqual(full, readFileSync(resolve(directory, `${item.producerStem}.source0.css`)));
  const bytes = readFileSync(resolve(directory, `${item.producerStem}.owned-${item.operation}-pattern.json`));
  assert.equal(sha(bytes), item.ownedSha256);
  if (item.ownedFile) {
    const copiedOwned = readFileSync(new URL(`./native-capacity-data/${item.ownedFile}`, import.meta.url));
    assert.equal(sha(copiedOwned), item.ownedSha256);
    assert.deepEqual(copiedOwned, bytes);
  }
  const owned = JSON.parse(bytes);
  const validator = item.operation === 'linear' ? validateLinearGeometryPattern : validateCircularGeometryPattern;
  assert.deepEqual(validator(owned), owned.report);
  assert.equal(owned.source, full.toString('utf8'));
  assert.deepEqual(owned.instances.map(member => member.geometryId), item.ids);
  const neutral = nativePreview(owned.source, item);
  assert.deepEqual(neutral.model, owned.model);
  assert.deepEqual(neutral.model.objects, owned.instances.map(member => member.geometry));
  assert.equal(neutral.curves.length + neutral.surfaces.length, 5);
  const defaults = { ...options }; delete defaults.nativeCapacity;
  assert.throws(() => parseBaroCadSource(owned.source, defaults), /1\.\.4/);
  for (const capacity of [null, { version: 1, maximumObjects: 5 }, { version: 2, maximumObjects: 16 }])
    assert.throws(() => parseBaroCadSource(owned.source, { ...options, nativeCapacity: capacity }));
  const forged = structuredClone(owned); forged.instances[1].geometryId = 'forged';
  assert.throws(() => validator(forged));
  assert.equal(neutral.source, owned.source);
  cases.push({ key: item.key, nativeIds: item.ids, sourceBytes: full.length,
    curvePoints: neutral.curves.map(x => x.sample.pointsMM.length),
    surfaces: neutral.surfaces.map(x => ({ vertices: x.report.vertexCount, triangles: x.report.triangleCount })) });
}
console.log(JSON.stringify({ cases, fullSources: 4, nativeMembers: 20, ownedPublicValidators: 4,
  defaultFullSourceRefusals: 4, invalidProfileRefusals: 12, forgedOwnedRefusals: 4, options }, null, 2));
