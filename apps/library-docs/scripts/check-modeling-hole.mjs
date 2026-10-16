// Static/type provenance only. Never imports or executes native geometry or the editor.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const app = resolve(import.meta.dirname, '..'), root = resolve(app, '../..');
const enginePin = '0c7d6f2ff1d0df713aef483d9dda6bd1bf3ab34a';
const acceptedProviderPin = '76f47a90609bbc998318f64eb1bea2ecd5a35336';
const testedProductPin = '81f5d206d9cb02fc4bced496b64e7de0154f1f98';
const provider = resolve(process.env.CAD_MODEL_ROOT ?? root), mode = process.argv[2] ?? 'source';
assert.ok(['static', 'source', 'emitted'].includes(mode), 'Expected static, source or emitted mode');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const ts = require('typescript');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (path, pin = enginePin) => execFileSync('git', ['show', `${pin}:${path}`], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
const file = resolve(app, 'docs/public/examples/modeling-hole.ts');
const snippet = readFileSync(file, 'utf8'), page = readFileSync(resolve(app, 'docs/packages/cad/modeling.md'), 'utf8');
const regions = [...page.matchAll(/^<<< .*modeling-hole\.ts#([^\s]+)$/gm)].map(match => match[1]);
assert.deepEqual([...regions].sort(), ['edit-hole', 'mounting-plate', 'qualified-hole-output', 'refused-hole', 'save-reopen-hole']);
for (const region of regions) assert.ok(snippet.includes(`// #region ${region}\n`) && snippet.includes(`// #endregion ${region}\n`), region);
for (const term of [
  "withBase('/examples/modeling-hole.ts')", 'Mounting plate with a through-hole', '`mounting-plate`',
  '`build({ blank, plate })`', '25600 mm³', 'Certified volume unavailable', 'volumeMM3:null',
  '7 faces, 256 display vertices and 128 triangles', '20 annular panels', 'inward normals',
  'solid:false', 'topologyCertified:false', 'stored-coefficient mathematical model',
  'No certified ideal-cylinder/pi volume', 'schema1', 'same accepted narrow snapshot',
  'width:81', 'GEOMETRY', 'centerX:32.5, centerY:18.75', 'radius:18.75',
  'last entry in the validated saved output inventory', 'Every output is admitted before visibility',
  'pending numeric drafts stay unchanged', '1 scene unit = 1 mm', '±1000',
  '9 model calls, 2 tessellations and 1 six-query material classification in 2.571 seconds',
  '277,591-byte baseline transfer', 'mocked Worker', 'not newly tessellated native states',
  'external/open validation gate', 'historical #1642 full-source and diagnostic timeouts remain unpassed',
]) assert.ok(page.includes(term), term);
assert.ok(!page.includes('The current editor rejects hole'));
for (const forbidden of ['schema:', 'sourceVersion', 'solidId:', 'expectedRevision:', 'format:']) assert.ok(!snippet.includes(forbidden), forbidden);
assert.equal(ts.transpileModule(snippet, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true,
}).diagnostics?.length ?? 0, 0);
// No top-level initializer or expression can accidentally evaluate a native example on import.
const tree = ts.createSourceFile(file, snippet, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
for (const statement of tree.statements) {
  assert.ok(ts.isImportDeclaration(statement) || ts.isFunctionDeclaration(statement), 'Example import must be inert');
  if (ts.isImportDeclaration(statement)) assert.equal(statement.moduleSpecifier.text, '@barocss/cad');
}

const modeling = readFileSync(resolve(provider, 'packages/barocss-cad/src/modeling.ts'));
const fixturePath = 'packages/barocss-cad/test/modeling-hole-fixture.mjs';
const fixture = readFileSync(resolve(provider, fixturePath));
for (const pin of [enginePin, acceptedProviderPin, testedProductPin]) {
  assert.equal(digest(modeling), digest(git('packages/barocss-cad/src/modeling.ts', pin)));
  assert.equal(digest(fixture), digest(git(fixturePath, pin)));
}
const receiptPath = 'packages/barocss-cad/test/modeling-hole-evidence/verification.json';
const receiptText = git(receiptPath), receipt = JSON.parse(receiptText);
assert.equal(digest(receiptText), 'e68906473568639cb6c1396dbefc6c465623fcdf595b8eb3e6a2c64d91e53d0f');
assert.equal(digest(readFileSync(resolve(provider, receiptPath))), digest(receiptText));
assert.equal(digest(git(receiptPath, acceptedProviderPin)), digest(receiptText));
assert.equal(receipt.testedProductCommit, testedProductPin);
assert.deepEqual(receipt.attempts, [{ status: 'passed', modelCalls: 9, tessellations: 2,
  classificationCalls: 1, classificationQueries: 6, wallSeconds: 2.571 }]);
const { source, cold } = receipt.actual;
assert.equal(source.status, 'passed'); assert.equal(cold.status, 'passed');
assert.equal(source.modelCalls, 7); assert.equal(cold.modelCalls, 2);
assert.equal(source.tessellations, 2); assert.equal(source.classificationCalls, 1); assert.equal(source.classificationQueries, 6);
for (const [state, center, radius, clearance] of [
  [source.baseline, [40, 20], 5, [35, 35, 15, 15]],
  [source.narrow, [40, 20], 2.5, [37.5, 37.5, 17.5, 17.5]],
  [source.offset, [32.5, 18.75], 2.5, [30, 45, 16.25, 18.75]],
  [source.noop, [32.5, 18.75], 2.5, [30, 45, 16.25, 18.75]],
  [cold.reopened, [32.5, 18.75], 2.5, [30, 45, 16.25, 18.75]],
  [cold.reedited, [32.5, 18.75], 5, [27.5, 42.5, 13.75, 16.25]],
]) {
  assert.deepEqual(state.center, center); assert.equal(state.radius, radius); assert.deepEqual(state.clearance, clearance);
  assert.deepEqual([state.genus, state.weightedEuler, state.faces, state.vertices, state.edges, state.loops, state.uses], [1, 0, 7, 10, 15, 9, 30]);
  assert.equal(state.certifiedVolume, 'UNAVAILABLE'); assert.equal(state.nativeIdentityPreserved, true);
}
assert.equal(source.chartRefusal.code, 'NATIVE'); assert.equal(source.chartRefusal.operation, 'hole');
assert.equal(source.chartRefusal.cause.name, 'StoredPlateHoleSolidError'); assert.equal(source.chartRefusal.cause.code, 'GEOMETRY');
assert.equal(source.tangentRefusal.code, 'NATIVE'); assert.equal(source.tangentRefusal.operation, 'hole');
assert.match(source.tangentRefusal.cause.message, /strict represented contained circular hole/);
assert.equal(source.noopWrapperAndNativeIdentity, true); assert.equal(source.futureUseAfterBothRefusals, true);
assert.equal(source.oldAndNewSnapshotsIndependent, true); assert.equal(source.legacy.authoredBytesUnchanged, true);
assert.equal(source.fullTransitiveNativeCoverage, 'NOT_MEASURED');
assert.deepEqual(source.material.classifications.map(result => result.status), ['outside', 'inside', 'boundary', 'outside', 'boundary', 'boundary']);
assert.equal(source.material.report.authority, 'stored-coefficient-conic-product-material');
for (const stage of [source.stages[1], source.stages[3], cold.stages[1]])
  assert.deepEqual(stage.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2] });
assert.deepEqual(source.stages[5].recomputation, { reusedFeatures: [0, 1, 2], evaluatedFeatures: [] });
assert.deepEqual(cold.stages[0].recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2] });

