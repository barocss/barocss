// Static/type provenance only. Never imports or executes native geometry or the editor.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const app = resolve(import.meta.dirname, '..'), root = resolve(app, '../..');
const providerPin = '16535777b4ef2d5ace64b97dbf834f6aff3d6425';
const testedProductPin = '78852bd43b840b1635d83a95d2eaa493936c0673';
const provider = resolve(process.env.CAD_MODEL_ROOT ?? root), mode = process.argv[2] ?? 'static';
assert.ok(['static', 'source', 'emitted'].includes(mode), 'Expected static, source or emitted mode');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const ts = require('typescript');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = path => execFileSync('git', ['show', `${providerPin}:${path}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
const file = resolve(app, 'docs/public/examples/modeling-union.ts');
const snippet = readFileSync(file, 'utf8'), page = readFileSync(resolve(app, 'docs/packages/cad/modeling.md'), 'utf8');
const regions = [...page.matchAll(/^<<< .*modeling-union\.ts#([^\s]+)$/gm)].map(match => match[1]);
assert.deepEqual([...regions].sort(), ['edit-union', 'qualified-union-output', 'refused-union', 'save-reopen-union', 'union-bracket']);
for (const region of regions) assert.ok(snippet.includes(`// #region ${region}\n`) && snippet.includes(`// #endregion ${region}\n`), region);
for (const term of [
  "withBase('/examples/modeling-union.ts')", 'Fuse an L-bracket', '`union-bracket`',
  '`build({ base, leg, bracket })`', '3072 mm³', '3584', '4608', 'legMinX:32', 'legMinX:40',
  'CONTACT', 'SELECTION', 'every contributing operand face', 'exact rational UV corners',
  'Open initially selects `leg`; choose `bracket`', 'This is not view restoration',
  'all outputs before any output tessellation', '64 complete generated panels', '72 panels',
  'A 65-panel candidate refuses before any tessellation', 'never truncate or merge panels',
  '`countU:2, countV:2`', '`part-xyz`', '`[x,z,-y]` exactly once',
  'positive safe-integer volume', 'volumeMM3:null', '1 scene unit = 1 mm', '±1000',
  '8 model calls and 1 CPU preparation', '1 full Boolean revalidation and 14 panel tessellations',
  '524,722-byte genuine baseline transfer', 'The original tessellation UV arrays were not retained',
  'adapted replay', 'native validator explicitly stubbed', 'Changed-state meshes are mocked',
  'zero native model, validation or tessellation calls', 'eleven public examples/snippets',
  'External visual gate OPEN', 'physical file-dialog acceptance', 'issues/1644', 'issues/1119',
  'issues/534', 'issues/535', 'issues/551',
]) assert.ok(page.includes(term), term);
assert.ok(!page.includes('Editor preview is unavailable for this family'));
for (const forbidden of ['schema:', 'sourceVersion', 'solidId:', 'expectedRevision:', 'format:']) assert.ok(!snippet.includes(forbidden), forbidden);
assert.equal(ts.transpileModule(snippet, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true,
}).diagnostics?.length ?? 0, 0);
// No top-level initializer or expression can evaluate native geometry on import.
const tree = ts.createSourceFile(file, snippet, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
for (const statement of tree.statements) {
  assert.ok(ts.isImportDeclaration(statement) || ts.isFunctionDeclaration(statement), 'Example import must be inert');
  if (ts.isImportDeclaration(statement)) assert.equal(statement.moduleSpecifier.text, '@barocss/cad');
}

const fixturePath = 'packages/barocss-cad/test/modeling-union-fixture.mjs';
const fixture = readFileSync(resolve(provider, fixturePath));
const modeling = readFileSync(resolve(provider, 'packages/barocss-cad/src/modeling.ts'));
assert.equal(digest(fixture), digest(git(fixturePath)));
assert.equal(digest(modeling), digest(git('packages/barocss-cad/src/modeling.ts')));
const receiptPath = 'packages/barocss-cad/test/modeling-union-evidence/verification.json';
const receiptText = git(receiptPath), receipt = JSON.parse(receiptText);
assert.equal(digest(receiptText), '513d1277cf9c0f4335b54ed3e3fa22b4a3cc2e5e98374c8b819f5cf9454a9cce');
assert.equal(digest(readFileSync(resolve(provider, receiptPath))), digest(receiptText));
assert.equal(receipt.testedProductCommit, testedProductPin);
assert.equal(receipt.attempts[0].status, 'failed'); // Preserve the first type-narrowing failure.
assert.deepEqual(receipt.attempts.at(-1), {
  stage: 'first native campaign', status: 'passed', source: testedProductPin,
  modelCalls: 8, cpuPreparations: 1, nativeBooleanRevalidations: 1, panelTessellations: 14, wallSeconds: 3.534,
});
const { source, cold } = receipt.actual;
assert.equal(source.status, 'passed'); assert.equal(cold.status, 'passed');
assert.equal(source.modelCalls, 6); assert.equal(cold.modelCalls, 2); assert.equal(source.cpuPreparations, 1);
assert.equal(source.cpu.nativeValidationIncludesFullBooleanRebuild, true);
assert.equal(source.cpu.report.nativeValidationCalls, 1); assert.equal(source.cpu.report.tessellateSurfaceCalls, 14);
assert.equal(source.cpu.report.vertexCount, 56); assert.equal(source.cpu.report.triangleCount, 28);
assert.equal(source.cpu.report.maximumPanels, 72);
for (const [state, volume, panels] of [
  [source.baseline, 3072, 14], [source.wide, 3584, 14], [source.faceContact, 3584, 14],
  [source.restored, 3072, 14], [cold.reopened, 3072, 14], [cold.reedited, 4608, 20],
]) {
  assert.equal(state.volumeMM3, volume); assert.equal(state.bodyCount, 1);
  assert.equal(state.panels, panels); assert.equal(state.sourceCount, panels);
  assert.equal(state.report.geometryFamily, 'exact-integer-orthogonal-cell-solid-v0');
  assert.equal(state.report.solid, true); assert.equal(state.report.empty, false);
  assert.equal(state.report.quality.restrictedCellModelEmbeddingCertified, true);
  assert.equal(state.report.quality.restrictedBoundaryManifoldCertified, true);
  assert.equal(state.originalConvexIdentity, true);
}
assert.equal(source.edgeRefusal.code, 'NATIVE'); assert.equal(source.edgeRefusal.operation, 'union');
assert.equal(source.edgeRefusal.cause.name, 'AxisBoxSolidBooleanError'); assert.equal(source.edgeRefusal.cause.code, 'CONTACT');
assert.equal(source.disconnectedRefusal.code, 'SELECTION'); assert.equal(source.disconnectedRefusal.operation, 'union');
assert.equal(source.disconnected.bodyCount, 2); assert.equal(source.disconnected.volumeMM3, 3584);
assert.equal(source.futureReuseAfterBothRefusals, true); assert.equal(source.oldAndNewSnapshotsIndependent, true);
assert.equal(source.fullTransitiveNativeCoverage, 'NOT_MEASURED');
assert.equal(source.initialBodySHA256, source.editedBodySHA256);
assert.equal(source.editedBodySHA256, cold.reopenedBodySHA256);
for (const stage of [source.stages[1], source.stages[2], source.stages[5]])
  assert.deepEqual(stage.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2, 3, 4] });
