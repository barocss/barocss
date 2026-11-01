// Finite local runner. No install, network, source mutation, or numerical tuning.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync, symlinkSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url)), root = resolve(here, '../..');
const mode = process.argv[2], runId = process.argv[3], emittedRun = process.argv[4] ?? 'dynamics-compiled-01';
if (!['baseline', 'inputs', 'units', 'kinematics', 'tests', 'compiled', 'contact', 'contact-compiled', 'compatibility', 'compatibility-rest', 'robot-compatibility', 'types', 'example-types', 'lint', 'public-package'].includes(mode)
  || !/^[a-z0-9-]+$/.test(runId ?? '') || !/^[a-z0-9-]+$/.test(emittedRun)) {
  throw Error('usage: node run.mjs <mode> <unique-run-id>; see README.md');
}
if (Number(process.versions.node.split('.')[0]) < 22) throw Error('Node >=22 required; use an installed runtime');
const out = join(here, 'evidence', runId);
if (existsSync(out)) throw Error(`preserve prior attempt: ${out}`);
mkdirSync(out, { recursive: true });
const records = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = () => writeFileSync(join(out, 'commands.json'), JSON.stringify({
  node: process.version, executable: process.execPath, mode, platform: process.platform, arch: process.arch,
  base: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(), records,
}, null, 2) + '\n');
function command(name, args, cwd = root) {
  const started = new Date().toISOString();
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(out, `${name}.stdout`), r.stdout ?? '');
  writeFileSync(join(out, `${name}.stderr`), r.stderr ?? '');
  records.push({ name, command: [process.execPath, ...args], cwd, started, finished: new Date().toISOString(),
    exit: r.status, signal: r.signal, error: r.error?.message ?? null,
    stdoutSha256: sha(r.stdout ?? ''), stderrSha256: sha(r.stderr ?? '') });
  save();
  console.log(`${name}: exit ${r.status}`);
  if (r.status !== 0) throw Error(`${name} failed; raw streams preserved in ${out}`);
}
async function bundle(name, entry, compiled = false) {
  const outfile = join(out, `${name}.mjs`);
  const result = await build({ entryPoints: [resolve(root, entry)], outfile, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent', metafile: true,
    ...(compiled ? { alias: { '@barocss/physics': join(here, 'evidence', mode === 'contact-compiled' ? emittedRun : runId, 'physics', 'index.js') } } : {}) });
  const inputs = Object.keys(result.metafile.inputs).map(p => {
    const path = realpathSync(resolve(root, p));
    if (!path.startsWith(root + '/')) throw Error(`cross-worktree runtime input: ${path}`);
    return { path: relative(root, path), sha256: sha(readFileSync(path)) };
  });
  if (compiled && inputs.some(i => i.path.startsWith('packages/barocss-physics/src/'))) throw Error('compiled graph contains Physics source');
  writeFileSync(join(out, `${name}.graph.json`), JSON.stringify({ compiled, bundleSha256: sha(readFileSync(outfile)), inputs }, null, 2) + '\n');
  return outfile;
}
try {
  if (mode === 'baseline') {
    for (const [name, entry, isTest] of [
      ['admission', 'examples/physics-motion-foundations-2276/baseline.test.ts', true],
      ['contact-impulse', 'examples/physics-contact-impulse-audit-1572/entry.ts'],
      ['friction-release', 'examples/physics-contact-impulse-audit-1572/friction-release.ts'],
      ['gravity-velocity', 'examples/physics-contact-impulse-audit-1572/gravity-velocity.ts'],
      ['public-smoke', 'examples/physics-contact-impulse-audit-1572/public-world-smoke.ts'],
      ['original-mini-stacks', 'examples/physics-contact-impulse-audit-1572/original-mini-stacks.ts'],
    ]) {
      const file = await bundle(name, entry);
      command(name, [...(isTest ? ['--test'] : []), file]);
    }
  } else if (mode === 'inputs') {
    const file = await bundle('motion-input', 'examples/physics-motion-foundations-2276/motion-input.test.ts');
    command('motion-input', ['--test', file]);
  } else if (mode === 'units') {
    const file = await bundle('units', 'examples/physics-motion-foundations-2276/units.test.ts');
    command('units', ['--test', file]);
  } else if (mode === 'contact' || mode === 'contact-compiled') {
    const file = await bundle('contact', 'examples/physics-motion-foundations-2276/contact.test.ts', mode === 'contact-compiled');
    command('contact', ['--test', file]);
  } else if (mode === 'lint') {
    command('lint', [resolve(root, 'node_modules/eslint/bin/eslint.js'),
      'packages/barocss-physics/src/pendulum.ts', 'packages/barocss-physics/src/index.ts',
      'packages/barocss-cad-model/src/robot/motion.ts',
      ...['baseline', 'kinematics', 'motion-input', 'world', 'pendulum', 'contact', 'units'].map(n => `examples/physics-motion-foundations-2276/${n}.test.ts`),
      'examples/physics-motion-foundations-2276/public-consumer.ts', 'examples/physics-motion-foundations-2276/run.mjs',
      'examples/physics-motion-foundations-2276/summarize.mjs']);
  } else if (mode === 'types' || mode === 'example-types') {
    if (mode === 'types') command('model-types', [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', 'packages/barocss-cad-model', '--noEmit']);
    command('example-types', [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict',
      '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--skipLibCheck', '--types', 'node',
      ...['baseline', 'kinematics', 'motion-input', 'world', 'pendulum', 'contact', 'units'].map(n => `examples/physics-motion-foundations-2276/${n}.test.ts`)]);
  } else if (mode === 'public-package') {
    const pkg = join(out, 'node_modules', '@barocss', 'physics');
    mkdirSync(pkg, { recursive: true });
    const original = JSON.parse(readFileSync(join(root, 'packages/barocss-physics/package.json'), 'utf8'));
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: original.name, version: original.version,
      type: original.type, ...original.publishConfig }, null, 2) + '\n');
    symlinkSync(join(here, 'evidence', emittedRun, 'physics'), join(pkg, 'dist'), 'dir');
    writeFileSync(join(out, 'package.json'), '{"type":"module"}\n');
    const fixture = readFileSync(join(here, 'public-consumer.ts'), 'utf8');
    writeFileSync(join(out, 'consumer.ts'), fixture);
    command('public-consumer-types', [resolve(root, 'node_modules/typescript/bin/tsc'), join(out, 'consumer.ts'),
      '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--strict', '--skipLibCheck', '--types', 'node']);
    command('public-consumer-node', [join(out, 'consumer.js')]);
  } else if (mode === 'robot-compatibility') {
    command('robot-existing-tests', [resolve(root, 'packages/barocss-cad-model/scripts/test.mjs'), 'rs2-motion', 'api-robot-path-contract']);
  } else if (mode === 'compatibility' || mode === 'compatibility-rest') {
    // Existing consumers import dist. Emit the public main graph first. No CAD import is in that graph.
    command('emit-public-main', [resolve(root, 'node_modules/typescript/bin/tsc'),
      'packages/barocss-physics/src/index.ts', 'packages/barocss-physics/src/replay.ts', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
      '--strict', '--declaration', '--skipLibCheck', '--outDir', 'packages/barocss-physics/dist']);
    const consumers = mode === 'compatibility-rest' ? ['persistent-box-probe', 'friction-stack-probe']
      : ['probe', 'rotation-probe', 'joints-probe', 'dynamic-hinge-motor-probe', 'offset-hinge-probe', 'persistent-box-probe', 'friction-stack-probe'];
    for (const name of consumers) {
      command(name, [resolve(root, `examples/physics-scene/${name}.mjs`)]);
    }
  } else {
    const compiled = mode === 'compiled';
    if (compiled) {
      const dest = join(out, 'physics');
      command('emit-public-main', [resolve(root, 'node_modules/typescript/bin/tsc'),
        'packages/barocss-physics/src/index.ts', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
        '--strict', '--declaration', '--skipLibCheck', '--outDir', dest]);
      writeFileSync(join(out, 'package.json'), '{"type":"module"}\n');
    }
    const names = mode === 'kinematics' ? ['kinematics', 'motion-input']
      : compiled ? ['baseline', 'world', 'pendulum'] : ['world', 'pendulum'];
    for (const name of names) {
      const file = await bundle(name, `examples/physics-motion-foundations-2276/${name}.test.ts`, compiled);
      command(name, ['--test', file]);
    }
  }
} catch (error) {
  writeFileSync(join(out, 'runner-failure.txt'), String(error) + '\n');
  process.exitCode = 1;
} finally { save(); }
