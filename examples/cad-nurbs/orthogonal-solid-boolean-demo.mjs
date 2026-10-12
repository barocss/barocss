import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const log = value => process.stdout.write(String(value) + '\n');
const [mode, directory] = process.argv.slice(2);
assert.ok(['--planner', '--source', '--emitted', '--cold'].includes(mode) && directory, 'Usage: node orthogonal-solid-boolean-demo.mjs --planner|--source|--emitted|--cold output-directory (source precedes emitted/cold)');
assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Use the pinned Node22 toolchain');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
async function sourceModule(file) {
  const result = await require('esbuild').build({ entryPoints: [resolve(repo, file)], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(result.metafile.inputs).every(path => !path.includes('/dist/')));
  const destination = resolve(output, file.endsWith('internal.ts') ? 'planner-module.mjs' : 'source-module.mjs');
  writeFileSync(destination, result.outputFiles[0].text); return import(pathToFileURL(destination));
}
const api = mode === '--source' || mode === '--planner' ? await sourceModule('packages/barocss-cad/src/index.ts') : await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const internal = mode === '--planner' ? await sourceModule('packages/barocss-cad/src/orthogonal-solid-boolean-internal.ts') : null;
const faceCorners = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
const specs = [['stock', [0, 0, 0], [6, 6, 4]], ['pocket', [2, 2, 2], [4, 4, 6]], ['boss', [0, 0, 4], [2, 2, 6]], ['slot', [0, 0, 1], [6, 1, 2]]];
const operations = ['difference', 'union', 'difference'];
function surfaces(lo, hi) {
  const corners = Array.from({ length: 8 }, (_, i) => lo.map((v, axis) => i >> axis & 1 ? hi[axis] : v));
  return faceCorners.map((indices, i) => { const points = indices.map(index => corners[index]); return { kind: 'surface', id: 'support' + i, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[points[0], points[3]], [points[1], points[2]]], weights: [[1, 1], [1, 1]] }; });
}
function modelSource(objects) {
  return '@model authored {version:0;length-unit:mm;' + objects.map(s => '@surface #' + s.id + ' {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[0,0,1,1];control-points:' + JSON.stringify(s.controlPoints) + ';weights:[[1,1],[1,1]];}').join('') + '}';
}
function box([name, lo, hi], native = false) {
  const supports = surfaces(lo, hi), bundles = supports.map((surface, i) => native ? api.buildParametricFace(surface, { faceId: 'face' + i, loopId: 'loop' + i, vertexIds: [0, 1, 2, 3].map(j => 'v' + i + '_' + j), edgeIds: [0, 1, 2, 3].map(j => 'e' + i + '_' + j), curveIds: [0, 1, 2, 3].map(j => 'c' + i + '_' + j) }) : { geometry: { objects: [surface] }, topology: { face: { id: 'face' + i } } });
  const sides = hi.map((v, i) => v - lo[i]);
  const shell = native ? api.buildAxisBoxShell(lo, sides, bundles, { shellId: 'shell', faceIds: supports.map((_, i) => 'global' + i), vertexIds: Array.from({ length: 8 }, (_, i) => 'globalv' + i), edgeIds: Array.from({ length: 12 }, (_, i) => 'globale' + i) }) : { version: 0, id: 'shell', origin: lo, sides, faces: bundles.map((bundle, i) => ({ id: 'global' + i, bundle })), vertices: [], edges: [] };
  return { sourceId: name, sourceVersion: 0, source: modelSource(supports), shell };
}
const options = (i, operation = operations[i - 1]) => ({ operation, evaluationId: 'step' + i, resultIdPrefix: 'r' + i, maximumCells: 343, maximumPanels: 384, maximumNativeObservations: 5760 });
const oldOptions = { operation: 'difference', evaluationId: 'step1', resultIdPrefix: 'r1', maximumCells: 27, maximumPanels: 72 };
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return Array.isArray(value) ? '[' + value.map(nativeJSON).join(',') + ']' : '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function save(name, data) { writeFileSync(resolve(output, name + '.json'), nativeJSON(data) + '\n'); }
function load(name) { return JSON.parse(readFileSync(resolve(output, name + '.json'), 'utf8')); }
function refused(action, code) { assert.throws(action, error => error.name === 'OrthogonalSolidBooleanError' && error.code === code); }
function placeholder(a, b, opts) { return { a, b, options: opts, originalModels: [], operandReports: [], grid: {}, cells: [], vertices: [], edges: [], panels: [], shells: [], bodies: [], sources: [], observations: [], report: {} }; }
function composedPlaceholder(left, right, opts) { return { left, right, options: opts, rightModel: {}, rightReport: {}, grid: {}, cells: [], vertices: [], edges: [], panels: [], shells: [], bodies: [], sources: [], observations: [], report: {} }; }
if (mode === '--planner') {
  const boxes = specs.map(spec => box(spec)), plans = [];
  for (let i = 1; i <= 3; i++) plans.push(internal.planOrthogonalSolid(boxes.slice(0, i + 1), operations.slice(0, i), options(i), plans.at(-1)));
  assert.deepEqual(plans.map(p => p.volumeMM3), [136, 144, 138]);
  assert.deepEqual(plans.map(p => p.areaMM2), [184, 200, 210]);
  assert.ok(plans[1].plans.some(p => p.parentPanels.length && p.lineage.some(l => l.originalIndex === 0)));
  assert.ok(plans[2].plans.some(p => p.lineage.some(l => l.relativeOrientation === -1 && l.originalIndex === 3)));
  refused(() => internal.planOrthogonalSolid([...boxes.slice(0, 2), { ...boxes[2], sourceId: plans[0].plans[0].sourceId }], operations.slice(0, 2), options(2), plans[0]), 'IDENTITY');
  const pair = (specB, operation) => internal.planOrthogonalSolid([boxes[0], box(specB)], [operation], options(1, operation));
  refused(() => pair(['edge', [6, 6, 0], [8, 8, 4]], 'union'), 'TOPOLOGY');
  refused(() => pair(['corner', [6, 6, 4], [8, 8, 6]], 'union'), 'TOPOLOGY');
  assert.equal(pair(['disjoint', [8, 0, 0], [10, 2, 2]], 'intersection').plans.length, 0);
  const cavityBoxes = [box(['outer', [0, 0, 0], [8, 8, 8]]), box(['cavity', [1, 1, 1], [7, 7, 7]]), box(['island', [2, 2, 2], [3, 3, 3]])];
  const cavity = internal.planOrthogonalSolid(cavityBoxes.slice(0, 2), ['difference'], options(1, 'difference'));
  const island = internal.planOrthogonalSolid(cavityBoxes, ['difference', 'union'], options(2), cavity);
  assert.equal(island.volumeMM3, 297);
  const nested = [0, 1, 2, 3].map(i => box(['nested' + i, [i, i, i], [7 - i, 7 - i, 7 - i]]));
  const fakeBase = placeholder(nested[0], nested[1], { ...oldOptions, operation: 'union' });
  const fakeSecond = composedPlaceholder({ kind: 'axis-box', result: fakeBase }, nested[2], options(2));
  refused(() => api.buildOrthogonalSolidBoolean({ kind: 'orthogonal', result: fakeSecond }, nested[3], options(3, 'union')), 'BUDGET');
  refused(() => api.buildOrthogonalSolidBoolean({}, {}, { ...options(2), maximumNativeObservations: 5759 }), 'BUDGET');
  refused(() => api.buildOrthogonalSolidBoolean({ kind: 'axis-box', result: placeholder(boxes[0], boxes[1], oldOptions) }, boxes[0], options(2)), 'IDENTITY');
  const fakeThird = composedPlaceholder({ kind: 'orthogonal', result: fakeSecond }, nested[3], options(3));
  refused(() => api.buildOrthogonalSolidBoolean({ kind: 'orthogonal', result: fakeThird }, nested[0], options(3)), 'BUDGET');
  let getterCalls = 0; const hostile = { get kind() { getterCalls++; return 'axis-box'; }, result: {} };
  refused(() => api.buildOrthogonalSolidBoolean(hostile, {}, options(2)), 'INPUT'); assert.equal(getterCalls, 0);
  const cycle = {}; cycle.loop = cycle; refused(() => internal.snapshot(cycle), 'INPUT');
  const alias = { values: [1, 2, 3] }, copied = internal.snapshot({ a: alias, b: alias }); assert.notEqual(copied.a, copied.b); assert.notEqual(copied.a.values, copied.b.values);
  refused(() => internal.snapshot(Array.from({ length: 8192 }, () => 'x'.repeat(4096))), 'BUDGET');
  let deep = 0; for (let i = 0; i < 66; i++) deep = [deep]; refused(() => internal.snapshot(deep), 'BUDGET');
  const panels = plans.map(p => p.plans.length), receipt = { stagePanels: panels, stageObservations: panels.map(p => p * 15), fullChainObservations: panels.reduce((a, b) => a + 15 * b, 0), volumes: plans.map(p => p.volumeMM3), areas: plans.map(p => p.areaMM2), nativeCalls: 0, controls: 'topology-edge-corner;empty;enclosed-island;operation-cap;cumulative-native-cap;fixed-budget;identity;getters;cycles;alias-copy;byte-charge;depth' };
  save('planner', receipt); log(JSON.stringify(receipt));
} else {
  function inspect(result) {
    assert.equal(result.report.volumeMM3, 138); assert.equal(result.report.areaMM2, 210);
    assert.equal(result.report.nativeWork.totals.observationCount, result.report.nativeWork.stages.reduce((n, stage) => n + stage.observationCount, 0));
    const originals = [result.left.result.left.result.a, result.left.result.left.result.b, result.left.result.right, result.right];
    const originalBySource = new Map(originals.map(a => [a.sourceId, a]));
    let inherited = 0, reversed = 0, coincident = 0;
    for (const panel of result.panels) {
      const points = panel.bundle.topology.vertices.map(vertex => vertex.point);
      for (const lineage of panel.lineage) {
        const source = originalBySource.get(lineage.sourceId), surface = source.shell.faces.find(face => face.id === lineage.globalFaceId).bundle.geometry.objects[0];
        assert.equal(surface.id, lineage.surfaceId); assert.equal(originals[lineage.originalIndex].sourceId, lineage.sourceId);
        for (let i = 0; i < 4; i++) { const [u, v] = lineage.uvCorners[i].map(r => Number(r.numerator) / Number(r.denominator)); assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1); assert.deepEqual(surface.controlPoints[0][0].map((o, axis) => o + u * (surface.controlPoints[1][0][axis] - o) + v * (surface.controlPoints[0][1][axis] - o)), points[i]); }
        if (lineage.relativeOrientation === -1) reversed++;
      }
      if (panel.lineage.length > 1) coincident++;
      for (const link of panel.parentPanels) {
        const parent = result.left.result.panels.find(p => p.id === link.panelId); assert.ok(parent); assert.equal(link.sourceId, parent.sourceId); assert.equal(link.evaluationId, result.left.result.options.evaluationId);
        const chart = parent.bundle.topology.vertices.map(v => v.point);
        for (let i = 0; i < 4; i++) { const [u, v] = link.uvCorners[i].map(r => Number(r.numerator) / Number(r.denominator)); assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1); assert.deepEqual(chart[0].map((o, axis) => o + u * (chart[1][axis] - o) + v * (chart[3][axis] - o)), points[i]); }
        inherited++;
      }
    }
    assert.ok(inherited > 0 && reversed > 0);
    const objects = new WeakSet(); const visit = value => { if (value && typeof value === 'object') { assert.ok(!objects.has(value), 'No repeated writable result occurrence'); objects.add(value); Object.values(value).forEach(visit); } }; visit(result);
    assert.equal(result.shells.reduce((n, s) => n + s.signedVolumeMM3, 0), 138);
    assert.equal(result.edges.length * 2, result.panels.length * 4);
    return { inheritedPanelLinks: inherited, reversedOriginalFaces: reversed, coincidentProvenances: coincident };
  }
  let result;
  if (mode === '--source') {
    const admission = load('planner'); assert.ok(admission.fullChainObservations <= 5760);
    const boxes = specs.map(spec => box(spec, true)), before = structuredClone(boxes);
    log('Native fixtures ready; starting original pocket');
    const pocket = api.buildAxisBoxSolidBoolean(boxes[0], boxes[1], oldOptions); save('pocket', pocket); log('Pocket panels=' + pocket.panels.length);
    const boss = api.buildOrthogonalSolidBoolean({ kind: 'axis-box', result: pocket }, boxes[2], options(2)); save('boss', boss); log('Boss cumulative observations=' + boss.report.nativeWork.totals.observationCount);
    result = api.buildOrthogonalSolidBoolean({ kind: 'orthogonal', result: boss }, boxes[3], options(3));
    assert.deepEqual(boxes, before); assert.deepEqual(pocket, load('pocket')); assert.deepEqual(boss, load('boss'));
    refused(() => api.buildOrthogonalSolidBoolean({ kind: 'orthogonal', result }, boxes[0], options(3)), 'BUDGET');
    save('result', result);
  } else {
    const retained = load('result');
    if (mode === '--cold') {
      const forged = structuredClone(retained); Object.defineProperty(forged.report, 'hiddenProof', { value: true, enumerable: false });
      refused(() => api.validateOrthogonalSolidBoolean(forged), 'OWNED'); // Strict admission only, zero native work.
      assert.deepEqual(api.validateOrthogonalSolidBoolean(retained), retained.report); result = retained;
    }
    else { result = api.buildOrthogonalSolidBoolean(retained.left, retained.right, retained.options); assert.deepEqual(result, retained); }
  }
  const receipt = { mode, ...inspect(result), report: result.report };
  save(mode.slice(2) + '-receipt', receipt); log(JSON.stringify({ mode, panels: result.panels.length, volumeMM3: result.report.volumeMM3, nativeWork: result.report.nativeWork, checked: true }));
}