assert.deepEqual(cold.stages[0].recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2, 3, 4] });
assert.deepEqual(cold.stages[1].recomputation, { reusedFeatures: [0, 1, 2], evaluatedFeatures: [3, 4] });

// Pin all 22 prior downloads to the adopted base, not the changing working tree.
const priorDocs = JSON.parse(git('apps/library-docs/evidence/modeling-hole-docs.json'));
const preservedDownloads = [...priorDocs.preservedDownloads, {
  path: 'apps/library-docs/docs/public/examples/modeling-hole.ts', sha256: priorDocs.types.source.downloadSHA256,
}];
assert.equal(preservedDownloads.length, 22); assert.equal(new Set(preservedDownloads.map(({ path }) => path)).size, 22);
for (const { path, sha256 } of preservedDownloads) {
  assert.equal(digest(git(path)), sha256, `${path} at adopted base`);
  assert.equal(digest(readFileSync(resolve(root, path))), sha256, path);
}
const downloadFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? downloadFiles(join(directory, entry.name)) : /\.(?:ts|json|cad\.css)$/.test(entry.name) ? [join(directory, entry.name)] : []);
assert.equal(downloadFiles(resolve(app, 'docs/public/examples')).length, 23);

let entry;
if (mode !== 'static') {
  entry = resolve(provider, `packages/barocss-cad/${mode === 'source' ? 'src/index.ts' : 'dist/index.d.ts'}`);
  if (mode === 'emitted') {
    for (const [path, sha256] of Object.entries(receipt.emittedDeclarationHashes))
      assert.equal(digest(readFileSync(resolve(provider, 'packages/barocss-cad', path))), sha256, path);
  } else {
    for (const [path, sha256] of Object.entries(receipt.sourceGraph.inputHashes))
      assert.equal(digest(readFileSync(resolve(provider, path))), sha256, path);
  }
  const directory = mkdtempSync(join(tmpdir(), 'cad-union-doc-types-'));
  try {
    const files = [file, resolve(app, 'scripts/snippets/modeling-api.ts'), ...[
      'modeling-intersection.ts', 'modeling-split.ts', 'modeling-cardinal-split.ts', 'modeling-chamfer-chain.ts',
      'modeling-chamfer-split.ts', 'modeling-dimensions.ts', 'modeling-miter.ts', 'modeling-suppression.ts', 'modeling-hole.ts',
    ].map(path => resolve(app, 'docs/public/examples', path))];
    assert.equal(files.length, 11);
    const config = join(directory, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2022',
      module: 'NodeNext', moduleResolution: 'NodeNext', skipLibCheck: true, types: [], paths: { '@barocss/cad': [entry] } }, files }));
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], { stdio: 'inherit' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
console.log(JSON.stringify({
  ok: true, scope: 'connected-union guide/download; pinned provider/native receipts; 22 prior downloads unchanged; no native execution',
  mode, typedExampleFiles: mode === 'static' ? 0 : 11, typeCheck: mode === 'static' ? 'UNRUN' : 'passed',
  providerPin, testedProductPin, engineReceiptSHA256: digest(receiptText),
  modelingSourceSHA256: digest(modeling), providerFixtureSHA256: digest(fixture),
  ...(entry ? { entrySHA256: digest(readFileSync(entry)) } : {}),
  downloadSHA256: digest(snippet), guideSHA256: digest(page),
  preservedDownloads, totalDownloadsAfter: 23, nativeCampaignRun: false, browserOrReactRun: false,
  physicalFileFlows: 'UNRUN', externalVisualGate: 'OPEN',
  uiBehaviorScope: 'Separate actual controller/scene/recipe tests; static checks do not establish behavior',
}, null, 2));
