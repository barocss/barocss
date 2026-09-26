import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const packageNames = ['@barocss/kit', '@barocss/browser', '@barocss/server'];

export function classifyPublication(states) {
  const count = states.filter(Boolean).length;
  if (count === 0) return 'unpublished';
  if (count === states.length) return 'published';
  throw new Error('Partial npm publication: stop and reconcile manually');
}

async function request(url, token) {
  const headers = { accept: 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
    headers['x-github-api-version'] = '2022-11-28';
  }
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function tagCommit(tag, token) {
  const root = 'https://api.github.com/repos/barocss/barocss';
  const reference = await request(`${root}/git/ref/tags/${encodeURIComponent(tag)}`, token);
  if (!reference) return null;
  if (reference.object.type === 'commit') return reference.object.sha;
  if (reference.object.type !== 'tag') throw new Error(`${tag}: unexpected tag object`);
  const annotated = await request(`${root}/git/tags/${reference.object.sha}`, token);
  assert.equal(annotated?.object?.type, 'commit', `${tag}: tag does not target a commit`);
  return annotated.object.sha;
}

export async function checkPublication(version, mode, expectedSha, token, allowExistingTagSha = false) {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.ok(['pre', 'post'].includes(mode));
  assert.match(expectedSha, /^[0-9a-f]{40}$/);
  assert.ok(token, 'GITHUB_TOKEN is required to check tags and Releases');

  const published = await Promise.all(packageNames.map(async (name) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
    const result = await request(url);
    if (result) {
      assert.equal(result.name, name);
      assert.equal(result.version, version);
    }
    return Boolean(result);
  }));
  const state = classifyPublication(published);
  if (mode === 'post' && state !== 'published') {
    throw new Error(`${version}: package versions are not visible in the npm registry yet`);
  }

  for (const name of packageNames) {
    const tag = `${name}@${version}`;
    const commit = await tagCommit(tag, token);
    const release = await request(
      `https://api.github.com/repos/barocss/barocss/releases/tags/${encodeURIComponent(tag)}`,
      token,
    );
    if (state === 'unpublished') {
      assert.equal(commit, null, `${tag}: tag exists before npm publication`);
      assert.equal(release, null, `${tag}: Release exists before npm publication`);
    } else {
      if (mode === 'post' || !allowExistingTagSha) {
        assert.equal(commit, expectedSha, `${tag}: tag does not target the promoted main commit`);
      } else {
        assert.match(commit || '', /^[0-9a-f]{40}$/, `${tag}: tag is missing`);
      }
      assert.equal(release?.tag_name, tag, `${tag}: GitHub Release is missing`);
      assert.equal(release?.draft, false, `${tag}: GitHub Release is still draft`);
    }
  }

  return state;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const version = process.env.EXPECTED_VERSION;
  const mode = process.env.PUBLICATION_MODE;
  const sha = process.env.EXPECTED_SHA;
  const token = process.env.GITHUB_TOKEN;
  const state = await checkPublication(
    version, mode, sha, token, process.env.ALLOW_EXISTING_TAG_SHA === 'true',
  );
  if (process.env.REQUIRE_UNPUBLISHED === 'true') {
    assert.equal(state, 'unpublished', 'Version became published before this step');
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `publication_state=${state}\n`);
  }
  console.log(`${version}: ${state} on npm; tag and Release state is consistent.`);
}
