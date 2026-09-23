import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPublication, classifyPublication } from './check-publication-state.mjs';

const sha = 'a'.repeat(40);
const oldSha = 'b'.repeat(40);
const version = '0.0.4';

async function withRegistryState(publishedNames, options, check) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (url.startsWith('https://registry.npmjs.org/')) {
      const [, encodedName, requestedVersion] = path.split('/');
      const name = decodeURIComponent(encodedName);
      return publishedNames.includes(name)
        ? new Response(JSON.stringify({ name, version: requestedVersion }), { status: 200 })
        : new Response('', { status: 404 });
    }
    if (path.includes('/git/ref/tags/')) {
      options.onTagRequest?.();
      return options.tags
        ? new Response(JSON.stringify({ object: { type: 'commit', sha: options.tagSha || sha } }))
        : new Response('', { status: 404 });
    }
    if (path.includes('/releases/tags/')) {
      const tag = decodeURIComponent(path.split('/releases/tags/')[1]);
      return options.releases
        ? new Response(JSON.stringify({ tag_name: tag, draft: false }))
        : new Response('', { status: 404 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    await check();
  } finally {
    globalThis.fetch = original;
  }
}

test('all missing versions may enter the release preflight', () => {
  assert.equal(classifyPublication([false, false, false]), 'unpublished');
});

test('all existing versions are idempotent', () => {
  assert.equal(classifyPublication([true, true, true]), 'published');
});

test('any partial package publication stops automatic retry', () => {
  assert.throws(() => classifyPublication([true, false, false]), /Partial npm publication/);
  assert.throws(() => classifyPublication([true, true, false]), /Partial npm publication/);
});

test('preflight accepts only three absent versions with no tags or Releases', async () => {
  await withRegistryState([], { tags: false, releases: false }, async () => {
    assert.equal(await checkPublication(version, 'pre', sha, 'token'), 'unpublished');
  });
});

test('a pre-existing tag blocks an unpublished version', async () => {
  await withRegistryState([], { tags: true, releases: false }, async () => {
    await assert.rejects(checkPublication(version, 'pre', sha, 'token'), /tag exists/);
  });
});

test('a partial npm publication stops before any tag checks', async () => {
  await withRegistryState(['@barocss/kit'], { tags: false, releases: false }, async () => {
    await assert.rejects(checkPublication(version, 'pre', sha, 'token'), /Partial npm publication/);
  });
});

test('postflight waits for all exact npm records before checking tags', async () => {
  let tagRequests = 0;
  const options = { tags: true, releases: true, onTagRequest: () => { tagRequests += 1; } };

  await withRegistryState([], options, async () => {
    await assert.rejects(checkPublication(version, 'post', sha, 'token'), /not visible in the npm registry/);
  });
  await withRegistryState(['@barocss/kit'], options, async () => {
    await assert.rejects(checkPublication(version, 'post', sha, 'token'), /Partial npm publication/);
  });
  assert.equal(tagRequests, 0);
});

test('postflight accepts complete npm records with exact tags and Releases', async () => {
  await withRegistryState(
    ['@barocss/kit', '@barocss/browser', '@barocss/server'],
    { tags: true, releases: true },
    async () => {
      assert.equal(await checkPublication(version, 'post', sha, 'token'), 'published');
    },
  );
});

test('a later main commit skips a complete earlier release', async () => {
  await withRegistryState(
    ['@barocss/kit', '@barocss/browser', '@barocss/server'],
    { tags: true, releases: true, tagSha: oldSha },
    async () => {
      assert.equal(await checkPublication(version, 'pre', sha, 'token', true), 'published');
      await assert.rejects(checkPublication(version, 'post', sha, 'token', true), /tag does not target/);
    },
  );
});
