// Bounded local proof runner. No installs, network, package-map edits, or production hooks.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '../..');
const mode = process.argv[2], runId = process.argv[3];
const modes = ['baseline', 'source', 'emitted', 'ordinary-source', 'ordinary-emitted'];
if (!modes.includes(mode) || !/^[a-z0-9-]+$/.test(runId ?? '')) {
  throw new Error(`usage: node run.mjs <${modes.join('|')}> <fresh-run-id>`);
}
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node >=22 required');
const out = join(here, 'evidence', runId);
if (existsSync(out)) throw new Error(`preserve prior attempt: ${out}`);
mkdirSync(out, { recursive: true });
const baselineSha = '66df02f8e7d5a3a7ab7b8ff7a0184bf34d978713';
const emitted = mode === 'emitted' || mode === 'ordinary-emitted';
const injected = !mode.startsWith('ordinary-');
const physicsRoot = join(root, 'packages/barocss-physics');
const providerDir = emitted ? join(out, 'physics') : join(physicsRoot, 'src');
const records = [], transformations = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (head.status !== 0) throw new Error('cannot identify HEAD');
const save = () => writeFileSync(join(out, 'commands.json'), JSON.stringify({
  workId: 'physics-world-p1a-2276', mode, runId, node: process.version, executable: process.execPath,
  platform: process.platform, arch: process.arch, head: head.stdout.trim(), baselineSha,
  proofBoundary: injected ? 'instrumented transaction proof; not an ordinary package proof'
    : 'ordinary uninstrumented root and replay consumer', records, transformations,
}, null, 2) + '\n');
function command(name, executable, args, env = process.env) {
  const started = new Date().toISOString();
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', env,
    timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(out, `${name}.stdout`), result.stdout ?? '');
  writeFileSync(join(out, `${name}.stderr`), result.stderr ?? '');
  records.push({ name, command: [executable, ...args], cwd: root, started,
    finished: new Date().toISOString(), exit: result.status, signal: result.signal,
    error: result.error?.message ?? null, stdoutSha256: sha(result.stdout ?? ''),
    stderrSha256: sha(result.stderr ?? '') });
  save();
  console.log(`${name}: exit ${result.status}`);
  if (result.status !== 0) throw new Error(`${name} failed; raw streams preserved in ${out}`);
  return result.stdout;
}
function unique(text, anchor, label) {
  const offset = text.indexOf(anchor);
  if (offset < 0 || text.indexOf(anchor, offset + anchor.length) !== -1) {
    throw new Error(`expected exactly one ${label} anchor`);
  }
  return offset;
}
function inject(text, filename) {
  let offset, phase, cursor;
  if (filename === 'world') {
    const start = unique(text, 'function publicState(', 'publicState function');
    offset = text.indexOf('return {', start);
    if (offset < 0) throw new Error('publicState return anchor missing');
    // The next function marks the end of publicState. Do not match a later return.
    const end = text.indexOf('export function createPhysicsWorld', start);
    if (end < 0 || offset > end) throw new Error('publicState return escaped its function');
    phase = 'world-output'; cursor = 'stepIndex';
  } else {
    const anchor = mode === 'baseline' ? 'this.frames.push({ commands: admitted });'
      : 'const nextFrames = [...this.frames, { commands: admitted }];';
    offset = unique(text, anchor, 'replay log preparation');
    phase = 'replay-log'; cursor = 'this.frames.length + 1';
  }
  const hook = `globalThis[Symbol.for('barocss.physics.p1a.output-log-fault')]?.('${phase}', ${cursor});\n`;
  return text.slice(0, offset) + hook + text.slice(offset);
}

