// Static documentation/fixture/type verification only; never import or run CAD.
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
const enginePin = '2d2a31977c16c00ab30b9273e13c26b71b49ef26';
const apiPin = 'd71cb7dd79569aaeb12a8915d28293c4b9801c1c';
const basePin = 'd49dd6e494ddfcd44ecf87b9e76b5b924feca76c';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const bytes = readFileSync(resolve(app, 'docs/public/examples/serial-part-v2.json'));
const digest = createHash('sha256').update(bytes).digest('hex');
const evidencePath = 'examples/cad-nurbs/xy-affine-prism-serial-part-verification.json';
const native = JSON.parse(git(['show', `${enginePin}:${evidencePath}`]));
assert.equal(bytes.length, native.artifacts['authored-base.json'].bytes);
assert.equal(digest, native.artifacts['authored-base.json'].sha256);
const document = JSON.parse(bytes.toString('utf8'));
assert.equal(document.version, 2);
assert.deepEqual(document.nodes.map(n => n.kind), ['sketch', 'sketch', 'prism', 'prism', 'subtraction', 'chamfer']);
assert.equal(document.parameters.length, 11);
assert.equal(document.nodes[5].parent.solidId, document.nodes[4].second.solidId);
assert.equal(document.nodes[5].parent.componentRole, 'second');
assert.equal(document.nodes[5].options.retainedSolidId, 'detailed_part');
assert.ok(Object.is(document.nodes[0].document.points[0].position[0], -0));
for (const i of [2, 3]) assert.deepEqual(document.nodes[i].options.chartPolicy, {kind:'coordinate-span',version:1});
assert.ok(!Object.hasOwn(document, 'chamferResolution'));
assert.deepEqual(native.analyticalTargetsNowObserved.map(r => [r.rearX, r.height, r.second, r.retained, r.wedge]), [
  [16, 8, 3072, 3064, 8], [16, 6, 2304, 2296, 8], [20, 8, 3328, 3320, 8], [20, 6, 2496, 2488, 8],
]);
for (const phase of ['source', 'emitted', 'cold', 'legacy']) assert.equal(native.phases[phase].exitCode, 0);
for (const path of ['apps/library-docs/docs/packages/cad/exact-prism-modeling.md', 'apps/library-docs/evidence/exact-prism-modeling.json', 'apps/library-docs/docs/packages/cad/language-workflows.md']) {
  assert.equal(readFileSync(resolve(root, path), 'utf8'), git(['show', `${basePin}:${path}`]), `Historical pin/recipe changed: ${path}`);
}
const pagePath = resolve(app, 'docs/packages/cad/serial-part-v2.md');
const page = readFileSync(pagePath, 'utf8');
for (const term of [enginePin, apiPin, '5945', digest, 'no automatic migration', '262144', '80/3', 'UNRUN', 'not another native run']) assert.ok(page.includes(term), `Missing boundary: ${term}`);
let immutableLinks = 0;
for (const name of ['serial-part-v2', 'capabilities']) {
  const text = readFileSync(resolve(app, `docs/packages/cad/${name}.md`), 'utf8');
  for (const [, sha, path] of text.matchAll(/https:\/\/github\.com\/barocss\/barocss\/blob\/([0-9a-f]{40})\/([^\s)#]+)/g)) {
    git(['cat-file', '-e', `${sha}:${path}`]);
    git(['merge-base', '--is-ancestor', sha, apiPin]); immutableLinks++;
  }
}
const configText = readFileSync(resolve(app, 'docs/.vitepress/config.mts'), 'utf8');
assert.ok(configText.includes("'serial-part-v2': 'Serial cut-part and chamfer v2'"));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const entry = resolve(process.env.CAD_SERIAL_TYPES_ENTRY ?? resolve(root, 'packages/barocss-cad/dist/index.d.ts'));
assert.ok(existsSync(entry), 'Build a matching CAD package first or set CAD_SERIAL_TYPES_ENTRY to its declarations');
const directory = mkdtempSync(join(tmpdir(), 'barocss-serial-part-doc-types-'));
try {
  const fixture = join(directory, 'authored.mts');
  writeFileSync(fixture, `import type { XYAffinePrismFeatureDocumentV2 } from '@barocss/cad';\nexport const authored = ${bytes.toString('utf8').trim()} satisfies XYAffinePrismFeatureDocumentV2;\n`);
  const config = join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: {
    strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
    skipLibCheck: true, allowJs: true, checkJs: true, types: ['node'],
    typeRoots: [dirname(dirname(require.resolve('@types/node/package.json')))],
    paths: {'@barocss/cad': [entry]},
  }, files: [fixture, resolve(app, 'scripts/snippets/serial-part-v2.ts'), resolve(app, 'scripts/snippets/serial-part-v2-cold.mjs')] }));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], {stdio:'inherit'});
} finally { rmSync(directory, {recursive:true, force:true}); }
console.log(JSON.stringify({scope:'docs fixture/static/type checks only; no CAD execution', enginePin, apiPin, fixtureBytes:bytes.length, fixtureSHA256:digest, immutableLinks, fullFixtureTyped:true, apiAndColdSnippetsTyped:true, historicalPinsPreserved:true, nativeCampaignRun:false},null,2));
