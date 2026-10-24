// Current-source consumer contracts: small data packets plus two actual Model frame-geometry cases; no worker/browser.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-clearance-analysis.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temporary = await mkdtemp(join(tmpdir(), 'cad-clearance-analysis-'));
let api;
try {
  const outfile = join(temporary, 'analysis.mjs');
  await build({ stdin: { contents: 'export * from "./apps/cad-studio/src/viewport/clearanceAnalysis.ts"; export * from "./apps/cad-studio/src/viewport/instanceEvaluation.ts"; export {clearancePairLabel} from "./apps/cad-studio/src/viewport/ClearancePanel.tsx"; export {CLEARANCE_MAP_VERSION} from "./packages/barocss-cad-model/src/team/clearanceMap.ts"; export {emptyDoc,rectanglePart,withNode,placedDoc} from "./packages/barocss-cad-model/src/engine/doc.ts"; export {placementOf} from "./packages/barocss-cad-model/src/engine/placement.ts"; export {evaluatePart,evaluatePlaced} from "./packages/barocss-cad-model/src/engine/evaluate.ts"; export {evaluationKey} from "./packages/barocss-cad-model/src/engine/evalMemo.ts";', resolveDir: root }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', alias: { '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') } });
  api = await import(pathToFileURL(outfile).href);
} finally { await rm(temporary, { recursive: true, force: true }); }

const snapshot = value => JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? [...v] : v);
const pose = (t = [0, 0, 0]) => ({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [...t] });
const move = (x, y, z) => Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const nativeMesh = () => ({ positions: new Float32Array([0, 0, 0, 9, 0, 0, 0, 9, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), faceOfVertex: new Float32Array([37, 37, 37]), faces: [{ index: 37, id: 'native-37' }], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), edges: [], bounds: { min: [0, 0, 0], max: [9, 9, 0] } });
const body = (key, placement = pose()) => ({ key, mesh: nativeMesh(), brep: null, pose: placement });
const band = () => ({ positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), field: new Float32Array([0, 0.25, 1, 2]) });
const pair = (changes = {}) => ({ a: 'arm/body', b: 'base/body', state: 'contact', minGap: 0, closest: { a: [0, 0, 0], b: [0, 0, 0], faceA: 'native-37', faceB: 'native-37' }, pose: 'a-pose.b-pose', overlap: { pending: true }, ...changes });
const map = (pairs = [pair()]) => ({ version: api.CLEARANCE_MAP_VERSION, revision: 'current-revision', near: { value: 1, source: 'input' }, pairs, pending: pairs.filter(p => p.overlap && 'pending' in p.overlap).length, timing: { pruneTime: 0, clearanceTime: 0, bandTime: 0 } });
const fill = (changes = {}) => ({ a: 'arm/body', b: 'base/body', revision: 'current-revision', pose: 'a-pose.b-pose', overlap: { volume: 2, mesh: nativeMesh() }, ...changes });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} expected ${expected}`);

test('G22 source prep uses the actual parent-row context and child override without modifying authored parts', () => {
  const child = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} };
  const row = { id: 'shared', kind: 'block', size: [100, 80, 20], source: 'parent shop' };
  const instance = { id: 'part', name: 'Part', doc: child, position: [10, 0, 0], rotation: [0, 0, 0] };
  const parent = { ...child, machining: { version: 1, stock: [row] }, instances: [instance] }, before = snapshot(parent);
  assert.deepEqual(api.clearanceSourceDocument(parent).instances[0].doc.machining.stock, [row]);
  const own = { ...row, size: [120, 90, 30], source: 'part override' }, overridden = { ...parent, instances: [{ ...instance, doc: { ...child, machining: { version: 1, stock: [own] } } }] };
  assert.deepEqual(api.clearanceSourceDocument(overridden).instances[0].doc.machining.stock, [own]);
  const changed = { ...parent, machining: { version: 1, stock: [{ ...row, size: [140, 80, 20] }] } };
  assert.deepEqual(api.clearanceSourceDocument(changed).instances[0].doc.machining.stock[0].size, [140, 80, 20]);
  assert.equal(snapshot(parent), before); assert.equal(child.machining, undefined);
});

test('visible clearance bodies are matched by their exact key, root and placed copies alike (O10)', () => {
  const bodies = ['b1', 'b2', 'b1/child', 'arm/b1', 'arm/b2', 'armature/b1', 'arm/hand/b9', 'hidden/b1', 'base/body', 'base/body-extra'].map(key => body(key));
  const before = snapshot(bodies), keys = ['b1', 'base/body', 'arm/b1', 'arm/hand/b9'];
  const visible = api.visibleClearanceBodies(bodies, keys);
  assert.deepEqual(visible.map(b => b.key), ['b1', 'arm/b1', 'arm/hand/b9', 'base/body']);
  assert.ok(!visible.includes(bodies[4]) && !visible.includes(bodies[5]), 'a key is never matched by its owner prefix: arm/b2 and armature/b1 stay out');
  assert.ok(visible.every(b => bodies.includes(b)), 'filtering preserves original body identity and local geometry');
  assert.deepEqual(api.visibleClearanceBodies(bodies, ['arm']).map(b => b.key), []);
  assert.deepEqual(api.visibleClearanceBodies(bodies, ['b2']).map(b => b.key), ['b2']);
  assert.deepEqual(api.visibleClearanceBodies(bodies, []), []);
  assert.equal(snapshot(bodies), before); assert.deepEqual(keys, ['b1', 'base/body', 'arm/b1', 'arm/hand/b9']);
});

test('hidden invalid parent-row parts are omitted before origin preparation', () => {
  const bad = api.withNode(api.emptyDoc(), { kind: 'frame-member', section: { kind: 'library', id: 'missing' }, start: [0, 0, 0], end: [100, 0, 0] });
  const root = { ...api.emptyDoc(), instances: [
    { id: 'visible', name: 'Visible', doc: api.rectanglePart(2, 3, 4), position: [0, 0, 0], rotation: [0, 0, 0] },
    { id: 'hidden', name: 'Hidden', doc: bad, hidden: true, position: [0, 0, 0], rotation: [0, 0, 0] },
  ] }, before = snapshot(root);
  assert.deepEqual(api.clearanceSourceDocument(root).instances.map(i => i.id), ['visible']);
  assert.equal(snapshot(root), before);
});

test('source document folds a nested child once at the outer origin without flattening or duplicating the empty root', () => {
  const leaf = api.rectanglePart(2, 3, 4), child = { id: 'nested/box', name: 'Nested box', doc: leaf, position: [3, 4, 5], rotation: [0, 0, 90] };
  const subassembly = { ...api.emptyDoc(), instances: [child, { ...child, id: 'hidden-child', hidden: true, position: [999, 999, 999] }] };
  const outer = { id: 'assembly', name: 'Subassembly', doc: subassembly, position: [100, 20, 30], rotation: [90, 0, 0], part: { id: 'part-ref', rev: 'rev-2', source: 'nested.json' } };
  const root = { ...api.emptyDoc(), instances: [outer] }, before = snapshot(root), result = api.clearanceSourceDocument(root);
  assert.notEqual(result, root); assert.equal(result.nodes, root.nodes); assert.equal(result.outputs, root.outputs);
  assert.equal(result.nodes.length, 0); assert.deepEqual(result.outputs, {}); assert.equal(result.instances.length, 1);
  const placed = result.instances[0], origin = placed.doc;
  assert.notEqual(placed, outer); assert.equal(placed.id, outer.id); assert.equal(placed.part, outer.part);
  assert.deepEqual(placed.position, [100, 20, 30]); assert.deepEqual(placed.rotation, [90, 0, 0]);
  assert.equal(origin.instances, undefined); assert.ok(origin.nodes.length > 0); assert.equal(Object.keys(origin.outputs).length, 1);
  assert.equal(origin.nodes.filter(n => n.kind === 'sketch').length, 1); assert.equal(origin.nodes.filter(n => n.kind === 'extrude').length, 1);
  assert.deepEqual(origin.nodes.filter(n => n.kind === 'translate').map(n => n.offset), [[3, 4, 5]], 'only the nested placement is folded into origin geometry');
  assert.deepEqual(origin.nodes.filter(n => n.kind === 'rotate').map(n => [n.axis, n.angle]), [['z', 90]]);
  const [output] = Object.values(origin.outputs); assert.equal(output.node, origin.nodes.length - 1); assert.equal(origin.nodes[output.node].kind, 'translate');
  assert.equal(new Set(origin.nodes.map(n => n.id)).size, origin.nodes.length);
  const again = api.clearanceSourceDocument(result); assert.equal(again.nodes.length, 0); assert.equal(again.instances[0].doc.nodes.length, origin.nodes.length); assert.deepEqual(again.instances[0].doc.outputs, origin.outputs);
  assert.equal(snapshot(root), before); assert.equal(root.instances[0].doc.instances.length, 2);
});

const sectionRow = width => ({ id: 'R', source: 'User test drawing', section: { kind: 'rect-tube', width, height: 40, wall: 3, outerRadius: 0 } });
const frameInstance = ownWidth => {
  const child = api.withNode(api.emptyDoc(), { kind: 'frame-member', section: { kind: 'library', id: 'R' }, start: [0, 0, 0], end: [100, 0, 0] });
  return { id: 'tube', name: 'Tube', doc: ownWidth === undefined ? child : { ...child, frames: { version: 1, sections: [sectionRow(ownWidth)] } }, position: [125, -30, 7], rotation: [0, 0, 90] };
};
const sectionParent = (inst, width) => ({ ...api.emptyDoc(), frames: { version: 1, sections: [sectionRow(width)] }, instances: [inst] });
const extents = bounds => bounds.max.map((n, i) => n - bounds.min[i]).sort((a, b) => a - b);
function evaluatedInstance(parent, inst, revision) {
  const source = api.instanceEvaluationSources(parent).get(inst.id); assert.equal(source?.ok, true, source?.error);
  const placed = api.evaluatePlaced(api.placedDoc(inst, parent), source.base, api.placementOf(inst), revision);
  assert.equal(placed.ok, true, JSON.stringify(placed.error)); assert.equal(placed.bodies.length, 1);
  const local = api.evaluatePart(source.base, revision), prep = api.clearanceSourceDocument(parent), clearanceLocal = api.evaluatePart(prep.instances[0].doc, revision + 100);
  assert.equal(local.ok, true, JSON.stringify(local.error)); assert.equal(clearanceLocal.ok, true, JSON.stringify(clearanceLocal.error));
  assert.equal(local.bodies.length, 1); assert.equal(clearanceLocal.bodies.length, 1);
  assert.equal(api.evaluationKey(prep.instances[0].doc), source.key, 'display and G22 preparation consume the same effective parent-row context');
  assert.deepEqual(clearanceLocal.bodies[0].mesh.positions, local.bodies[0].mesh.positions); assert.deepEqual(clearanceLocal.bodies[0].mesh.indices, local.bodies[0].mesh.indices);
  const expected = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }, place = api.placementOf(inst), P = local.bodies[0].mesh.positions;
  for (let v = 0; v < P.length; v += 3) for (let row = 0; row < 3; row++) {
    const n = place.m[row * 3] * P[v] + place.m[row * 3 + 1] * P[v + 1] + place.m[row * 3 + 2] * P[v + 2] + place.t[row];
    expected.min[row] = Math.min(expected.min[row], n); expected.max[row] = Math.max(expected.max[row], n);
  }
  for (let k = 0; k < 3; k++) { near(placed.bodies[0].mesh.bounds.min[k], expected.min[k]); near(placed.bodies[0].mesh.bounds.max[k], expected.max[k]); }
  return { source, placed, local };
}

test('inherited frame width 40→50 invalidates unchanged-instance readiness until the effective source is evaluated again', () => {
  const inst = frameInstance(), firstParent = sectionParent(inst, 40), nextParent = sectionParent(inst, 50), before = snapshot({ inst, firstParent, nextParent });
  assert.equal(firstParent.instances[0], nextParent.instances[0]);
  const first = evaluatedInstance(firstParent, inst, 200), oldCache = { inst, sourceKey: first.source.key, bodies: first.placed.bodies };
  assert.equal(api.instanceEvaluationCurrent(oldCache, inst, first.source), true);
  const nextSource = api.instanceEvaluationSources(nextParent).get(inst.id); assert.equal(nextSource.ok, true); assert.notEqual(nextSource.key, first.source.key);
  assert.equal(api.instanceEvaluationCurrent(oldCache, inst, nextSource), false, 'authored identity alone cannot qualify the previous 40 mm body');
  const next = evaluatedInstance(nextParent, inst, 201), freshCache = { inst, sourceKey: next.source.key, bodies: next.placed.bodies };
  assert.equal(api.instanceEvaluationCurrent(freshCache, inst, next.source), true); assert.equal(api.instanceEvaluationCurrent(freshCache, { ...inst }, next.source), false);
  assert.equal(api.instanceEvaluationCurrent(undefined, inst, next.source), false); assert.equal(api.instanceEvaluationCurrent(freshCache, inst, undefined), false); assert.equal(api.instanceEvaluationCurrent(freshCache, inst, { ok: false, error: 'missing section' }), false);
  const firstBounds = extents(first.local.bodies[0].mesh.bounds), nextBounds = extents(next.local.bodies[0].mesh.bounds);
  firstBounds.forEach((n, i) => near(n, [40, 40, 100][i])); nextBounds.forEach((n, i) => near(n, [40, 50, 100][i]));
  assert.notDeepEqual(first.placed.bodies[0].mesh.bounds, next.placed.bodies[0].mesh.bounds);
  assert.equal(inst.doc.frames, undefined); assert.equal(snapshot({ inst, firstParent, nextParent }), before);
});

test('local frame width 60 overrides parent width changes and preserves source readiness and actual placed bounds', () => {
  const inst = frameInstance(60), firstParent = sectionParent(inst, 40), nextParent = sectionParent(inst, 50), before = snapshot({ inst, firstParent, nextParent });
  const first = evaluatedInstance(firstParent, inst, 202), next = evaluatedInstance(nextParent, inst, 203), cache = { inst, sourceKey: first.source.key, bodies: first.placed.bodies };
  assert.equal(first.source.key, next.source.key); assert.equal(api.instanceEvaluationCurrent(cache, inst, next.source), true);
  extents(first.local.bodies[0].mesh.bounds).forEach((n, i) => near(n, [40, 60, 100][i]));
  assert.deepEqual(next.local.bodies[0].mesh.bounds, first.local.bodies[0].mesh.bounds); assert.deepEqual(next.placed.bodies[0].mesh.bounds, first.placed.bodies[0].mesh.bounds);
  assert.deepEqual(next.placed.bodies[0].mesh.positions, first.placed.bodies[0].mesh.positions); assert.equal(inst.doc.frames.sections[0].section.width, 60);
  assert.equal(snapshot({ inst, firstParent, nextParent }), before);
});

test('current motion follows placement using non-commuting rotations and leaves local Model geometry untouched', () => {
  const placed = body('arm/hand/body', { m: [0, -1, 0, 1, 0, 0, 0, 0, 1], t: [10, 20, 30] });
  // X rotation 90 degrees, then a world move; placement is Z rotation 90 degrees plus its own move.
  const motion = Float64Array.from([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, -3, 5, 7, 1]), before = snapshot(placed), motionBefore = Array.from(motion);
  const [shown] = api.posedClearanceBodies([placed], new Map([['arm/hand', motion]]), ['arm', 'arm/hand']);
  assert.deepEqual(shown.pose, { m: [0, -1, 0, 0, 0, -1, 1, 0, 0], t: [7, -25, 27] });
  assert.notEqual(shown, placed); assert.equal(shown.mesh, placed.mesh); assert.equal(shown.brep, placed.brep);
  assert.equal(snapshot(placed), before); assert.deepEqual(Array.from(motion), motionBefore);
});

test('longest slash-delimited instance prefix owns motion; base bodies use exact keys and absent motions preserve identity', () => {
  const bodies = [body('arm/hand/body'), body('arm/handed/body'), body('arm/handheld/body'), body('base/body'), body('unmoved/body')];
  const motions = new Map([['arm', move(100, 0, 0)], ['arm/hand', move(0, 20, 0)], ['base/body', move(0, 0, 30)], ['arm/handheld/body', move(999, 999, 999)]]);
  for (const ids of [['arm', 'arm/hand', 'arm/handheld'], ['arm/handheld', 'arm/hand', 'arm']]) {
    const result = api.posedClearanceBodies(bodies, motions, ids);
    assert.deepEqual(result[0].pose.t, [0, 20, 0]); assert.deepEqual(result[1].pose.t, [100, 0, 0]);
    assert.equal(result[2], bodies[2], 'a known longest owner without motion does not take a shorter owner or a body-key fallback');
    assert.deepEqual(result[3].pose.t, [0, 0, 30]); assert.equal(result[4], bodies[4]);
  }
});

test('stale generation/version/revision/pose and missing or completed pairs reject without mutating the current map', () => {
  const cases = [
    { name: 'generation', request: 6, current: 7 },
    { name: 'version', change: m => { m.version = 'old-clearance-version'; } },
    { name: 'revision', result: { revision: 'previous-revision' } },
    { name: 'pose', result: { pose: 'previous-motion' } },
    { name: 'missing pair', result: { a: 'different/body' } },
    { name: 'reversed pair', result: { a: 'base/body', b: 'arm/body' } },
    { name: 'already completed', change: m => { m.pairs[0].overlap = { volume: 2, mesh: nativeMesh() }; m.pending = 0; } },
    { name: 'no pending overlap', change: m => { delete m.pairs[0].overlap; m.pending = 0; } },
  ];
  for (const c of cases) {
    const current = map(); c.change?.(current); const result = fill(c.result), before = snapshot(current), resultBefore = snapshot(result);
    assert.equal(api.acceptClearanceFill(current, result, c.request ?? 7, c.current ?? 7), false, c.name);
    assert.equal(snapshot(current), before, c.name); assert.equal(snapshot(result), resultBefore, c.name);
  }
});

test('matching fills apply actual Model transitions once while retaining independent bands and the current revision', () => {
  for (const [volume, expected] of [[0, 'touching'], [1e-7, 'touching'], [2, 'overlap']]) {
    const a = band(), b = band(), current = map([pair({ band: { a, b } })]), result = fill({ overlap: { volume: volume, mesh: nativeMesh() } });
    assert.equal(api.acceptClearanceFill(current, result, 7, 7), true); assert.equal(current.pending, 0); assert.equal(current.pairs[0].state, expected);
    assert.equal(current.pairs[0].overlap, result.overlap); assert.equal(current.pairs[0].band.a.field, a.field); assert.equal(current.pairs[0].band.b.field, b.field); assert.equal(current.revision, 'current-revision');
    const before = snapshot(current); assert.equal(api.acceptClearanceFill(current, result, 7, 7), false); assert.equal(snapshot(current), before);
  }
});

test('near overlay vertices retain the exact independent band fields instead of native mesh indexing', () => {
  const a = band(), b = band(); b.field = new Float32Array([1, 0.5, 0.25, 0]);
  const current = map([pair({ state: 'near', minGap: 0.1, overlap: undefined, band: { a, b } })]);
  const bodies = [body('arm/body', pose([10, 0, 0])), body('base/body', pose([0, 20, 0]))], before = snapshot({ current, bodies });
  const result = api.clearanceOverlays(current, bodies); assert.equal(result.length, 2);
  for (const [index, original] of [a, b].entries()) {
    const shown = result[index]; assert.equal(shown.positions, original.positions); assert.equal(shown.indices, original.indices); assert.equal(shown.field, original.field);
    assert.equal(shown.colors.length, original.positions.length); assert.equal(shown.normals.length, original.positions.length);
    assert.notEqual(shown.positions.length, bodies[index].mesh.positions.length, 'band tessellation has its own four vertices, independent of native three-vertex geometry');
    assert.equal(shown.state, 'near'); assert.equal(shown.hatched, false);
    for (let v = 0; v < original.field.length; v++) { near(shown.colors[v * 3], 0.98); near(shown.colors[v * 3 + 1], 0.54 + Math.min(1, original.field[v]) * 0.28); near(shown.colors[v * 3 + 2], 0.12); near(shown.normals[v * 3 + 2], 1); }
    assert.deepEqual(Array.from(shown.model).slice(12, 15), index === 0 ? [10, 0, 0] : [0, 20, 0]);
  }
  const display = api.clearanceDisplay(current, bodies, 19, 'bands');
  assert.equal(display.request, 19); assert.equal(display.stage, 'bands'); assert.equal(display.revision, current.revision); assert.equal(display.version, api.CLEARANCE_MAP_VERSION); assert.equal(display.near, 1); assert.equal(display.pairs, current.pairs);
  assert.equal(display.overlays[0].field, a.field); assert.equal(display.overlays[1].field, b.field); assert.equal(snapshot({ current, bodies }), before);
});

test('pending, refused and designed outputs retain Model classification and explicit unclassified labels', () => {
  const bodies = [body('arm/body'), body('base/body')];
  const cases = [
    { data: pair(), state: 'pending', label: 'Contact · overlap unclassified', hatched: false, opacity: 0.38 },
    { data: pair({ state: 'designed', designed: 'bearing seat' }), state: 'pending', label: 'Designed contact · overlap unclassified', hatched: false, opacity: 0.38 },
    { data: pair({ overlap: { refused: 'exact Boolean refused' } }), state: 'refused', label: 'Refused · overlap unclassified', hatched: true, opacity: 0.65 },
    { data: pair({ state: 'designed', designed: 'declared fit', overlap: { volume: 2, mesh: nativeMesh() } }), state: 'designed', label: 'Designed', hatched: false, opacity: 0.65 },
  ];
  for (const c of cases) {
    c.data.band = { a: band(), b: band() }; const before = snapshot(c.data), overlays = api.clearanceOverlays(map([c.data]), bodies);
    assert.equal(api.clearancePairState(c.data), c.state); assert.equal(api.clearancePairLabel(c.data), c.label);
    for (const shown of overlays) { assert.equal(shown.state, c.state); assert.equal(shown.hatched, c.hatched); assert.equal(shown.opacity, c.opacity); }
    if (c.state === 'pending') assert.ok(overlays[0].colors[1] > 0.6, 'pending stays amber rather than a red clash');
    if (c.state === 'refused') assert.ok(overlays[0].colors[0] > 0.99 && overlays[0].colors[1] < 0.2);
    if (c.state === 'designed') { assert.equal(overlays.length, 3); assert.equal(overlays[2].bodyKey, c.data.a); assert.equal(overlays[2].positions, c.data.overlap.mesh.positions); assert.ok(overlays[2].colors[1] > overlays[2].colors[0]); }
    assert.equal(snapshot(c.data), before);
  }
});

test('designed fill stays designed unless Model squeeze limit classifies excess overlap; refused fill remains unclassified', () => {
  for (const [squeezeVolume, volume, expected] of [[undefined, 2, 'designed'], [3, 2, 'designed'], [1, 2, 'overlap']]) {
    const current = map([pair({ state: 'designed', designed: 'source fit', ...(squeezeVolume === undefined ? {} : { squeezeVolume }) })]);
    assert.equal(api.acceptClearanceFill(current, fill({ overlap: { volume: volume, mesh: nativeMesh() } }), 7, 7), true);
    assert.equal(current.pairs[0].state, expected); assert.equal(current.pairs[0].designed, 'source fit'); assert.equal(api.clearancePairState(current.pairs[0]), expected);
  }
  const refused = map(); assert.equal(api.acceptClearanceFill(refused, fill({ overlap: { refused: 'unsupported exact operation' } }), 7, 7), true);
  assert.equal(refused.pairs[0].state, 'contact'); assert.equal(api.clearancePairState(refused.pairs[0]), 'refused'); assert.equal(api.clearancePairLabel(refused.pairs[0]), 'Refused · overlap unclassified');
});
