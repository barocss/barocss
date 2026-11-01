// node build.mjs <entry> <outfile> [mutations.json] [--shim]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const W = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20';
const req = createRequire(W + '/apps/cad-studio/package.json');
const { build } = req('esbuild');
const [entry, outfile, mutFile, shimFlag] = process.argv.slice(2);
const muts = mutFile && mutFile !== '-' ? JSON.parse(readFileSync(mutFile, 'utf8')) : [];
const plugin = { name: 'mut', setup(b) {
  b.onLoad({ filter: /(useCommandPreview|useCommandGizmos)\.ts$/ }, async args => {
    let src = process.env.ORIG ? (await import('node:child_process')).execSync('git show HEAD:' + args.path.slice(W.length + 1), { cwd: W }).toString() : readFileSync(args.path, 'utf8');
    for (const m of muts) if (args.path.endsWith(m.file)) {
      if (!src.includes(m.find)) throw new Error('mutation anchor not found: ' + m.find);
      src = src.split(m.find).join(m.replace);
    }
    return { contents: src, loader: 'ts', resolveDir: args.path.replace(/\/[^/]+$/, '') };
  });
} };
await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'error',
  plugins: [plugin], ...(shimFlag === '--shim' ? { alias: { react: '/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/audit20b/react-shim.mjs' } } : {}),
  absWorkingDir: W + '/apps/cad-studio' });
