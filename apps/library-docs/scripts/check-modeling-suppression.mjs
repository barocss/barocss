// Static/type provenance only. Never imports or executes native geometry.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';

const app = resolve(import.meta.dirname, '..'), root = resolve(app, '../..');
const enginePin = 'bf349441ec853a5349156d01a9e235e8b99e990e';
const acceptedProviderPin = 'adadb5b53fcb22f3f12e73041ac5aa56f03cd7e9';
const predecessorPin = '3a7b7ea2712c739f1d7bbc8774301f821027e9e6';
const provider = resolve(process.env.CAD_MODEL_ROOT ?? root), mode = process.argv[2] ?? 'source';
assert.ok(['static', 'source', 'emitted'].includes(mode), 'Expected static, source or emitted mode');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const ts = require('typescript');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (path, pin = enginePin) => execFileSync('git', ['show', `${pin}:${path}`], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
const file = resolve(app, 'docs/public/examples/modeling-suppression.ts');
const snippet = readFileSync(file, 'utf8'), page = readFileSync(resolve(app, 'docs/packages/cad/modeling.md'), 'utf8');
const regions = [...page.matchAll(/^<<< .*modeling-suppression\.ts#([^\s]+)$/gm)].map(match => match[1]);
assert.equal(regions.length, 5);
for (const region of regions) assert.ok(snippet.includes(`// #region ${region}\n`) && snippet.includes(`// #endregion ${region}\n`), region);
for (const term of [
  "withBase('/examples/modeling-suppression.ts')", 'snapshot.withSuppression(edits)', 'snapshot.suppression',
  '3032 / 3032', '3064 / 3064', '3040 / 3040', '3072 / 3072',
  'Pending numeric drafts block finishing actions until Apply or Discard',
  'true` means the finish is off', 'paired `name`/`suppressed` fields', 'schema1', 'two named chamfers',
  'Disabled finishes still validate', 'METRIC', 'native savings claim',
  '8 model calls and 1 negative-body tessellation', '41,901-byte baseline transfer',
  'geometry-equivalent adapted transport replay', 'mocked Worker', 'not newly tessellated native states', 'UNRUN',
]) assert.ok(page.includes(term), term);
assert.ok(!page.includes('Only `withParameters` on the exact accepted snapshot can reuse'));
for (const forbidden of ['schema:', 'sourceVersion', 'solidId:', 'expectedRevision:', 'format:']) assert.ok(!snippet.includes(forbidden), forbidden);
assert.equal(ts.transpileModule(snippet, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true }).diagnostics?.length ?? 0, 0);

const modeling = readFileSync(resolve(provider, 'packages/barocss-cad/src/modeling.ts'));
assert.equal(digest(modeling), digest(git('packages/barocss-cad/src/modeling.ts')));
assert.equal(digest(modeling), digest(git('packages/barocss-cad/src/modeling.ts', acceptedProviderPin)));
const receiptText = git('packages/barocss-cad/test/modeling-suppression-evidence/verification.json');
const receipt = JSON.parse(receiptText), { source, cold } = receipt.actual;
assert.equal(receipt.attempts.length, 1);
assert.equal(receipt.attempts[0].status, 'passed');
assert.equal(receipt.attempts[0].modelCalls, 8);
assert.equal(source.modelCalls, 6); assert.equal(cold.modelCalls, 2);
assert.equal(source.tessellations, 1); assert.equal(source.display.side, 'negative');
for (const [state, flags, expected] of [
  [source.baseline, [false, false], 3032], [source.noop, [false, false], 3032],
  [source.plain, [true, true], 3072], [source.frontOnly, [false, true], 3064],
  [source.restored, [false, false], 3032], [cold.reopened, [false, false], 3032],
  [cold.reedited, [true, false], 3040],
]) {
  assert.deepEqual([state.frontSuppressed, state.backSuppressed], flags);
  assert.deepEqual([state.negativeMM3, state.positiveMM3], [expected, expected]);
  assert.equal(state.validatedChamferCandidates, 2); assert.equal(state.exactSelectedParent, true);
}
assert.equal(source.refusal.code, 'NATIVE'); assert.equal(source.refusal.operation, 'chamfer');
assert.equal(source.refusal.cause.name, 'ConvexPlanarSolidChamferError');
assert.equal(source.refusal.cause.code, 'METRIC'); assert.equal(source.refusal.cause.stage, 'chamfer');
assert.equal(source.noopOwnedIdentityPreserved, true); assert.equal(source.futureUseAfterRefusal, true);
assert.equal(source.literalPredecessorBodyParity, true);
assert.equal(source.fullTransitiveNativeCoverage, 'NOT_MEASURED');
assert.deepEqual(source.stages[1].recomputation, { reusedFeatures: [0, 1, 2, 3, 4], evaluatedFeatures: [] });
for (const stage of [source.stages[2], source.stages[3], source.stages[5], ...cold.stages])
  assert.deepEqual(stage.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2, 3, 4] });

