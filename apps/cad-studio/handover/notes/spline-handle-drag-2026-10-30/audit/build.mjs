import { createRequire } from 'node:module';
const req = createRequire('/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/package.json');
const { build } = req('esbuild');
const [entry, out] = process.argv.slice(2);
await build({ entryPoints: [entry], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning', nodePaths: ['/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/node_modules', '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules'] });
