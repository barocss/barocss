import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const require = createRequire(path.join(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const { build } = require('esbuild');
const entries = ['index', 'protocol', 'server', 'fetch'];

await fs.mkdir(path.join(here, 'dist'), { recursive: true });
await Promise.all(entries.map(async (name) => {
  await build({
    entryPoints: [path.join(here, 'src', `${name}.mjs`)],
    outfile: path.join(here, 'dist', `${name}.js`),
    bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
    external: ['@barocss/render', '@barocss/server'],
  });
  await fs.copyFile(path.join(here, 'src', `${name}.d.ts`), path.join(here, 'dist', `${name}.d.ts`));
}));
