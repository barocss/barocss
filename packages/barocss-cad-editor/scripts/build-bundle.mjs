import { build } from 'vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
await build({ configFile: resolve(root, 'vite.config.ts') });
