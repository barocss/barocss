import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
await fs.mkdir(path.join(here, 'dist'), { recursive: true });
await build({
  entryPoints: [path.join(here, 'src/index.js')],
  outfile: path.join(here, 'dist/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  packages: 'external',
  logLevel: 'silent',
});
await Promise.all([
  fs.copyFile(path.join(here, 'src/index.d.ts'), path.join(here, 'dist/index.d.ts')),
  fs.copyFile(path.join(here, 'src/frame.jsx'), path.join(here, 'dist/frame.jsx')),
  fs.copyFile(path.join(here, 'src/library.jsx'), path.join(here, 'dist/library.jsx')),
]);
