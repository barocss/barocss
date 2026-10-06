import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const mode = process.argv[2];
if (mode === 'lint') {
  execFileSync(process.execPath, [resolve(dirname(require.resolve('eslint/package.json')), 'bin/eslint.js'), 'src'], { stdio: 'inherit' });
} else {
  if (mode === 'build') rmSync(resolve(import.meta.dirname, '../dist'), {recursive:true,force:true});
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json', ...(mode === 'type-check' ? ['--noEmit'] : [])], { stdio: 'inherit' });
}
