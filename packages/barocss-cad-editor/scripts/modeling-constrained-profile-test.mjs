// #1865: exact callback/UI controls and actual serializer/receiver/CPU scene.
// Only provider and Worker execution are mocked. Every edited-state body/mesh
// is explicitly the unchanged genuine #1835 baseline, never new native evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1865-constrained-profile');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const esbuild = require('esbuild'), hash = value => createHash('sha256').update(value).digest('hex');
const source = name => resolve(root, `packages/barocss-cad-editor/src/${name}.ts`);
const download = resolve(root, 'apps/library-docs/docs/public/examples/modeling-constrained-profile.ts');
const fixture = resolve(root, 'packages/barocss-cad/test/modeling-constraints-fixture.mjs');
const transferPath = 'packages/barocss-cad/test/modeling-constraints-evidence/baseline-transfer.json';
const transferBytes = readFileSync(resolve(root, transferPath));
const transferSHA256 = '194b855ed3e862e76c2468cbbcb0d2f21f7b2eda0a217325fa95a32fee226721';
assert.equal(transferBytes.length, 292980); assert.equal(hash(transferBytes), transferSHA256);
const baseline = JSON.parse(transferBytes), authored = JSON.parse(baseline.text);
const retainedHash = hash(JSON.stringify(baseline.preview));
assert.deepEqual(baseline.parameters, { height: 24, lockY: 0, width: 32 });
assert.equal(baseline.summary.volumeMM3, 6144);
assert.deepEqual(baseline.summary.boundsMM, { min: [0, 0, 0], max: [32, 24, 8] });
assert.deepEqual([baseline.preview.report.vertexCount, baseline.preview.report.triangleCount, baseline.preview.report.faceCount], [24, 12, 6]);

// Canonical signed-zero codec substitute belongs to the mocked provider only.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
const signedJSON = value => JSON.stringify(canonical(value), (_key, v) => Object.is(v, -0) ? '__NEG_ZERO__' : v)
  .replaceAll('"__NEG_ZERO__"', '-0') + '\n';
