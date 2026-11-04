// D531: exact public-adapter artifact eligibility for TWO retained D406 positive native-reader inputs.
// node test/step-report-native-replay.mjs /ABS/NEW/OUTPUT /ABS/RETAINED_D406_FIXTURES [D406_QUALIFICATION_JSON]
// This runs no native reader, download, install, browser, Git operation or byte normalization.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve} from 'node:path';

const repo = resolve(import.meta.dirname, '../../..'), app = resolve(import.meta.dirname, '..');
const output = process.argv[2], retained = process.argv[3];
const qualification = resolve(process.argv[4] ?? join(repo, 'apps/cad-studio/handover/notes/step-native-reader-2026-11-01/qualification.json'));
assert.ok(output && retained && isAbsolute(output) && isAbsolute(retained), 'Absolute new output and retained fixture directories are required');
assert.ok(relative(repo, resolve(output)).startsWith('../'), 'Raw output must stay outside the Git worktree');
await mkdir(output); // Never overwrite retained evidence or an earlier failed replay.
const sha = value => createHash('sha256').update(value).digest('hex');
const capture = async files => {
  const hashes = {};
  for (const file of [...new Set(files.map(file => resolve(file)))].sort()) hashes[file] = sha(await readFile(file));
  return hashes;
};
const own = import.meta.filename, lock = join(repo, 'pnpm-lock.yaml');
const inputs = [qualification, ...['box', 'assembly'].flatMap(name => [join(retained, `${name}.bcad`), join(retained, `${name}.step`)])];
const receipt = {status: 'RUNNING', classification: 'RETAINED_D406_EXACT_INPUT_ELIGIBILITY', nativeReaderExecuted: false,
  physicalClaim: 'No fresh reader or new physical certificate; only exact full-byte eligibility for retained D406 positive cases.',
  nativeAdjustmentScope: 'Automatic ShapeProcess disabled in retained proof; not every built-in translator adjustment disabled.', rows: []};
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2));
let sourceBefore, sourceFiles;
try {
  const historical = JSON.parse(await readFile(qualification, 'utf8'));
  assert.equal(historical.decision, 'D406'); assert.equal(historical.native.status, 'PASS');
  assert.equal(historical.native.productImports, 0);
  assert.match(historical.native.scope, /ShapeProcess disabled/); assert.match(historical.native.scope, /not every/);
  receipt.inputBefore = await capture(inputs);
  const initialFiles = [own, lock];
  for (const name of ['barocss-cad', 'barocss-cad-model']) {
    const directory = join(repo, 'packages', name, 'src');
    for (const file of await readdir(directory, {recursive: true})) if (/\.(ts|tsx|js|json)$/.test(file)) initialFiles.push(join(directory, file));
  }
  const initial = await capture(initialFiles);
  await writeFile(join(output, 'source-initial.json'), JSON.stringify(initial, null, 2));
  const producerSource = `import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {part} from '@barocss/cad-model/api';
import {exportStudioStep} from '@barocss/cad-model/engine/evaluate';
const output=process.argv[2], retained=process.argv[3], timestamp='2026-11-01T00:00:00';
function fixedClock(run) {
  const Original=globalThis.Date, descriptor=Object.getOwnPropertyDescriptor(globalThis,'Date');
  class FixedDate extends Original { constructor(){super(timestamp+'Z');} }
  Object.defineProperty(globalThis,'Date',{...descriptor,value:FixedDate});
  try{return run();}finally{Object.defineProperty(globalThis,'Date',descriptor);}
}
const rows=[];
for(const name of ['box','assembly']) {
  const bytes=readFileSync(join(retained,name+'.bcad')), doc=JSON.parse(bytes), before=JSON.stringify(doc), exportName='D404 '+name;
  const model=part(exportName,doc);
  const report=fixedClock(()=>model.stepReport(exportName));
  const legacy=fixedClock(()=>model.step(exportName));
  const direct=exportStudioStep(doc,{name:exportName,timestamp});
  assert.deepEqual(report,direct,'Entire public report must equal actual current native writer report');
  assert.equal(legacy,report.text,'Legacy public STEP keeps exact text');
  assert.equal(JSON.stringify(doc),before,'Public/direct export must not alter the loaded document');
  const old=readFileSync(join(retained,name+'.step')), actual=Buffer.from(report.text,'utf8');
  assert.deepEqual(actual,old,'Complete public report text bytes must equal retained native-reader input: '+name);
  writeFileSync(join(output,name+'.step'),actual);
  writeFileSync(join(output,name+'.report.json'),JSON.stringify(report,null,2));
  rows.push({name,exportName,source:report.source,omitted:report.omitted,omittedPresent:Object.hasOwn(report,'omitted'),bytes:actual.length,
    publicDirectReportEqual:true,legacyTextEqual:true,entireRetainedBytesEqual:true,documentUnchanged:true});
}
console.log(JSON.stringify({rows}));`;
  const built = await build({stdin: {contents: producerSource, resolveDir: app, sourcefile: 'd531-step-report-replay.ts', loader: 'ts'},
    bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true});
  const script = join(output, 'public-step-report-replay.mjs');
  await writeFile(script, built.outputFiles[0].contents); await writeFile(join(output, 'producer-source.ts'), producerSource);
  await writeFile(join(output, 'producer-metafile.json'), JSON.stringify(built.metafile, null, 2));
  sourceFiles = [own, lock, ...Object.keys(built.metafile.inputs).filter(file => !file.includes('d531-step-report-replay.ts')).map(file => resolve(file))];
  sourceBefore = await capture(sourceFiles);
  for (const [file, hash] of Object.entries(sourceBefore)) assert.equal(initial[file], hash, `Bundled transitive source must equal pre-build source: ${file}`);
  receipt.virtualProducer = {sourceSha256: sha(producerSource), bundleSha256: sha(built.outputFiles[0].contents), hashPurpose: 'source/artifact identity only'};
  receipt.sourceBefore = sourceBefore;
  await writeFile(join(output, 'source-before.json'), JSON.stringify(sourceBefore, null, 2)); await persist();
  const run = spawnSync(process.execPath, [script, output, retained], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  await writeFile(join(output, 'producer.stdout.json'), run.stdout ?? ''); await writeFile(join(output, 'producer.stderr.txt'), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr); const result = JSON.parse(run.stdout);
  for (const row of result.rows) {
    const positive = historical.native.cases[row.name];
    assert.equal(positive.status, 'PASS'); assert.equal(positive.comparison.pass, true); assert.deepEqual(positive.comparison.errors, []);
    const actual = await readFile(join(output, `${row.name}.step`)), old = await readFile(join(retained, `${row.name}.step`));
    assert.deepEqual(actual, old); assert.equal(sha(actual), positive.inputSha256);
    const metrics = positive.metrics;
    for (const flag of ['flags_set_before', 'flags_empty_before', 'flags_set_after', 'flags_empty_after']) assert.equal(metrics[flag], true);
    assert.equal(metrics.valid, true); assert.equal(metrics.load_failure_count, 0); assert.equal(metrics.transfer_failure_count, 0);
    receipt.rows.push({...row, documentSha256: receipt.inputBefore[join(retained, `${row.name}.bcad`)], publicInputSha256: sha(actual),
      retainedNativeInputSha256: positive.inputSha256, retainedPositiveMetrics: metrics, retainedComparison: positive.comparison,
      nativeEvidence: 'D406 native.cases positive qualification only; original native-smoke failures excluded'});
  }
  assert.equal(receipt.rows.length, 2); receipt.inputAfter = await capture(inputs); assert.deepEqual(receipt.inputAfter, receipt.inputBefore);
  receipt.sourceAfter = await capture(sourceFiles); assert.deepEqual(receipt.sourceAfter, sourceBefore);
  await writeFile(join(output, 'source-after.json'), JSON.stringify(receipt.sourceAfter, null, 2)); receipt.status = 'PASS';
} catch (error) { receipt.status = 'FAIL'; receipt.failure = error.stack ?? String(error); process.exitCode = 1; }
finally {
  if (sourceBefore) try {
    receipt.sourceFinal = await capture(sourceFiles); assert.deepEqual(receipt.sourceFinal, sourceBefore);
    await writeFile(join(output, 'source-final.json'), JSON.stringify(receipt.sourceFinal, null, 2));
    receipt.inputFinal = await capture(inputs); assert.deepEqual(receipt.inputFinal, receipt.inputBefore);
  } catch (error) { receipt.status = 'FAIL'; receipt.custodyFailure = error.stack ?? String(error); process.exitCode = 1; }
  await persist();
  console.log(JSON.stringify({status: receipt.status, classification: receipt.classification, cases: receipt.rows.length, nativeReaderExecuted: false, output, failure: receipt.failure, custodyFailure: receipt.custodyFailure}));
}
