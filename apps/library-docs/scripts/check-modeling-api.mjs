// Documentation/static/type checks only. Do not import CAD or execute geometry.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const base = '41a47d94def6e5c625e343824149cffb671ba221';
const enginePin = '4a2d2c5a0d158d0b0a13a3ff85c38d8c57e439b4';
const provider = resolve(process.env.CAD_MODEL_ROOT ?? root);
const mode = process.argv[2] ?? 'source';
assert.ok(['source', 'emitted'].includes(mode), 'Use source or emitted');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const digest = text => createHash('sha256').update(text).digest('hex');
const historical = [
  'docs/packages/cad/exact-prism-modeling.md',
  'docs/packages/cad/serial-part-v2.md',
  'docs/packages/cad/language-workflows.md',
  'evidence/exact-prism-modeling.json',
  'evidence/serial-part-v2-docs.json',
  'docs/public/examples/serial-part-v2.json',
];
for (const path of historical) {
  assert.equal(readFileSync(resolve(app, path), 'utf8'), git(['show', `${base}:apps/library-docs/${path}`]), `Historical content changed: ${path}`);
}
const snippetPath = resolve(app, 'scripts/snippets/modeling-api.ts');
const snippet = readFileSync(snippetPath, 'utf8');
const page = readFileSync(resolve(app, 'docs/packages/cad/modeling.md'), 'utf8');
const quickstart = readFileSync(resolve(app, 'docs/packages/cad/quickstart.md'), 'utf8');
for (const text of [page, quickstart]) {
  for (const [, region] of text.matchAll(/^<<< .*modeling-api\.ts#([^\s]+)$/gm)) {
    assert.ok(snippet.includes(`// #region ${region}\n`) && snippet.includes(`// #endregion ${region}\n`), `Missing snippet region ${region}`);
  }
}
for (const term of ['cad.model()', 'withParameters', 'cad.load', 'CadModelError', '80/3', '65536', '10000', 'exactly', 'not persistent topology naming', 'UNRUN', 'no automatic migration', 'entire authored graph']) {
  assert.ok(page.includes(term), `Missing modeling boundary: ${term}`);
}
for (const forbidden of ['sourceVersion', 'expectedRevision', 'sourceId:', 'solidId:', 'schema:', 'format:', 'prismV2']) {
  assert.ok(!snippet.includes(forbidden), `Primary example exposes internal/legacy authoring: ${forbidden}`);
}
for (const name of ['index', 'quickstart', 'language', 'capabilities', 'guides']) {
  const text = readFileSync(resolve(app, `docs/packages/cad/${name}.md`), 'utf8');
  assert.ok(text.includes('./modeling'), `${name} must lead to current modeling guide`);
}
const nav = readFileSync(resolve(app, 'docs/.vitepress/config.mts'), 'utf8');
for (const label of ["['modeling']", "'modeling': 'Model a part'", "'exact-prism-modeling': 'Archive: exact-prism workflow'", "'serial-part-v2': 'Archive: serial-part v2'", "'language-workflows': 'Archive: Source0–3 programs'"]) assert.ok(nav.includes(label), `Missing navigation: ${label}`);
const engineEvidencePath = 'packages/barocss-cad/test/modeling-evidence/verification.json';
const engineEvidence = JSON.parse(git(['show', `${enginePin}:${engineEvidencePath}`]));
for (const [path, expected] of Object.entries(engineEvidence.productSHA256)) {
  const local = readFileSync(resolve(provider, 'packages/barocss-cad', path));
  assert.equal(digest(local), expected, `Provider source differs from verified receipt: ${path}`);
  assert.equal(digest(git(['show', `${enginePin}:packages/barocss-cad/${path}`])), expected, `Pinned source differs: ${path}`);
}
assert.deepEqual(engineEvidence.publicGeometry, {
  initialPartVolumeMM3: 3064, otherPartVolumeMM3: 2048, batchHeight6RearX20VolumeMM3: 2488,
  coldReeditSetback2VolumeMM3: 2464, sourceMinimalPlateVolumeMM3: 4096,
  userPlateVolumeMM3: 48000, userWiderPlateVolumeMM3: 60000,
});
assert.equal(engineEvidence.campaigns.initialSource.evaluations, 15);
assert.equal(engineEvidence.campaigns.final.evaluations, 6);
for (const [name, expected] of [['source', 1], ['emitted', 1], ['cold', 4]]) {
  assert.equal(engineEvidence.campaigns.final.modes[name].status, 'passed');
  assert.equal(engineEvidence.campaigns.final.modes[name].evaluations, expected);
}
assert.ok(page.includes(enginePin) && page.includes('15 initial-source evaluations') && page.includes('6 final evaluations'));
for (const [, sha, path] of page.matchAll(/https:\/\/github\.com\/barocss\/barocss\/blob\/([0-9a-f]{40})\/([^\s)#]+)/g)) {
  git(['cat-file', '-e', `${sha}:${path}`]);
}
const limitsSource = readFileSync(resolve(provider, 'packages/barocss-cad/src/modeling.ts'), 'utf8');
const expectedLimits = { nodes: 6, sketches: 2, extrusions: 2, cuts: 1, chamfers: 1, parameters: 16, outputs: 8, polygonPoints: 8, fileBytes: 65536, inputDepth: 12, lengthMM: 10000 };
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const ts = require('typescript');
const configSyntax = ts.transpileModule(nav, {compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext},fileName:'config.mts',reportDiagnostics:true});
assert.equal(configSyntax.diagnostics?.length ?? 0, 0, 'VitePress config syntax must parse without executing build hooks');
const tree = ts.createSourceFile('modeling.ts', limitsSource, ts.ScriptTarget.Latest, true);
let limits;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'CadModelLimits') {
    const expression = node.initializer;
    assert.ok(expression && ts.isCallExpression(expression) && expression.expression.getText(tree) === 'Object.freeze');
    const literal = expression.arguments[0];
    assert.ok(ts.isObjectLiteralExpression(literal));
    limits = Object.fromEntries(literal.properties.map(property => {
      assert.ok(ts.isPropertyAssignment(property) && ts.isNumericLiteral(property.initializer));
      return [property.name.getText(tree), Number(property.initializer.text)];
    }));
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.deepEqual(limits, expectedLimits, 'Update docs intentionally if the accepted resource bounds changed');
const entry = resolve(provider, `packages/barocss-cad/${mode === 'source' ? 'src/index.ts' : 'dist/index.d.ts'}`);
assert.ok(existsSync(entry), `Missing ${mode} entry; use an already-built matching CAD_MODEL_ROOT`);
const directory = mkdtempSync(join(tmpdir(), 'barocss-modeling-doc-types-'));
try {
  const config = join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: {
    strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
    skipLibCheck: true, types: [], paths: {'@barocss/cad': [entry]},
  }, files: [snippetPath] }));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], {stdio:'inherit'});
} finally { rmSync(directory, {recursive:true, force:true}); }
console.log(JSON.stringify({scope:'static/source bounds and public snippet typecheck; no CAD execution', mode, base, enginePin, engineReceiptSHA256:digest(git(['show', `${enginePin}:${engineEvidencePath}`])), entrySHA256:digest(readFileSync(entry)), modelingSourceSHA256:digest(limitsSource), snippetSHA256:digest(snippet), historicalFilesPreserved:historical.length, limits, nativeCampaignRun:false}, null, 2));
