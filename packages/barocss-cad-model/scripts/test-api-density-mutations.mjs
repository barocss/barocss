// External shadow bundles only. Product sources are never rewritten and mutants execute serially.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..'), repo = resolve(root, '../..');
const target = realpathSync(join(root, 'src/api/core.ts'));
const source = readFileSync(target, 'utf8');
const guard = "  if (!(Number.isFinite(density) && density > 0)) throw refuse('DENSITY', `a density must be a positive number of g/cm³, not ${density}`);";
if (source.split(guard).length !== 2) throw new Error('Expected exactly the Model density guard to mutate');
const variants = [
  ['baseline', source],
  ['remove-guard', source.replace(guard, '')],
  ['finite-only', source.replace('Number.isFinite(density) && density > 0', 'Number.isFinite(density)')],
  ['positive-only', source.replace('Number.isFinite(density) && density > 0', 'density > 0')],
  ['allow-zero', source.replace('Number.isFinite(density) && density > 0', 'Number.isFinite(density) && density >= 0')],
];
// Optional external evidence directory. Temporary bundles are always removed, while requested logs remain.
const evidence = process.argv[2] ? realpathSync(process.argv[2]) : null;
if (evidence && (evidence === repo || evidence.startsWith(`${repo}/`))) throw new Error('Evidence must stay outside the worktree');
const out = mkdtempSync(join(tmpdir(), 'cad-model-density-mutations-'));
const receipts = [];
try {
  for (const [name, contents] of variants) {
    let overrides = 0;
    const outfile = join(out, `${name}.mjs`);
    await build({
      entryPoints: [join(root, 'test/api-density.test.ts')], outfile,
      bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning', absWorkingDir: root,
      plugins: [{ name: 'only-model-api-density', setup(builder) {
        builder.onLoad({ filter: /[\\/]api[\\/]core\.ts$/ }, args => {
          if (realpathSync(args.path) !== target) return;
          overrides++;
          return { contents, loader: 'ts', resolveDir: resolve(target, '..') };
        });
      } }],
    });
    if (overrides !== 1) throw new Error(`${name}: expected one Model core source override, received ${overrides}`);
    const result = spawnSync(process.execPath, ['--test', outfile], { cwd: root, encoding: 'utf8' });
    if (result.error) throw result.error;
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (evidence) writeFileSync(join(evidence, `${basename(name)}.log`), output);
    const count = key => Number(new RegExp(`^# ${key} (\\d+)$`, 'm').exec(output)?.[1] ?? NaN);
    const tests = count('tests'), failed = count('fail'), passed = count('pass'), cancelled = count('cancelled');
    // A load/compile/runtime crash is not a killed mutation. Require the complete behavioral test census.
    if (tests !== 22 || cancelled !== 0 || passed + failed !== tests || result.signal) throw new Error(`${name}: incomplete behavioral run\n${output}`);
    if (name === 'baseline') {
      if (result.status !== 0 || failed !== 0) throw new Error(`Baseline failed\n${output}`);
    } else if (result.status !== 1 || failed < 1 || !output.includes("code: 'ERR_ASSERTION'")) {
      throw new Error(`${name}: mutation was not killed by a behavioral assertion\n${output}`);
    }
    const receipt = { variant: name, result: name === 'baseline' ? 'PASS' : 'KILLED', tests, passed, failed, cancelled, exitCode: result.status, overrides };
    receipts.push(receipt); process.stdout.write(`${JSON.stringify(receipt)}\n`);
  }
  if (evidence) writeFileSync(join(evidence, 'summary.json'), `${JSON.stringify(receipts, null, 2)}\n`);
} finally { rmSync(out, { recursive: true, force: true }); }
