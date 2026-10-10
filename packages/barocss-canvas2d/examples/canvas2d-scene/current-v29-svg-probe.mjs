import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const requireRoot = createRequire(resolve(root, 'package.json'));
const { build } = requireRoot('esbuild');
const { JSDOM } = requireRoot('jsdom');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index < 0) return fallback;
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), 'Missing value for ' + flag);
  return args[index + 1];
};
const mode = value('--mode', 'source');
assert.ok(mode === 'source' || mode === 'compiled', 'Expected --mode source|compiled');
const output = value('--output', null);
const packageManifest = JSON.parse(await readFile(resolve(root, 'packages/barocss-canvas2d/package.json'), 'utf8'));
function target(map) {
  if (typeof map === 'string') return map;
  return target(map.import ?? map.default);
}
const published = target(packageManifest.publishConfig.exports['.']);
const plugin = { name: 'actual-published-root', setup(builder) {
  builder.onResolve({ filter: /^@barocss\/canvas2d$/ }, () =>
    ({ path: resolve(root, 'packages/barocss-canvas2d', published) }));
} };
const bundle = await build({
  absWorkingDir: root, stdin: {
    contents: "import * as api from '@barocss/canvas2d'; import * as fixture from './current-v29-svg-fixture.mjs'; export {api,fixture};",
    resolveDir: here, sourcefile: 'current-v29-svg-entry.mjs', loader: 'js',
  }, bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  write: false, metafile: true, outfile: resolve(output ?? here, 'memory-svg-probe.cjs'),
  plugins: mode === 'compiled' ? [plugin] : [], logLevel: 'silent',
});
const inputs = Object.keys(bundle.metafile.inputs);
const ownSource = inputs.filter(path => /packages\/barocss[^/]*\/src\//.test(path));
const ownDist = inputs.filter(path => /packages\/barocss[^/]*\/dist\//.test(path));
assert.ok(inputs.some(path => path.endsWith('/current-v29-svg-fixture.mjs')), 'Actual fixture must be bundled');
if (mode === 'source') {
  assert.ok(ownSource.some(path => path.endsWith('/src/svg-export.ts')), 'Actual source exporter required');
  assert.equal(ownDist.length, 0, 'Source flow cannot use own dist');
} else {
  assert.ok(ownDist.some(path => path.endsWith('/dist/index.js')), 'Actual published JS required');
  assert.equal(ownSource.length, 0, 'Compiled flow cannot fall back to own src, including fixture imports');
}
const loaded = new Module(resolve(output ?? here, 'memory-svg-probe.cjs'));
loaded.filename = resolve(output ?? here, 'memory-svg-probe.cjs');
loaded.paths = Module._nodeModulePaths(root);
loaded._compile(bundle.outputFiles[0].text, loaded.filename);
const { api, fixture } = loaded.exports;
const observations = [], refusals = [];
function imported(svg) {
  const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
  try { return api.importSVGElement(dom.window.document.documentElement); }
  finally { dom.window.close(); }
}
function roundTrip(scene, name) {
  const before = structuredClone(scene);
  const exported = api.exportSceneSVG(scene, fixture.LOGICAL_SIZE);
  assert.equal(exported.ok, true, name + ': ' + JSON.stringify(exported.diagnostics));
  assert.deepEqual(scene, before, 'Exporter changed accepted source');
  const accepted = imported(exported.svg);
  assert.equal(accepted.scene.version, 5, 'Do not retag the importer result');
  const receipt = fixture.compareCurrentSVGSemantics(scene, accepted.scene);
  const tree = fixture.createTreeFromImportedSVG(accepted.scene, api);
  const restored = tree.snapshot();
  assert.equal(restored.version, 29, 'Actual public factories create current defaults');
  fixture.compareCurrentSVGSemantics(scene, restored);
  const ids = fixture.normalizeCurrentSVGScene(scene);
  assert.deepEqual(exported.sourceIdMap.map(row => row.sourceId).sort(),
    [ids.contextId, ...ids.groupIds, ...ids.pathIds].sort());
  const serialized = api.stringifySceneJSON(restored);
  const coldTree = api.createDisplayTreeFromScene(api.parseSceneJSON(serialized));
  assert.deepEqual(coldTree.snapshot(), restored, 'Public current-tree file cold reconstruction');
  observations.push({ name, svgBytes: Buffer.byteLength(exported.svg),
    svgSHA256: createHash('sha256').update(exported.svg).digest('hex'),
    importedVersion: 5, restoredPublicTreeVersion: 29, semantic: receipt });
  return { exported, accepted, tree };
}
const actual = fixture.createCurrentSVGFixture(api);
const original = actual.tree.snapshot();
const first = roundTrip(original, 'original');
const retainedOriginal = structuredClone(original);
const edit = fixture.applyCurrentSVGEdit(actual.tree);
assert.notDeepEqual(edit, original, 'Original public path edit must change its paint');
assert.deepEqual(original, retainedOriginal, 'Previously accepted source snapshot retained');
const second = roundTrip(edit, 'edited-original');
assert.notEqual(first.exported.svg, second.exported.svg, 'Edit must change real SVG');
assert.deepEqual(actual.samples.map(row => row.expectedHitId),
  fixture.createCurrentSVGFixture(api).samples.map(row => row.expectedHitId), 'Paint edit keeps hit IDs');
const acceptedBefore = actual.tree.snapshot();
const builderRefusals = fixture.runCurrentSVGBuilderRefusals(api);
for (const candidate of fixture.createSVGRefusalCases(api)) {
  const before = structuredClone(candidate.scene);
  const result = api.exportSceneSVG(candidate.scene, fixture.LOGICAL_SIZE);
  assert.equal(result.ok, false, candidate.name);
  assert.ok(result.diagnostics.length && result.diagnostics.every(row => row.code === candidate.expectedCode),
    candidate.name + ': useful unsupported diagnostics required');
  assert.ok(!Object.hasOwn(result, 'svg'), 'Unsupported source cannot publish partial SVG');
  assert.deepEqual(candidate.scene, before, 'Refusal changed candidate');
  assert.deepEqual(actual.tree.snapshot(), acceptedBefore, 'Refusal changed accepted public tree');
  refusals.push({ name: candidate.name, diagnostics: result.diagnostics });
}
let getterCalls = 0;
const accessor = structuredClone(original);
Object.defineProperty(accessor.nodes[0], 'alpha', { enumerable: true, get() { getterCalls++; return 1; } });
const malformed = [
  ['null-scene', null], ['future-version', { ...original, version: 30 }],
  ['unknown-field', { ...original, unexpected: true }], ['ordinary-getter', accessor],
];
for (const [name, value] of malformed) {
  assert.throws(() => api.exportSceneSVG(value, fixture.LOGICAL_SIZE), error =>
    error instanceof api.Canvas2DError && error.code === 'INVALID_SCENE');
  refusals.push({ name, errorCode: 'INVALID_SCENE' });
}
assert.equal(getterCalls, 0);
assert.throws(() => api.exportSceneSVG(original, { width: NaN, height: 220 }), error =>
  error instanceof api.Canvas2DError && error.code === 'INVALID_SIZE');
refusals.push({ name: 'malformed-size', errorCode: 'INVALID_SIZE' });
const legacy = fixture.createLegacySVGScene();
roundTrip(legacy, 'legacy-authored-Scene5');
const collisionTree = api.createDisplayTree('SvgViewBox1');
collisionTree.stage.addChild(collisionTree.createPath({ id: 'SvgViewport1', layer: 0,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 30, y: 0 },
    { kind: 'L', x: 30, y: 30 }, { kind: 'Z' }],
  fill: { color: [1, 0, 0, 1], rule: 'nonzero' } }));
