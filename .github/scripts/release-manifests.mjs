import assert from 'node:assert/strict';

// Tarballs, source manifests, npm state, and release evidence use the same package set.
export const releasePackages = [
  { directory: 'barocss', name: '@barocss/kit' },
  { directory: 'barocss-browser', name: '@barocss/browser' },
  { directory: 'barocss-server', name: '@barocss/server' },
  { directory: 'barocss-render', name: '@barocss/render' },
];
export const packageNames = releasePackages.map(({ name }) => name);

export function verifyLinkedSourceVersions(manifests, version) {
  assert.equal(manifests.length, packageNames.length, 'Expected all four release manifests');
  assert.deepEqual(manifests.map(({ name }) => name).sort(), [...packageNames].sort(), 'Incorrect release package set');
  for (const manifest of manifests) {
    assert.notEqual(manifest.private, true, `${manifest.name}: package is private`);
    assert.equal(manifest.version, version, `${manifest.name}: version mismatch`);
    if (['@barocss/browser', '@barocss/server'].includes(manifest.name)) {
      assert.ok(['workspace:*', version].includes(manifest.dependencies?.['@barocss/kit']),
        `${manifest.name}: unexpected kit dependency`);
    }
  }
}

export function verifyReadiness(body, candidateSha, version) {
  const lines = body?.split(/\r?\n/) ?? [];
  assert.ok(lines.includes(`BAROCSS_RELEASE_READY SHA=${candidateSha} VERSION=${version}`),
    'Release-ready record must match the merged develop SHA and version');
  assert.ok(lines.includes(`Packages: ${packageNames.join(' ')}`), 'Readiness must cover all four packages');
  // Retained wire aliases: Guard = Review; Ship = Execute pack/check evidence.
  for (const role of ['Guard', 'Ship', 'Render']) {
    assert.ok(lines.some((line) => new RegExp(`^${role}: https://github\\.com/barocss/barocss/(?:issues|pull)/[0-9]+#issuecomment-[0-9]+$`).test(line)),
      `${role} evidence comment is required`);
  }
}

export function verifyRenderEvidence(comment, url, candidateSha, version) {
  assert.equal(comment.user?.login, 'easylogic', 'Render evidence must be posted by the owner');
  assert.equal(comment.html_url, url, 'Render evidence URL mismatch');
  assert.ok(comment.body?.split(/\r?\n/).includes(
    `BAROCSS_RENDER_READY SHA=${candidateSha} VERSION=${version}`,
  ), 'Render packed consumer evidence must match the exact candidate SHA and version');
}
