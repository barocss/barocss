import { createRequire } from 'node:module';
import { join } from 'node:path';
const WT = '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a0b2e6fdc0164af01';
const require = createRequire(join(WT, 'packages/barocss-cad-model/package.json'));
const { build } = require('esbuild');
const here = import.meta.dirname, [entry, src, out] = process.argv.slice(2);
await build({ entryPoints: [join(here, entry)], outfile: join(here, 'out', out), bundle: true, platform: 'node', format: 'esm', target: 'node22', alias: { cadsrc: join(here, src) }, nodePaths: [join(WT, 'packages/barocss-cad-model/node_modules'), join(WT, 'node_modules')], logLevel: 'warning' });