assert.equal(signedJSON(authored), baseline.text);
const edits = [], loads = [], traces = [];
function snapshot(data, trace) {
  const value = {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features),
    bodies: structuredClone(baseline.bodies), trace,
    save: () => signedJSON(data),
    withParameters(changes) {
      edits.push({ snapshot: value, changes: structuredClone(changes) });
      const parameters = { ...data.parameters, ...changes };
      if (parameters.lockY !== 0) throw Error('Mocked recorded lockY=1 CONFLICT refusal');
      return snapshot({ ...data, parameters });
    },
    withSuppression() { throw Error('No finishing channel in this fixture.'); },
  };
  return value;
}
// Public opaque points are checked by identity before recording indices. Both
// constraint order and returned point order must match the provider recipe.
function modelMock() {
  const parameters = {}, nodes = [], trace = [{ kind: 'model' }]; traces.push(trace);
  const record = (kind, data = {}) => trace.push({ kind, ...structuredClone(data) });
  const ownedShapes = new WeakMap();
  return {
    parameter(name, value) { record('parameter', { name, value }); parameters[name] = value; return { parameter: name }; },
    sketch: { constrainedPolygon(callback) {
      record('constrainedPolygon');
      const points = [], constraints = [], owned = new WeakMap();
      const index = point => { assert.ok(owned.has(point), 'constraint/return points must be callback-owned'); return owned.get(point); };
      const s = {
        point(position) { const point = {}; owned.set(point, points.length); record('point', { index: points.length, position }); points.push(structuredClone(position)); return point; },
        fixed(point) { const value = { kind: 'fixed', point: index(point) }; constraints.push(value); record('fixed', { point: value.point }); },
        horizontal(a, b) { const pair = [index(a), index(b)]; constraints.push({ kind: 'horizontal', points: pair }); record('horizontal', { points: pair }); },
        vertical(a, b) { const pair = [index(a), index(b)]; constraints.push({ kind: 'vertical', points: pair }); record('vertical', { points: pair }); },
      };
      const order = callback(s).map(index); record('returnPoints', { points: order });
      assert.deepEqual(order, points.map((_, i) => i));
      const sketch = nodes.push({ kind: 'sketch', profile: 'constrained-polygon', points, constraints }) - 1;
      return { extrude(height, options) {
        record('extrude', { sketch, height, ...(options === undefined ? {} : { options }) });
        const shape = {}, node = nodes.push({ kind: 'extrude', sketch, height, ...(options ?? {}) }) - 1;
        ownedShapes.set(shape, { node, side: 'solid' }); return shape;
      } };
    } },
    build(outputs) {
      const references = Object.fromEntries(Object.entries(outputs).map(([name, shape]) => {
        assert.ok(ownedShapes.has(shape), 'build requires this model’s shape'); return [name, ownedShapes.get(shape)];
      }));
      record('build', { outputs: references });
      return snapshot(canonical({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters, nodes, outputs: references }), trace);
    },
  };
}
let convexReplays = 0;
const forbidden = () => { throw Error('No native or legacy execution is permitted.'); };
globalThis.__constrainedPlateCad = {
  cad: { model: modelMock, load(text) { const value = snapshot(JSON.parse(text)); loads.push(value); return value; } },
  tessellateConvexPlanarSolid(solid, options) {
    assert.deepEqual(solid, baseline.bodies.part.native); assert.deepEqual(options, { maximumFanTriangles: 40 });
    convexReplays++; return structuredClone(baseline.preview);
  },
  tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden,
};
const engineBundle = await esbuild.build({
  stdin: { contents: `export * from ${JSON.stringify(source('modeling-engine'))};\nexport { makeConstrainedPlate } from ${JSON.stringify(download)};\nexport { constrainedPlate } from ${JSON.stringify(fixture)};`, resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
  plugins: [{ name: 'retained-constrained-provider', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'mock' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'cad'
      ? 'export const { cad, tessellateConvexPlanarSolid, tessellateSurface, tessellateOwnPlateCircularHole, tessellateXYCirclePrismShell } = globalThis.__constrainedPlateCad;'
      : 'export function createPrismFeatureEngine() { return () => { throw Error("No legacy execution"); }; }' }));
  } }],
});
const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(name => `export * from ${JSON.stringify(resolve(root, `packages/barocss-gpu/src/${name}.ts`))};`).join('\n'));
const receiverBundle = await esbuild.build({
  stdin: { contents: ['modeling-controller', 'modeling-scene'].map(name => `export * from ${JSON.stringify(source(name))};`).join('\n')
    + `\nexport { raycastEngineScene } from ${JSON.stringify(gpu)};`, resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, alias: { '@barocss/gpu': gpu },
  plugins: [{ name: 'no-native-receiver', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, forbidden);
  } }],
});
for (const [name, bundle] of [['engine', engineBundle], ['receiver', receiverBundle]]) {
  assert.ok(!Object.keys(bundle.metafile.inputs).some(path => /(?:wasm|barocss-cad\/src\/)/.test(path)), 'No native CAD implementation dependency');
  writeFileSync(resolve(output, `${name}.mjs`), bundle.outputFiles[0].text);
}
const engine = await import(pathToFileURL(resolve(output, 'engine.mjs')));
const api = await import(pathToFileURL(resolve(output, 'receiver.mjs')));
const cases = [];
const editorRecipe = engine.createCadEditorConstrainedPlateModel();
const providerRecipe = engine.constrainedPlate(globalThis.__constrainedPlateCad.cad).build();
const downloadRecipe = engine.makeConstrainedPlate();
assert.deepEqual(editorRecipe.trace, providerRecipe.trace); assert.deepEqual(downloadRecipe.trace, providerRecipe.trace);
assert.equal(editorRecipe.save(), baseline.text); assert.equal(downloadRecipe.save(), baseline.text);
assert.ok(Object.is(editorRecipe.trace.find(call => call.kind === 'point').position[0], -0));
assert.deepEqual(editorRecipe.trace.filter(call => ['fixed', 'horizontal', 'vertical'].includes(call.kind)), authored.nodes[0].constraints);
assert.deepEqual(editorRecipe.trace.find(call => call.kind === 'returnPoints').points, [0, 1, 2, 3]);
assert.deepEqual(editorRecipe.trace.find(call => call.kind === 'extrude'), { kind: 'extrude', sketch: 0, height: 8 });
cases.push('owned-public-callback-trace');

