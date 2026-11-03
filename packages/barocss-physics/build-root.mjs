/** Bundle the root while sharing only the three canonical package siblings. */
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const sharedNames = ['types', 'recording-owner', 'provider-manifest.generated'];
const sharedSources = new Map(await Promise.all(sharedNames.map(async name => [
  await realpath(resolve(packageDirectory, 'src', `${name}.ts`)), `./${name}.js`,
])));

await build({
  absWorkingDir: packageDirectory,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  plugins: [{
    name: 'canonical-root-siblings',
    setup(api) {
      api.onResolve({ filter: /^\.\.?\//, namespace: 'file' }, async args => {
        const requested = resolve(args.resolveDir, args.path);
        // NodeNext source imports spell .js while the source file is .ts.
        // Prefer a real .js file when present, as the normal resolver does.
        const candidates = requested.endsWith('.js')
          ? [requested, `${requested.slice(0, -3)}.ts`] : [requested];
        for (const candidate of candidates) {
          let canonical;
          try { canonical = await realpath(candidate); }
          catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
            throw error;
          }
          const sibling = sharedSources.get(canonical);
          if (sibling) return { path: sibling, external: true };
          // An existing domain/types.ts is not the canonical root types.ts.
          return undefined;
        }
        return undefined;
      });
    },
  }],
});

// The bounded stack position kernel is JavaScript source with an explicit
// NodeNext declaration boundary. tsc emits its TypeScript callers; preserve
// these local runtime modules for direct emitted-module consumers as well.
const stackFiles = [
  'full-pair-input.mjs', 'full-pair-linear.mjs', 'full-pair-exact.mjs',
  'full-pair-core.mjs', 'full-pair-solver.mjs', 'full-pair-solver.d.mts',
];
await mkdir(resolve(packageDirectory, 'dist/stack'), { recursive: true });
for (const name of stackFiles) {
  const source = resolve(packageDirectory, 'src/stack', name);
  const target = resolve(packageDirectory, 'dist/stack', name);
  await copyFile(source, target);
  if (!(await readFile(source)).equals(await readFile(target))) {
    throw new Error(`stack build copy differs: ${name}`);
  }
}
