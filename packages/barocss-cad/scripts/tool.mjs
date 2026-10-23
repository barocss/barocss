import { readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const mode = process.argv[2];
if (mode === 'build:fast') {
  // (For tests: each source transpiled alone by esbuild into dist — no type check, dist not cleared, so the last full
  // build's declarations stay. A full `build` and `type-check` remain the release and type gates.)
  const { buildSync } = require('esbuild'), src = resolve(import.meta.dirname, '../src');
  const files = readdirSync(src, { recursive: true }).filter(f => String(f).endsWith('.ts') && !String(f).endsWith('.d.ts')).map(f => resolve(src, String(f)));
  buildSync({ entryPoints: files, outdir: resolve(import.meta.dirname, '../dist'), outbase: src, format: 'esm', platform: 'node', target: 'es2022', bundle: false, logLevel: 'warning' });
} else if (mode === 'lint') {
  execFileSync(process.execPath, [resolve(dirname(require.resolve('eslint/package.json')), 'bin/eslint.js'), 'src'], { stdio: 'inherit' });
} else {
  if (mode === 'build') rmSync(resolve(import.meta.dirname, '../dist'), {recursive:true,force:true});
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json', ...(mode === 'type-check' ? ['--noEmit'] : [])], { stdio: 'inherit' });
}