// Pin all 21 prior source/authored downloads to the adopted base, not the changing working tree.
const priorDocs = JSON.parse(git('apps/library-docs/evidence/modeling-suppression-docs.json'));
const preservedDownloads = [...priorDocs.preservedDownloads, {
  path: 'apps/library-docs/docs/public/examples/modeling-suppression.ts', sha256: priorDocs.types.source.downloadSHA256,
}];
assert.equal(preservedDownloads.length, 21); assert.equal(new Set(preservedDownloads.map(({ path }) => path)).size, 21);
for (const { path, sha256 } of preservedDownloads) {
  assert.equal(digest(git(path)), sha256, `${path} at adopted base`);
  assert.equal(digest(readFileSync(resolve(root, path))), sha256, path);
}
const downloadFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? downloadFiles(join(directory, entry.name)) : /\.(?:ts|json|cad\.css)$/.test(entry.name) ? [join(directory, entry.name)] : []);
assert.equal(downloadFiles(resolve(app, 'docs/public/examples')).length, 22);

let entry;
if (mode !== 'static') {
  entry = resolve(provider, `packages/barocss-cad/${mode === 'source' ? 'src/index.ts' : 'dist/index.d.ts'}`);
  if (mode === 'emitted') assert.equal(digest(readFileSync(entry)), receipt.emittedDeclarationHashes['dist/index.d.ts']);
  const directory = mkdtempSync(join(tmpdir(), 'cad-hole-doc-types-'));
  try {
    const files = [file, resolve(app, 'scripts/snippets/modeling-api.ts'), ...[
      'modeling-intersection.ts', 'modeling-split.ts', 'modeling-cardinal-split.ts', 'modeling-chamfer-chain.ts',
      'modeling-chamfer-split.ts', 'modeling-dimensions.ts', 'modeling-miter.ts', 'modeling-suppression.ts',
    ].map(path => resolve(app, 'docs/public/examples', path))];
    assert.equal(files.length, 10);
    const config = join(directory, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2022',
      module: 'NodeNext', moduleResolution: 'NodeNext', skipLibCheck: true, types: [], paths: { '@barocss/cad': [entry] } }, files }));
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], { stdio: 'inherit' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
console.log(JSON.stringify({
  ok: true, scope: 'mounting-plate guide/download; pinned provider/native receipts; unchanged prior downloads; no native execution',
  mode, typedExampleFiles: mode === 'static' ? 0 : 10, typeCheck: mode === 'static' ? 'UNRUN' : 'passed',
  enginePin, acceptedProviderPin, testedProductPin, engineReceiptSHA256: digest(receiptText),
  modelingSourceSHA256: digest(modeling), providerFixtureSHA256: digest(fixture),
  ...(entry ? { entrySHA256: digest(readFileSync(entry)) } : {}),
  downloadSHA256: digest(snippet), guideSHA256: digest(page),
  preservedDownloads, totalDownloadsAfter: 22, nativeCampaignRun: false, browserOrReactRun: false,
  uiBehaviorScope: 'Separate actual controller/scene/recipe tests; no UI-string surrogate',
}, null, 2));
