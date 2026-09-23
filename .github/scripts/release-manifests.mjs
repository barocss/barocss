import assert from 'node:assert/strict';

export function verifyLinkedSourceVersions(manifests, version) {
  assert.equal(manifests.length, 3, 'Expected kit, browser, and server manifests');
  for (const manifest of manifests) {
    assert.equal(manifest.version, version, `${manifest.name}: version mismatch`);
  }
  for (const manifest of manifests.slice(1)) {
    assert.ok(
      ['workspace:*', version].includes(manifest.dependencies?.['@barocss/kit']),
      `${manifest.name}: unexpected kit dependency`,
    );
  }
}