// Execute the actual initializer, actual Named dimensions JSX branch and label
// expression. h is a tiny CPU element recorder, not React/browser acceptance.
const uiPath = resolve(root, 'packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const ui = readFileSync(uiPath, 'utf8');
const initializer = ui.match(/ {2}const constrainedPlateDrivers = ([\s\S]*?);\n {2}const holeModel/);
assert.ok(initializer, 'Actual constrained preset initializer must be present');
const classify = new Function('accepted', 'authored', `return ${initializer[1]}`);
const labelExpression = ui.match(/<Label htmlFor=\{`\$\{id\}-\$\{name\}`\}>\{([^\n]+)\} \(mm\)<\/Label>/);
assert.ok(labelExpression, 'Actual dimension label expression must be present');
const flags = ['topPocketDrivers', 'slotDrivers', 'roundPostDrivers', 'pocketDrivers', 'unionDrivers', 'chamferChain', 'configurableFinishes', 'chamferSplit', 'derivedSplit', 'miterSplit'];
const label = new Function('constrainedPlateDrivers', 'name', ...flags, `return ${labelExpression[1]}`);
const dimensionJSX = ui.match(/<div><h2>Named dimensions<\/h2>[\s\S]*?<\/div>\n\s*<aside>/);
assert.ok(dimensionJSX, 'Actual dimension rendering branch must be present');
const renderCode = esbuild.transformSync(`const render = (h, Fragment, accepted, dimensionInput, constrainedPlateDrivers, roundPostDrivers) => (${dimensionJSX[0].replace(/\n\s*<aside>$/, '')});`,
  { loader: 'tsx', jsxFactory: 'h', jsxFragment: 'Fragment' }).code;
const render = new Function(`${renderCode}\nreturn render;`)();
const uiControls = [];
function uiControl(name, data, summary, expected) {
  const matched = classify(summary, data); assert.equal(matched, expected, name);
  const rendered = [];
  render((...element) => element, 'fragment', summary, ([key]) => {
    rendered.push({ name: key, label: label(matched, key, ...flags.map(() => false)) }); return key;
  }, matched, false);
  assert.deepEqual(rendered.map(field => field.name), expected ? ['width', 'height'] : Object.keys(summary.parameters), name);
  if (expected) assert.deepEqual(rendered.map(field => field.label), ['Profile X width', 'Profile Y height'], name);
  else assert.ok(rendered.every(field => field.label === field.name), name);
  uiControls.push(name);
}
const accepted = { source: 'model', parameters: baseline.parameters };
uiControl('exact baseline', authored, accepted, true);
const resized = structuredClone(authored); resized.parameters.width = 40; resized.parameters.height = 16;
uiControl('edited width and height', resized, { ...accepted, parameters: resized.parameters }, true);
uiControl('legacy source', authored, { ...accepted, source: 'legacy' }, false);
for (const [name, mutate] of [
  ['renamed driver', d => { d.parameters.span = d.parameters.width; delete d.parameters.width; }],
  ['extra driver', d => { d.parameters.extra = 1; }], ['omitted driver', d => { delete d.parameters.height; }],
  ['changed point', d => { d.nodes[0].points[3][0] = 2; }],
  ['positive-zero seed', d => { d.nodes[0].points[0][0] = 0; }],
  ['changed constraint', d => { d.nodes[0].constraints[0].point = 1; }],
  ['reordered constraints', d => { d.nodes[0].constraints.reverse(); }],
  ['omitted constraint', d => { d.nodes[0].constraints.pop(); }],
  ['extra constraint', d => { d.nodes[0].constraints.push({ kind: 'fixed', point: 3 }); }],
  ['offset extrusion', d => { d.nodes[1].from = 0; }], ['changed thickness', d => { d.nodes[1].height = 9; }],
  ['wrong output', d => { d.outputs.part.node = 0; }], ['extra output', d => { d.outputs.extra = d.outputs.part; }],
  ['nonzero internal lock', d => { d.parameters.lockY = 1; }],
]) {
  const data = structuredClone(authored); mutate(data);
  uiControl(name, data, { ...accepted, parameters: data.parameters }, false);
}
cases.push('actual-ui-preset-controls');

const workers = [], sessions = [], receiverRefusals = [];
let replies = 0, commitFailure = false, commits = 0, disposals = 0;
const previousWorker = globalThis.Worker;
globalThis.Worker = class {
  callbacks = new Map(); requests = []; answered = new Set(); engine = engine.createModelingEngine(); terminated = false;
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks.set(kind, callback); }
  postMessage(command) { this.requests.push(structuredClone(command)); }
  terminate() { this.terminated = true; }
  accept(mutate, command = this.requests.at(-1)) {
    assert.ok(command && !this.answered.has(command.id)); assert.ok(++replies <= 30, 'Frozen reply ceiling');
    this.answered.add(command.id);
    const reply = this.engine(command); if (mutate) mutate(reply);
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
};
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
async function pump(promise, mutate) {
  let done = false;
  promise.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 20 && !done; i++) {
    const worker = workers.at(-1), command = worker?.requests.at(-1);
    if (command && !worker.answered.has(command.id)) worker.accept(command.kind === 'apply' ? mutate : undefined);
    await tick();
  }
  assert.ok(done, 'Bounded worker pump must settle'); await promise;
}
const stable = session => { const value = session.getSnapshot(); delete value.busy; delete value.error; return value; };
const parameters = session => session.getSnapshot().accepted.parameters;
function retained(session, before, pattern) {
  assert.deepEqual(stable(session), before, 'Refusal retains authored/accepted/display/drafts/history/selection/generation');
  assert.match(session.getSnapshot().error, pattern);
}
try {
  assert.ok(sessions.length < 3, 'Frozen session ceiling');
  const current = api.createCadEditorModelingController({ async prepare() { return {
    commit() { if (commitFailure) throw Error('Mock display commit refusal'); commits++; },
    dispose() { disposals++; },
  }; } }); sessions.push(current);
  await pump(current.example('constrained-plate'));
  const first = current.getSnapshot(); assert.equal(first.error, null); assert.equal(first.authoredText, baseline.text);
  assert.deepEqual(first.accepted.parameters, baseline.parameters);
  assert.deepEqual(first.accepted.outputs, [{ name: 'part', solidId: baseline.preview.report.solidId, volumeMM3: { numerator: '6144', denominator: '1' } }]);
  assert.equal(first.display.packet.profile, 'model-outputs'); assert.equal(first.display.packet.components.length, 1);
  const component = first.display.packet.components[0];
  for (const key of ['mesh', 'boundaries', 'internalDiagonals', 'report']) assert.deepEqual(component[key], baseline.preview[key]);
  const geometry = first.display.scene.geometries[0];
  assert.equal(geometry.positions.length, 24 * 3); assert.equal(geometry.indices.length, 12 * 3);
  for (let i = 0; i < 24; i++) assert.deepEqual(geometry.positions.slice(i * 3, i * 3 + 3),
    [component.mesh.positionsMM[i * 3], component.mesh.positionsMM[i * 3 + 2], -component.mesh.positionsMM[i * 3 + 1]]);
  const bounds = { min: [0, 1, 2].map(axis => Math.min(...geometry.positions.filter((_, i) => i % 3 === axis))),
    max: [0, 1, 2].map(axis => Math.max(...geometry.positions.filter((_, i) => i % 3 === axis))) };
  assert.deepEqual(bounds, { min: [0, 0, -24], max: [32, 8, -0] });
  let sixVolume = 0;
  for (let i = 0; i < geometry.indices.length; i += 3) {
    const [a, b, c] = geometry.indices.slice(i, i + 3).map(index => geometry.positions.slice(index * 3, index * 3 + 3));
    sixVolume += a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  assert.equal(sixVolume / 6, 6144, 'CPU triangle oriented-volume oracle');
  const ray = (y, dy) => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up',
    positionUnit: 'scene', origin: [16, y, -12], direction: [0, dy, 0], near: 0, far: 200 });
  const top = api.raycastEngineScene(first.display.scene, ray(100, -1)), bottom = api.raycastEngineScene(first.display.scene, ray(-10, 1));
  assert.equal(top.point[1], 8); assert.deepEqual(top.normal, [0, 1, 0]);
  assert.equal(bottom.point[1], 0); assert.deepEqual(bottom.normal, [0, -1, 0]);
  const picked = api.pickModelingScene(first.display, 100, 100, 50, 50);
  assert.equal(picked.role, 'part'); assert.equal(picked.solidId, component.report.solidId); assert.equal(picked.approximate, true);
  cases.push('genuine-baseline-cpu-bounds-volume-pick');

  for (const [name, value] of [['width', 40], ['height', 16]]) {
    const prior = stable(current), oldParameters = parameters(current), count = replies;
    current.stage(name, String(value)); assert.equal(replies, count); assert.deepEqual(current.getSnapshot().accepted, prior.accepted);
    await pump(current.apply()); assert.equal(current.getSnapshot().error, null);
    assert.deepEqual(parameters(current), { ...oldParameters, [name]: value });
    assert.deepEqual(edits.at(-1).changes, { [name]: value });
    assert.equal(current.getSnapshot().accepted.revision, prior.accepted.revision + 1);
    assert.deepEqual(current.getSnapshot().display.packet.components[0].mesh, component.mesh, 'Edited geometry is the baseline mock');
    assert.equal(current.getSnapshot().accepted.outputs[0].volumeMM3.numerator, '6144', 'Edited volume is a baseline mock, not new native evidence');
    cases.push(`${name}-draft-apply`);
  }
  const edited = current.getSnapshot();
  await pump(current.undo()); assert.deepEqual(parameters(current), { height: 24, lockY: 0, width: 40 });
  await pump(current.redo()); assert.deepEqual(parameters(current), edited.accepted.parameters);
  assert.deepEqual(current.getSnapshot().history, edited.history); cases.push('undo-redo');

  current.stage('lockY', '1'); const beforeRefusal = stable(current); await pump(current.apply());
  retained(current, beforeRefusal, /lockY=1 CONFLICT/); const refusedSnapshot = edits.at(-1).snapshot;
  current.discard(); current.stage('height', '20'); await pump(current.apply());
  assert.equal(current.getSnapshot().error, null); assert.equal(edits.at(-1).snapshot, refusedSnapshot);
  assert.deepEqual(parameters(current), { height: 20, lockY: 0, width: 40 }); cases.push('mock-conflict-same-snapshot-recovery');

  current.stage('width', '36'); const beforeCommit = stable(current), beforeCommits = commits;
  commitFailure = true; await pump(current.apply()); commitFailure = false;
  retained(current, beforeCommit, /display commit refusal/); assert.equal(commits, beforeCommits);
  assert.ok(disposals > 0); cases.push('display-commit-refusal');

  // The refused display stopped its Worker. Reconstruct before canceling the
  // next apply, then deliver that exact late reply from the terminated Worker.
  const beforeCancel = stable(current), canceled = current.apply();
  const oldWorker = workers.at(-1); assert.equal(oldWorker.requests.at(-1).kind, 'open');
  oldWorker.accept(); await tick(); const late = oldWorker.requests.at(-1); assert.equal(late.kind, 'apply');
  current.cancel(); oldWorker.accept(undefined, late); await canceled;
  assert.ok(oldWorker.terminated); assert.deepEqual(stable(current), beforeCancel);
  const loadCount = loads.length; await pump(current.apply());
  assert.equal(current.getSnapshot().error, null); assert.equal(loads.length, loadCount + 1);
  assert.deepEqual(workers.at(-1).requests.map(command => command.kind), ['open', 'apply']);
  assert.deepEqual(parameters(current), { height: 20, lockY: 0, width: 36 }); cases.push('cancel-late-reply-cold-recovery');

  const beforeAxis = stable(current), beforeAxisReplies = replies, beforeAxisTraces = traces.length;
  await assert.rejects(current.example('constrained-plate', 'x'), /available split axis/);
  assert.deepEqual(stable(current), beforeAxis); assert.equal(replies, beforeAxisReplies);
  const axisReply = workers.at(-1).engine({ id: 1000, kind: 'example', example: 'constrained-plate', splitAxis: 'x' });
  assert.equal(axisReply.ok, false); assert.match(axisReply.message, /available split axis/);
  assert.equal(traces.length, beforeAxisTraces); cases.push('invalid-split-axis-before-provider');

  for (const [name, mutate, pattern] of [
    ['malformed-mesh', reply => { reply.display.components[0].mesh.indices[0] = 99; }, /index outside mesh/],
    ['source-correspondence', reply => { reply.display.components[0].mesh.faces[0].sourceId = 'forged_source'; }, /face|source|lineage/],
    ['revision-correspondence', reply => { reply.display.revision++; }, /display differs from native summary/],
  ]) {
    current.stage('width', '38'); const before = stable(current);
    await pump(current.apply(), reply => { assert.equal(reply.ok, true); mutate(reply); });
    retained(current, before, pattern); receiverRefusals.push({ case: name, error: current.getSnapshot().error }); cases.push(name);
  }
  assert.equal(cases.length, 13); assert.equal(new Set(cases).size, 13);
  assert.ok(sessions.length <= 3 && replies <= 30);
  assert.equal(hash(JSON.stringify(baseline.preview)), retainedHash);
  assert.equal(hash(readFileSync(resolve(root, transferPath))), transferSHA256);
  const result = {
    ok: true, cases, uiControls, authoringCalls: editorRecipe.trace.length, controllerSessions: sessions.length, workerReplies: replies,
    convexBaselineReplays: convexReplays, nativeCalls: 0, transferPath, transferBytes: transferBytes.length, transferSHA256,
    baseline: { vertices: 24, triangles: 12, faces: 6, volumeMM3: 6144, authoredBoundsMM: baseline.summary.boundsMM, sceneBounds: bounds, axisConversions: 1 },
    receiverRefusals,
    sourceSHA256: Object.fromEntries([source('modeling-engine'), source('modeling-controller'), source('modeling-scene'), uiPath, download, fixture]
      .map(path => [path.slice(root.length + 1), hash(readFileSync(path))])),
    harnessSHA256: hash(readFileSync(new URL(import.meta.url))),
    scope: 'Actual worker serializer, receiving controller/CPU scene and extracted UI initializer/field JSX; mocked provider/Worker; unchanged genuine baseline preview',
    limitations: ['Every edited-state body, mesh and volume is baseline replay, not newly measured native geometry',
      'No native construction, tessellation, React/browser/GPU, physical Save/Open or visual acceptance'],
  };
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally {
  for (const session of sessions) session.dispose();
  globalThis.Worker = previousWorker; delete globalThis.__constrainedPlateCad;
}
