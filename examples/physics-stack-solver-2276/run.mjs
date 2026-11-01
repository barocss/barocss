import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url)), root = resolve(here, '../..');
const [mode, runId, canonicalWorldPath] = process.argv.slice(2);
if (!['fixture', 'source-tests', 'source-first', 'emitted', 'world-source', 'world-emitted', 'error-tests'].includes(mode) || !/^[a-z0-9-]+$/.test(runId ?? '')) throw Error('usage: run.mjs <stage> <fresh-run-id>');
const out = join(here, 'evidence', runId);
if (existsSync(out)) throw Error('preserve previous run: ' + out);
mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [];
const files = readdirSync(here).filter(n => /\.(ts|py|mjs|md)$/.test(n)).sort().map(n => ({
  path: relative(root, join(here, n)), sha256: sha(readFileSync(join(here, n))),
}));
writeFileSync(join(out, 'source.json'), JSON.stringify({ mode, base: '7105c4755fcbf4f0cbc764b864a55bf550f741b3', files }, null, 2) + '\n');
function command(name, executable, args, timeout = 180000) {
  const started = new Date().toISOString();
  const r = spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout,
    maxBuffer: 4 * 1024 * 1024, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  writeFileSync(join(out, name + '.stdout'), r.stdout ?? '');
  writeFileSync(join(out, name + '.stderr'), r.stderr ?? '');
  records.push({ name, command: [executable, ...args], started, finished: new Date().toISOString(),
    exit: r.status, signal: r.signal, error: r.error?.message ?? null,
    stdoutSha256: sha(r.stdout ?? ''), stderrSha256: sha(r.stderr ?? '') });
  writeFileSync(join(out, 'commands.json'), JSON.stringify({ mode, node: process.version, executable: process.execPath, records }, null, 2) + '\n');
  process.stdout.write(`${name}: exit ${r.status}\n`);
  if (r.status !== 0) throw Error(`${name} failed; first attempt retained`);
}
async function bundle(name, entry, emitted = false) {
  const outfile = join(out, name + '.mjs');
  const result = await build({ entryPoints: [join(here, entry)], outfile, bundle: true,
    format: 'esm', platform: 'node', target: 'node22', logLevel: 'silent', metafile: true,
    ...(emitted ? { plugins: [{ name: 'real-emitted-providers', setup(api) {
      api.onResolve({ filter: /^\.\/(candidate|verification)\.js$/ }, args =>
        ({ path: join(out, 'modules', args.path.slice(2)) }));
    } }] } : {}) });
  const inputs = Object.keys(result.metafile.inputs).map(p => ({ path: p, sha256: sha(readFileSync(resolve(root, p))) }));
  if (emitted && inputs.some(p => /\/(candidate|verification)\.ts$/.test(p.path))) throw Error('source provider in emitted graph');
  writeFileSync(join(out, name + '.graph.json'), JSON.stringify({ emitted, inputs, bundleSha256: sha(readFileSync(outfile)) }, null, 2) + '\n');
  return outfile;
}
try {
  if (mode === 'error-tests') {
    const file = await bundle('trajectory-errors', 'trajectory-errors.test.mjs');
    command('trajectory-errors', process.execPath, ['--test', file]);
  } else if (mode === 'world-source' || mode === 'world-emitted') {
    const emitted = mode === 'world-emitted';
    command('trajectory', process.execPath, [join(here, 'trajectory-run.mjs'), emitted ? 'emitted-candidate' : 'source',
      runId.replace('-command', ''),
      ...(emitted ? [resolve(root, canonicalWorldPath ?? 'missing-canonical-result')] : [])], 600000);
  } else if (mode === 'fixture') command('fixture', 'python3', [join(here, 'extract-fixture.py'), '--output', join(out, 'fixture.json')]);
  else if (mode === 'source-tests') {
    for (const name of ['candidate', 'verification']) {
      const file = await bundle(name, name + '.test.ts');
      command(name, process.execPath, ['--test', file]);
    }
  } else if (mode === 'source-first') {
    const file = await bundle('first-frame', 'first-frame.ts');
    command('first-frame', process.execPath, [file, join(here, 'evidence/fixture-01/fixture.json'), join(out, 'result.json'), '2']);
  } else {
    mkdirSync(join(out, 'modules')); writeFileSync(join(out, 'modules/package.json'), '{"type":"module"}\n');
    command('strict-emission', process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
      join(here, 'candidate.ts'), join(here, 'verification.ts'), '--target', 'ES2022', '--module', 'ES2022',
      '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck', '--declaration', '--outDir', join(out, 'modules')]);
    for (const name of ['candidate', 'verification']) {
      const file = await bundle(name, name + '.test.ts', true);
      command(name, process.execPath, ['--test', file]);
    }
    const file = await bundle('first-frame', 'first-frame.ts', true);
    command('first-frame', process.execPath, [file, join(here, 'evidence/fixture-01/fixture.json'), join(out, 'result.json'), '1']);
  }
  for (const f of files.filter(x => /\.(ts|py|mjs)$/.test(x.path))) {
    if (sha(readFileSync(join(root, f.path))) !== f.sha256) throw Error('source changed during run: ' + f.path);
  }
} catch (error) {
  writeFileSync(join(out, 'failure.txt'), String(error) + '\n'); process.exitCode = 1;
}