const collisions = roundTrip(collisionTree.snapshot(), 'real-generated-ID-collisions');
assert.deepEqual(collisions.accepted.diagnostics.generatedIds, ['SvgViewBox2', 'SvgViewport2']);
const result = {
  status: 'passed', mode, node: process.version,
  ownSourceInputs: ownSource.length, ownDistInputs: ownDist.length,
  observations, refusals, builderRefusals, getterCalls, retainedAcceptedSource: true,
  preservedFirstFailure: {
    run: 'Root first source probe, tool7551',
    kind: 'Fixture setup before exporter',
    reason: '3PI rotation was already outside public builder +/-2PI admission',
    repair: 'Separate builder refusal and snapshot retention from admitted Scene SVG controls',
    exporterProductChangedForThisRepair: false,
  },
  mapping: 'Original Scene29 public tree → actual SVG → unchanged importer Scene5 → public factory Scene29 tree; importer input never retagged',
  cpuScope: 'JSDOM real XML DOM and public APIs, normalized geometry/paint/hit eligibility only; no renderer/GL/pixel/hit execution',
  rendererSamples: actual.samples, actualBrowserExecuted: false,
};
if (output) {
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  await writeFile(resolve(output, 'metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  await writeFile(resolve(output, 'original.svg'), first.exported.svg);
  await writeFile(resolve(output, 'edited.svg'), second.exported.svg);
}
console.log(JSON.stringify(result, null, 2));
