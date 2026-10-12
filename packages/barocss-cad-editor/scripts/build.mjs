import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const declarations = mkdtempSync(join(tmpdir(), 'barocss-cad-editor-declarations-'));
// Node can derive a heap larger than the available build budget. Preserve explicit
// caller limits; otherwise bound each heavy phase without retaining the other.
const hasHeapLimit = process.execArgv.some(arg => /^--max[-_]old[-_]space[-_]size(?:=|$)/.test(arg))
  || /(?:^|[\s"'])--max[-_]old[-_]space[-_]size(?:=|\s)/.test(process.env.NODE_OPTIONS ?? '');
const nodeArgs = hasHeapLimit ? process.execArgv : ['--max-old-space-size=1536', ...process.execArgv];
function run(script, args = []) {
  const result = spawnSync(process.execPath, [...nodeArgs, resolve(import.meta.dirname, script), ...args], {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS ?? '1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed (${result.signal ?? result.status})`);
}
try {
  rmSync(dist, { recursive: true, force: true });
  // Keep the checked TypeScript graph and Vite's parallel native worker graphs
  // in separate process lifetimes. Both phases are required for a complete build.
  run('build-declarations.mjs', [declarations]);
  run('build-bundle.mjs');
  cpSync(declarations, dist, { recursive: true });
  copyFileSync(resolve(root, 'src/styles.css'), resolve(root, 'dist/cad-editor.css'));
  process.stdout.write('Owned editor ESM, declarations and scoped CSS emitted. Main native dependencies remain external; worker dependencies are bundled.\n');
} catch (error) {
  rmSync(dist, { recursive: true, force: true });
  throw error;
} finally {
  rmSync(declarations, { recursive: true, force: true });
}
