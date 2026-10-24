// Generate display geometry from this worktree's kernel source, never from another lane's dist.
// node apps/library-docs/scripts/boolean-scenes.mjs [--check]
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = resolve(import.meta.dirname, '../../..');
const { build } = createRequire(join(repo, 'package.json'))('esbuild');
const temp = mkdtempSync(join(tmpdir(), 'boolean-scenes-'));
try {
  const file = join(temp, 'source.mjs');
  await build({ entryPoints: [join(import.meta.dirname, 'boolean-scenes-source.mjs')], outfile: file, bundle: true, platform: 'node', format: 'esm', target: 'node22', alias: { '@barocss/cad': join(repo, 'packages/barocss-cad/src') }, logLevel: 'warning' });
  const { buildScenes } = await import(pathToFileURL(file).href);
  const text = JSON.stringify(buildScenes()) + '\n';
  const target = join(repo, 'apps/library-docs/docs/.vitepress/components/boolean-scenes.json');
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== text) throw new Error('boolean-scenes.json differs from kernel source; regenerate it');
  } else writeFileSync(target, text);
  console.log(`Boolean teaching scenes: ${text.length} bytes`);
} finally { rmSync(temp, { recursive: true, force: true }); }
