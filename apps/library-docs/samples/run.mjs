// Runs the site's samples (pnpm test:samples): each samples/*.test.mjs bundled with esbuild, the packages it imports as a
// user would — `@barocss/cad`, `@barocss/cad-model/<module>`, `@barocss/gpu` — taken from their TypeScript sources,
// then node --test on the bundles. The pages include the samples' #region blocks, so what a page shows is code that ran.
//   node samples/run.mjs [name-filter]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const here = import.meta.dirname, repo = resolve(here, '../../..');
const { build } = createRequire(join(repo, 'apps/cad-studio/package.json'))('esbuild');
const filter = process.argv[2] ?? '';
const tests = readdirSync(here).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).sort();
const out = mkdtempSync(join(tmpdir(), 'library-docs-samples-'));
try {
  await build({
    entryPoints: tests.map(f => join(here, f)), outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22',
    // (The samples' own paths, import.meta.dirname among them, stay as written: the bundles are told where they came from.)
    define: { 'import.meta.dirname': JSON.stringify(here) },
    alias: { '@barocss/cad': join(repo, 'packages/barocss-cad/src'), '@barocss/cad-model': join(repo, 'packages/barocss-cad-model/src'), '@barocss/gpu': join(repo, 'packages/barocss-gpu/src') },
    outExtension: { '.js': '.mjs' }, logLevel: 'warning',
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  });
  const r = spawnSync(process.execPath, ['--test', ...tests.map(f => join(out, f))], { stdio: 'inherit' });
  process.exitCode = r.status ?? 1;
} finally { rmSync(out, { recursive: true, force: true }); }
