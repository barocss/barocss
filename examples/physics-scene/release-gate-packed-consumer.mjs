import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function runPackedConsumer(command, root, example) {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'barocss-physics-release-'));
  const tarballs = ['barocss-cad-0.0.0-experimental.tgz',
    'barocss-physics-0.0.0-experimental.tgz'];
  try {
    command('pnpm', ['pack', '--pack-destination', tempDirectory], join(root, 'packages/barocss-cad'));
    command('pnpm', ['pack', '--pack-destination', tempDirectory], join(root, 'packages/barocss-physics'));
    writeFileSync(join(tempDirectory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    cpSync(join(example, 'release-consumer.mjs'), join(tempDirectory, 'release-consumer.mjs'));
    cpSync(join(root, 'examples/physics-cad-scene/two-surfaces.barocad'), join(tempDirectory, 'two-surfaces.barocad'));
    command('npm', ['install', '--offline', '--no-audit', '--no-fund', '--ignore-scripts',
      ...tarballs.map((name) => join(tempDirectory, name))], tempDirectory,
    { ...process.env, npm_config_cache: join(tempDirectory, '.npm-cache') });
    const output = JSON.parse(command('node', [join(tempDirectory, 'release-consumer.mjs')],
      tempDirectory).split('\n').at(-1));
    assert.equal(output.result, 'ok');
    return { status: 'pass', tarballs, output };
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}