const transfer = readFileSync(resolve(root, 'packages/barocss-cad-editor/scripts/fixtures/modeling-suppression/baseline-native.json'));
assert.deepEqual({ bytes: transfer.length, sha256: digest(transfer) }, source.transfer);
assert.deepEqual(source.transfer, { bytes: 41901, sha256: 'bc0d9259ad9b0a2edf4b9f91e4f76aeaaf3ecfe4e6edb175275dc98b2f89c798' });
const baseline = JSON.parse(transfer);
assert.equal(baseline.bodySHA256, source.initialBodySHA256);
assert.deepEqual(baseline.suppression, { frontFinish: false, backFinish: false });
assert.equal(baseline.negativeComponent.role, 'negative');
assert.equal(Object.hasOwn(baseline, 'positiveComponent'), false);
const predecessorText = git('packages/barocss-cad/test/modeling-chamfer-split-evidence/verification.json', predecessorPin);
const predecessor = JSON.parse(predecessorText);
assert.equal(source.initialBodySHA256, predecessor.actual.source.initialBodySHA256);
const predecessorTransfer = readFileSync(resolve(root, 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-split/baseline-transport.json'));
assert.deepEqual({ bytes: predecessorTransfer.length, sha256: digest(predecessorTransfer) }, predecessor.actual.source.transport);

// Pin all twenty pre-existing downloadable source/authored files; image assets are outside this inventory.
const priorDocs = JSON.parse(git('apps/library-docs/evidence/modeling-miter-docs.json'));
const preservedDownloads = [...priorDocs.preservedDownloads, {
  path: 'apps/library-docs/docs/public/examples/modeling-miter.ts',
  sha256: priorDocs.types.source.downloadSHA256,
}];
assert.equal(preservedDownloads.length, 20);
for (const { path, sha256 } of preservedDownloads) assert.equal(digest(readFileSync(resolve(root, path))), sha256, path);
const downloadFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? downloadFiles(join(directory, entry.name)) : /\.(?:ts|json|cad\.css)$/.test(entry.name) ? [join(directory, entry.name)] : []);
assert.equal(downloadFiles(resolve(app, 'docs/public/examples')).length, 21);

const ui = readFileSync(resolve(root, 'packages/barocss-cad-editor/src/react/modeling-editor.tsx'), 'utf8');
for (const term of [
  '<option value="configurable-finishes">Configure rail finishes</option>', '<legend>Rail finishes</legend>',
  "['Both on', false, false]", "['Front only', false, true]", "['Back only', true, false]", "['Both off', true, true]",
  'disabled={busy || draft}', 'Apply or discard pending dimensions before configuring finishes.',
  's.configureFinishes(', 'backY · edge-selection Y coordinate',
  "useState<CadEditorModelingExample>('cut-chamfer')", 'disabled={busy || (!!accepted && !replaceExample)}',
  'setExample(event.target.value as CadEditorModelingExample); setReplaceExample(false);',
]) assert.ok(ui.includes(term), term);
assert.equal(ts.transpileModule(ui, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, fileName: 'modeling-editor.tsx', reportDiagnostics: true }).diagnostics?.length ?? 0, 0);
// Inspect the actual metadata predicate without rendering React or using a browser.
const uiTree = ts.createSourceFile('modeling-editor.tsx', ui, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
let predicate;
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(uiTree) === 'configurableFinishes') predicate = node.initializer.getText(uiTree);
  ts.forEachChild(node, visit);
};
visit(uiTree); assert.ok(predicate);
const predicateJS = ts.transpileModule(`globalThis.result = (${predicate});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const classify = accepted => { const context = { accepted }; runInNewContext(predicateJS, context); return context.result; };
const named = { source: 'model', suppression: baseline.suppression, features: baseline.features };
for (const [frontFinish, backFinish] of [[false, false], [false, true], [true, false], [true, true]])
  assert.equal(classify({ ...named, suppression: { frontFinish, backFinish } }), true);
assert.equal(classify({ ...named, source: 'legacy' }), false);
assert.equal(classify({ ...named, suppression: undefined }), false);
assert.equal(classify({ ...named, suppression: { other: false, backFinish: false } }), false);
assert.equal(classify({ ...named, features: [{ kind: 'extrude', name: 'frontFinish' }] }), false);

let entry;
if (mode !== 'static') {
  entry = resolve(provider, `packages/barocss-cad/${mode === 'source' ? 'src/index.ts' : 'dist/index.d.ts'}`);
  const directory = mkdtempSync(join(tmpdir(), 'cad-suppression-doc-types-'));
  try {
    const files = [file, resolve(app, 'scripts/snippets/modeling-api.ts'), ...[
      'modeling-intersection.ts', 'modeling-split.ts', 'modeling-cardinal-split.ts', 'modeling-chamfer-chain.ts',
      'modeling-chamfer-split.ts', 'modeling-dimensions.ts', 'modeling-miter.ts',
    ].map(path => resolve(app, 'docs/public/examples', path))];
    const config = join(directory, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', skipLibCheck: true, types: [], paths: { '@barocss/cad': [entry] } }, files }));
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], { stdio: 'inherit' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
console.log(JSON.stringify({
  ok: true, scope: 'named-finishing guide/download and metadata predicate; pinned native receipt/transport parity; unchanged prior downloads; no native execution',
  mode, typedExampleFiles: mode === 'static' ? 0 : 9, typeCheck: mode === 'static' ? 'UNRUN' : 'passed',
  actualUiMetadataPredicateCases: 8, enginePin, acceptedProviderPin,
  engineReceiptSHA256: digest(receiptText), modelingSourceSHA256: digest(modeling),
  ...(entry ? { entrySHA256: digest(readFileSync(entry)) } : {}), downloadSHA256: digest(snippet),
  nativeBaseline: { bytes: transfer.length, sha256: digest(transfer), measuredMeshes: ['negative'] },
  predecessorBaseline: { bytes: predecessorTransfer.length, sha256: digest(predecessorTransfer) },
  fullBodyParitySHA256: baseline.bodySHA256, preservedDownloads, totalDownloadsAfter: 21,
  nativeCampaignRun: false, browserOrReactRun: false,
}, null, 2));
