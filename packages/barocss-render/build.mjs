import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const require = createRequire(path.join(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const { build } = require('esbuild');

// React remains the consumer's peer. No research host or model transport enters the bundle.
await build({
  entryPoints: [path.join(here, 'src/index.jsx')],
  outfile: path.join(here, 'dist/index.js'),
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
  jsx: 'automatic', external: ['react', 'react/*'],
});
await fs.copyFile(path.join(here, 'src/index.d.ts'), path.join(here, 'dist/index.d.ts'));
