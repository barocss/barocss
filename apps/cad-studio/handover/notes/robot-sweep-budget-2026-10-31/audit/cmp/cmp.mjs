// node cmp.mjs <head|fix> <outdir> <logdir> test1 test2 ... : bundles cad-model tests with the changed src files taken from HEAD or the
// working tree, sweepPath/sweepTimed instrumented to log every call (inputs hash + full result summary) per process.
import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20', P = T + '/packages/barocss-cad-model';
const [variant, out, logdir, ...tests] = process.argv.slice(2);
const CHANGED = ['src/robot/sweep.ts', 'src/robot/ccd.ts', 'src/robot/verbs.ts', 'src/robot/native/harness.ts', 'src/rb9/captive.ts', 'src/rb9/rungs-toy.ts', 'src/chat/robot.ts', 'src/chat/contract.ts'];
const MUT = process.env.MUT ? JSON.parse(readFileSync(process.env.MUT, 'utf8')) : {}; // {relpath: [[from,to],...]} applied to the fix variant
const content = new Map();
for (const rel of CHANGED) {
  let src = variant === 'head' ? execFileSync('git', ['-C', T, 'show', 'HEAD:packages/barocss-cad-model/' + rel], { encoding: 'utf8', maxBuffer: 1 << 26 }) : readFileSync(join(P, rel), 'utf8');
  for (const [a, b] of MUT[rel] ?? []) { if (!src.includes(a)) throw new Error('mutation anchor missing in ' + rel + ': ' + a.slice(0, 80)); src = src.replace(a, b); }
  if (rel === 'src/robot/sweep.ts') {
    src = src.replace('export function sweepPath(', 'function sweepPath__(') + `\nexport function sweepPath(tree: any, links: any, from: any, to: any, o: any = {}): any { const r = sweepPath__(tree, links, from, to, o); (globalThis as any).__swlog?.('P', [tree.joints.map((j: any) => j.key), links.map((l: any) => [l.link, l.positions.length, l.positions[0], l.positions[l.positions.length - 1]]), from, to, o.tolerance, o.maxSamples], r); return r; }\n`;
  }
  if (rel === 'src/robot/ccd.ts') {
    src = src.replace('export function sweepTimed(', 'function sweepTimed__(') + `\nexport function sweepTimed(tree: any, links: any, path: any, o: any = {}): any { const r = sweepTimed__(tree, links, path, o); (globalThis as any).__swlog?.('T', [tree.joints.map((j: any) => j.key), links.map((l: any) => [l.link, l.positions.length]), path, o.maxSamples], r); return r; }\n`;
  }
  content.set(join(P, rel), src);
}
const banner = `import { appendFileSync as __afs } from 'node:fs'; import { createHash as __ch } from 'node:crypto'; import { basename as __bn } from 'node:path';
globalThis.__swlog = (k, inp, r) => { const sum = { clear: r.clear, contact: r.contact ? { s: r.contact.s, links: r.contact.links, values: r.contact.values } : undefined, exhausted: r.exhausted, toi: r.toi, segment: r.segment, links: r.links, values: r.values, samples: r.samples, min: r.minClearance, nsk: r.skipped?.length, nde: r.designed?.length };
  __afs(${JSON.stringify(logdir)} + '/' + __bn(process.argv[1] ?? 'x') + '.' + process.pid + '.log', JSON.stringify({ k, h: __ch('sha1').update(JSON.stringify(inp)).digest('hex').slice(0, 12), r: sum }) + '\\n'); };`;
const plugin = { name: 'variant', setup(b) {
  b.onLoad({ filter: /\.ts$/ }, a => content.has(a.path) ? { contents: content.get(a.path), loader: 'ts', resolveDir: dirname(a.path) } : undefined);
} };
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true }); mkdirSync(logdir, { recursive: true });
await build({ entryPoints: tests.map(n => join(P, 'test', n)), outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning', define: { 'import.meta.dirname': JSON.stringify(P + '/test') }, banner: { js: banner }, plugins: [plugin] });
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...tests.map(n => join(out, n.replace(/\.ts$/, '.mjs')))], { stdio: 'inherit', cwd: P });
process.exit(r.status ?? 1);
