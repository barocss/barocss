// node build.mjs <entry.ts> -> out/<name>.new.mjs and out/<name>.base.mjs
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
const WT = '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a0b2e6fdc0164af01';
const require = createRequire(join(WT, 'packages/barocss-cad-model/package.json'));
const { build } = require('esbuild');
const here = import.meta.dirname, entry = process.argv[2], name = basename(entry).replace(/\.ts$/, '');
const srcs = { new: join(WT, 'packages/barocss-cad-model/src'), base: join(here, 'base/packages/barocss-cad-model/src') };
for (const [k, src] of Object.entries(srcs)) {
  await build({ entryPoints: [join(here, entry)], outfile: join(here, 'out', `${name}.${k}.mjs`), bundle: true, platform: 'node', format: 'esm', target: 'node22',
    alias: { cadsrc: src }, nodePaths: [join(WT, 'packages/barocss-cad-model/node_modules'), join(WT, 'node_modules')], logLevel: 'warning' });
}
console.log('built', name);
