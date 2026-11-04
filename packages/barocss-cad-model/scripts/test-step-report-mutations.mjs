// Finite external source overlays. The STEP writer and worktree sources are never rewritten.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..'), repo = realpathSync(resolve(root, '../..'));
const targets = {
  part: realpathSync(join(repo, 'packages/barocss-cad/src/api/part.ts')),
  model: realpathSync(join(root, 'src/api/core.ts')),
  backend: realpathSync(join(root, 'src/api/studio.ts')),
};
const original = new Map(Object.values(targets).map(path => [path, readFileSync(path, 'utf8')]));
function change(target, from, to) {
  const source = original.get(target);
  if (source.split(from).length !== 2) throw new Error(`Expected exactly one mutation site: ${from}`);
  return { target, contents: source.replace(from, to) };
}
const copy = 'return { text: report.text, source: report.source, ...(report.omitted !== undefined ? { omitted: [...report.omitted] } : {}) };';
const variants = [
  ['baseline', { target: targets.model, contents: original.get(targets.model) }],
  ['backend-report-loss-drop', change(targets.backend, '  stepReport: stepReportOf,', '  stepReport: (doc, name) => { const result = stepReportOf(doc, name); return { text: result.text, source: result.source }; },')],
  ['source-wrong', change(targets.model, '    return step;', "    return { ...step, source: 'invented-source' };")],
  ['omitted-drop', change(targets.part, copy, 'return { text: report.text, source: report.source };')],
  ['omitted-alias', change(targets.part, copy, 'return report;')],
  ['omitted-absence', change(targets.part, copy, 'return { text: report.text, source: report.source, omitted: report.omitted ? [...report.omitted] : undefined };')],
  ['legacy-shape', change(targets.model, 'return stepReportOf(doc, name).text;', 'return stepReportOf(doc, name);')],
  ['band-guard-drop', change(targets.model, '    if (sheet) throw new Error(sheet);', '')],
  ['name-drop', change(targets.part, 'this.backend.stepReport(this.#doc, name)', "this.backend.stepReport(this.#doc, 'part')")],
  ['body-drop', change(targets.model, 'exportStudioStep(doc, { name })', 'exportStudioStep({ ...doc, outputs: Object.fromEntries(Object.entries(doc.outputs ?? {}).slice(0, 1)) }, { name })')],
  ['duplicate-export', change(targets.model, 'const step = exportStudioStep(doc, { name }), sheet', 'const step = (exportStudioStep(doc, { name }), exportStudioStep(doc, { name })), sheet')],
];
const evidence = process.argv[2] ? realpathSync(process.argv[2]) : null;
if (evidence && (evidence === repo || evidence.startsWith(`${repo}/`))) throw new Error('Evidence must be outside the worktree');
const out = realpathSync(mkdtempSync(join(tmpdir(), 'step-report-mutations-'))), receipts = [];
const sha = text => createHash('sha256').update(text).digest('hex');
try {
  for (const [name, { target, contents }] of variants) {
    const dir = join(out, name); mkdirSync(dir);
    const overlay = join(dir, 'overlay.ts'), outfile = join(dir, 'test.mjs'), trace = [];
    writeFileSync(overlay, contents);
    const plugin = { name: 'one-step-api-source', setup(builder) {
      builder.onLoad({ filter: /\.ts$/ }, args => {
        if (realpathSync(args.path) !== target) return;
        trace.push({ source: target, overlay });
        return { contents, loader: 'ts', resolveDir: resolve(target, '..') };
      });
    } };
    await build({ entryPoints: [join(root, 'test/api-step-report.test.ts')], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning', define: { 'import.meta.dirname': JSON.stringify(join(root, 'test')) }, plugins: [plugin] });
    const result = spawnSync(process.execPath, ['--test', outfile], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (result.error) throw result.error;
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    // Preserve every behavioral receipt before validation can throw.
    if (evidence) {
      writeFileSync(join(evidence, `${name}.log`), output);
      writeFileSync(join(evidence, `${name}.source.ts`), contents);
      writeFileSync(join(evidence, `${name}.trace.json`), JSON.stringify(trace, null, 2));
    }
    const count = key => Number(new RegExp(`^# ${key} (\\d+)$`, 'm').exec(output)?.[1] ?? NaN);
    const tests = count('tests'), passed = count('pass'), failed = count('fail'), cancelled = count('cancelled');
    const assertions = (output.match(/^\s+code: 'ERR_ASSERTION'$/gm) ?? []).length;
    if (!trace.length || tests !== 19 || passed + failed !== tests || cancelled !== 0 || result.signal) throw new Error(`${name}: incomplete overlay/behavioral census\n${output}`);
    if (name === 'baseline') {
      if (result.status !== 0 || failed !== 0) throw new Error(`Baseline failed\n${output}`);
    } else if (result.status !== 1 || failed < 1 || assertions !== failed) throw new Error(`${name}: not killed solely by behavioral assertions\n${output}`);
    const receipt = { variant: name, result: name === 'baseline' ? 'PASS' : 'KILLED', target: relative(repo, target), sourceSha256: sha(original.get(target)), overlaySha256: sha(contents), overrides: trace.length, tests, passed, failed, cancelled, assertions, exitCode: result.status };
    receipts.push(receipt); process.stdout.write(`${JSON.stringify(receipt)}\n`);
  }
  if (evidence) writeFileSync(join(evidence, 'summary.json'), `${JSON.stringify(receipts, null, 2)}\n`);
} finally { rmSync(out, { recursive: true, force: true }); }