try {
  if (emitted) {
    command('emit-root-replay', process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
      'packages/barocss-physics/src/index.ts', 'packages/barocss-physics/src/replay.ts',
      '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
      '--strict', '--declaration', '--skipLibCheck', '--rootDir', join(physicsRoot, 'src'), '--outDir', providerDir]);
    writeFileSync(join(out, 'package.json'), '{"type":"module"}\n');
  }
  const targets = new Map(['world', 'replay-session'].map(name => [
    realpathSync(join(providerDir, `${name}.${emitted ? 'js' : 'ts'}`)), name,
  ]));
  const plugin = {
    name: 'p1a-exact-provider-proof',
    setup(builder) {
      // Source modes retain normal workspace package export resolution.
      if (emitted) builder.onResolve({ filter: /^@barocss\/physics(?:\/replay)?$/ }, args => ({
        path: join(providerDir, args.path.endsWith('/replay') ? 'replay.js' : 'index.js'),
      }));
      if (injected) builder.onLoad({ filter: /(?:world|replay-session)\.(?:ts|js)$/ }, args => {
        const path = realpathSync(args.path), name = targets.get(path);
        if (!name) return undefined;
        let original;
        if (mode === 'baseline') {
          const repoPath = relative(root, path);
          original = command(`baseline-${name}`, 'git', ['show', `${baselineSha}:${repoPath}`]);
        } else original = readFileSync(path, 'utf8');
        const contents = inject(original, name);
        const frozen = join(out, 'instrumented', `${name}.${emitted ? 'js' : 'ts'}`);
        mkdirSync(dirname(frozen), { recursive: true });
        writeFileSync(frozen, contents);
        transformations.push({ path: relative(root, path), source: mode === 'baseline' ? baselineSha : 'working-tree',
          originalSha256: sha(original), transformedSha256: sha(contents), frozen: relative(root, frozen),
          injection: name === 'world' ? 'before-publicState-return' : 'before-replay-log-preparation' });
        save();
        return { contents, loader: emitted ? 'js' : 'ts', resolveDir: dirname(path) };
      });
    },
  };
  const outfile = join(out, 'transaction.test.mjs');
  const result = await build({ entryPoints: [join(here, 'transaction.test.mjs')], outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent',
    metafile: true, plugins: [plugin] });
  if (injected && (transformations.length !== 2 || new Set(transformations.map(item => item.path)).size !== 2)) {
    throw new Error('both exact runtime modules must be instrumented once');
  }
  const inputs = Object.keys(result.metafile.inputs).map(input => {
    const absolute = realpathSync(resolve(root, input));
    if (!absolute.startsWith(root + '/')) throw new Error(`cross-worktree runtime input: ${absolute}`);
    const transformed = transformations.find(item => item.path === relative(root, absolute));
    return { path: relative(root, absolute), sha256: sha(readFileSync(absolute)),
      ...(transformed ? { effectiveSha256: transformed.transformedSha256,
        originalSha256: transformed.originalSha256, source: transformed.source } : {}) };
  });
  if (emitted && inputs.some(input => input.path.startsWith('packages/barocss-physics/src/'))) {
    throw new Error('emitted graph contains Physics TypeScript source');
  }
  if (!emitted && !inputs.some(input => input.path === 'packages/barocss-physics/src/replay-session.ts')) {
    throw new Error('source graph does not contain the actual replay implementation');
  }
  if (mode === 'baseline') {
    // Baseline overrides only the two transaction providers. Every other Physics
    // provider must still match the frozen base; refuse a mixed numerical graph.
    for (const input of inputs.filter(item => item.path.startsWith('packages/barocss-physics/src/')
      && !transformations.some(transformed => transformed.path === item.path))) {
      const frozen = spawnSync('git', ['show', `${baselineSha}:${input.path}`], { cwd: root });
      if (frozen.status !== 0 || sha(frozen.stdout) !== input.sha256) {
        throw new Error(`baseline dependency drift: ${input.path}`);
      }
    }
  }
  writeFileSync(join(out, 'graph.json'), JSON.stringify({ mode, injected, emitted,
    bundleSha256: sha(readFileSync(outfile)), inputs, transformations }, null, 2) + '\n');
  writeFileSync(join(out, 'metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n');
  command('transaction-tests', process.execPath, ['--test', outfile], { ...process.env, P1A_PROOF_KIND: mode });
} catch (error) {
  writeFileSync(join(out, 'runner-failure.txt'), `${error.stack ?? error}\n`);
  process.exitCode = 1;
} finally { save(); }
