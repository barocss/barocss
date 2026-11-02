import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
export function ownedPackages(root) {
  const manifests = new Map();
  return { name: 'physics-lab-owned-public-packages', setup(build) {
    build.onResolve({ filter: /^@barocss\// }, async args => {
      const [, name, ...parts] = args.path.split('/');
      const directory = resolve(root, `packages/barocss-${name}`);
      if (!manifests.has(name)) manifests.set(name, JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8')));
      const manifest = manifests.get(name), selection = manifest.exports[parts.length ? './' + parts.join('/') : '.'];
      assert(selection, `Unknown public workspace entry ${args.path}`);
      const entry = typeof selection === 'string' ? selection : selection['barocss-source'] ?? selection.import;
      assert(typeof entry === 'string' && entry.startsWith('./src/'), `Expected owned source entry ${args.path}`);
      const path = await realpath(resolve(directory, entry));
      assert(path.startsWith(root + '/packages/'), `Workspace import escaped the owned checkout: ${path}`);
      return { path };
    });
  } };
}
