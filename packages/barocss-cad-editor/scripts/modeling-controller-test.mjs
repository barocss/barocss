// CPU/controller admission only. Recorded mesh + graph-shaped test DTOs, never new native geometry.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-modeling-controller'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({ stdin: { contents: `export * from '${resolve(root, 'packages/barocss-cad-editor/src/modeling-controller.ts')}'; export * from '${resolve(root, 'packages/barocss-cad-editor/src/prism-feature-scene.ts')}';`, resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src/index.ts') } });
writeFileSync(resolve(output, 'controller.mjs'), bundle.outputFiles[0].text);
const { createCadEditorModelingController: create, preparePrismFeatureScene: prepare, pickPrismFeatureScene: pick } = await import(pathToFileURL(resolve(output, 'controller.mjs')));
const base = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json'), 'utf8')).components[0];
const signedJSON = value => JSON.stringify(value, (_key, v) => Object.is(v, -0) ? '__negative_zero__' : v).replaceAll('"__negative_zero__"', '-0');
// A deliberately synthesized graph DTO exercises copied-data consistency, not native authenticity.
function graphFor(component) {
  const { mesh, boundaries } = component, vertices = [], edges = [];
  for (const [i, v] of mesh.vertices.entries()) {
    let vertex = vertices.find(p => p.id === v.solidVertexId);
    if (!vertex) { vertex = { id: v.solidVertexId, pointMM: mesh.positionsMM.slice(i * 3, i * 3 + 3), members: [] }; vertices.push(vertex); }
    vertex.members.push({ sourceId: v.sourceId, faceId: v.faceId, vertexId: v.nativeVertexId });
  }
  for (const boundary of boundaries) {
    let edge = edges.find(e => e.id === boundary.solidEdgeId);
    if (!edge) { edge = { id: boundary.solidEdgeId, vertexIds: boundary.solidVertexIds, uses: [] }; edges.push(edge); }
    edge.uses.push({ sourceId: boundary.sourceId, faceId: boundary.faceId, surfaceId: mesh.faces[boundary.faceIndex].surfaceId, loopId: boundary.loopId,
      use: { id: boundary.useId, edgeId: boundary.edgeId, curveId: boundary.curveId, pcurveId: boundary.pcurveId, sense: boundary.sense, interval: boundary.interval, vertexIds: boundary.nativeVertexIds } });
  }
  const faces = mesh.faces.map((face, i) => ({ sourceId: face.sourceId, faceId: face.faceId, surfaceId: face.surfaceId, loopId: face.loopId,
    vertexIds: mesh.vertices.slice(face.vertexOffset, face.vertexOffset + face.vertexCount).map(v => v.solidVertexId), edgeIds: boundaries.filter(b => b.faceIndex === i).map(b => b.solidEdgeId) }));
  return { vertices, edges, faces };
}
const graph = graphFor(base), nativeId = base.report.solidId;
const authored = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { height: 8, signed: -0 },
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 16] }, { kind: 'extrude', sketch: 0, height: { parameter: 'height' } }],
  outputs: { part: { node: 1, side: 'solid' } } };
const overlap = { ...structuredClone(authored), parameters: { rearX: 16, leftX: 8, rightX: 40, lowY: -8, highY: 24, height: 4 },
  nodes: [{ kind: 'sketch' }, { kind: 'extrude' }, { kind: 'sketch' }, { kind: 'extrude' }, { kind: 'intersect' }],
  outputs: { overlap: { node: 4, side: 'solid' } } };
const split = { ...structuredClone(authored), parameters: { height: 8, splitHeight: 2 },
  nodes: [{ kind: 'sketch' }, { kind: 'extrude' }, { kind: 'split', parent: 1, axis: 'z', at: { parameter: 'splitHeight' } }],
  outputs: { lower: { node: 2, side: 'negative' }, upper: { node: 2, side: 'positive' } } };
const cardinal = axis => ({ ...structuredClone(split), parameters: { splitAt: 16, rearX: 16, height: 8 },
  nodes: split.nodes.map((node, index) => index === 2 ? { ...node, axis, at: { parameter: 'splitAt' } } : node),
  outputs: { negative: { node: 2, side: 'negative' }, positive: { node: 2, side: 'positive' } } });
function reply(document = authored, revision = 0) {
  const names = Object.keys(document.outputs);
  return { id: 1, ok: true, text: signedJSON(document), summary: { documentId: 'cad_model', revision, source: 'model', parameters: document.parameters,
    features: document.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: index === 4 ? [1, 3] : index % 2 ? [index - 1] : [] })),
    outputs: names.map(name => ({ name, solidId: nativeId, volumeMM3: { numerator: '1', denominator: '1' } })) },
  display: { profile: 'model-outputs', documentId: 'cad_model', revision,
    components: names.map(name => ({ ...structuredClone(base), role: name, lineage: { kind: 'model-output', name, solidId: nativeId, graph: structuredClone(graph) } })),
    outcomes: names.map(role => ({ role, solidId: nativeId, status: 'solid' })) } };
}
const instances = [], timers = new Set(), originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
globalThis.setTimeout = callback => { const timer = { callback }; timers.add(timer); return timer; };
globalThis.clearTimeout = timer => timers.delete(timer);
class Worker {
  callbacks = new Map(); requests = []; terminated = false;
  constructor() { instances.push(this); }
  addEventListener(name, callback) { this.callbacks.set(name, callback); }
  postMessage(command) { this.requests.push(command); }
  terminate() { this.terminated = true; }
  send(result, id = this.requests.at(-1).id) { this.callbacks.get('message')({ data: { ...structuredClone(result), id } }); }
  accept(command = this.requests.at(-1)) {
    const document = command.kind === 'example' ? structuredClone(command.example === 'intersection' ? overlap : command.example === 'horizontal-split' ? (command.splitAxis === 'x' || command.splitAxis === 'y' ? cardinal(command.splitAxis) : split) : authored) : command.kind === 'open' ? JSON.parse(command.text) : structuredClone(this.document);
    if (command.kind === 'apply') Object.assign(document.parameters, command.parameters);
    this.document = document;
    const result = reply(document, command.kind === 'apply' ? command.expectedRevision + 1 : command.revision ?? 0); this.send(result, command.id); return result;
  }
}
globalThis.Worker = Worker;
const tick = () => Promise.resolve();
const stable = s => { const x = s.getSnapshot(); return { accepted: x.accepted, authoredText: x.authoredText, display: x.display, faceSelection: x.faceSelection, selection: x.selection, generation: x.generation, history: x.history, drafts: x.drafts }; };
let checks = 0, legacyChecks = 0;
try {
  const session = create(); let p = session.example(), worker = instances.at(-1); worker.accept(); await p;
  assert.ok(session.getSnapshot().accepted); assert.ok(Object.is(session.getSnapshot().accepted.parameters.signed, -0)); checks++;
  for (const bad of ['', '0x10', 'Infinity', '10001', '1e-9999']) { session.stage('height', bad); await assert.rejects(session.apply()); } session.discard(); checks++;
  session.stage('height', '6'); p = session.apply(); await assert.rejects(session.apply(), /in progress/);
  worker.send({ ok: false, message: 'old reply' }, worker.requests.at(-1).id - 1); assert.equal(session.getSnapshot().busy, true);
  worker.accept(); await p; assert.equal(session.getSnapshot().accepted.parameters.height, 6); assert.equal(session.getSnapshot().history.count, 2); checks++;
  const generation = session.getSnapshot().generation; session.select(1, generation); assert.throws(() => session.select(1, generation - 1), /stale/);
  p = session.undo(); worker.accept(); await p; assert.equal(session.getSnapshot().accepted.parameters.height, 8);
  p = session.redo(); worker.accept(); await p; assert.equal(session.getSnapshot().accepted.parameters.height, 6); checks++;
  session.stage('height', '7'); const prior = stable(session); p = session.apply(); const late = worker.requests.at(-1); session.cancel(); worker.accept(late); await p;
  assert.deepEqual(stable(session), prior); assert.equal(worker.terminated, true); checks++;
  p = session.apply(); worker = instances.at(-1); assert.equal(worker.requests[0].kind, 'open'); assert.equal(worker.requests[0].revision, prior.accepted.revision);
  worker.accept(); await tick(); worker.accept(); await p; assert.equal(session.getSnapshot().accepted.parameters.height, 7); checks++;
  session.stage('height', '5'); const accepted = stable(session); p = session.apply(); worker.send({ ok: false, message: 'native refusal' }); await p;
  assert.deepEqual(stable(session), accepted); session.discard(); checks++;
  const previous = session.getSnapshot(); p = session.open(previous.authoredText); worker.accept(); await p;
  assert.equal(session.getSnapshot().accepted.revision, 0); assert.ok(session.getSnapshot().generation > previous.generation);
  assert.throws(() => session.pick(100, 100, 50, 50, previous.generation), /stale/); checks++;
  for (const mutate of [r => r.summary.parameters.height = 77, r => r.summary.outputs[0].solidId = 'wrong', r => r.display.revision++, r => r.summary.features[1].dependencies = [1], r => r.text = '{}']) {
    const s = create(); p = s.example(); const result = reply(); mutate(result); instances.at(-1).send(result); await p;
    assert.equal(s.getSnapshot().accepted, null); assert.ok(s.getSnapshot().error); s.dispose(); checks++;
  }
  for (const mode of ['display-refusal', 'cancel-staging', 'worker-failure-staging', 'wrong-revision', 'wrong-parameters', 'wrong-document', 'changed-literal', 'changed-dependency', 'changed-output']) {
    let commits = 0, disposals = 0, release;
    const port = { prepare: async () => ({ commit() { commits++; }, dispose() { disposals++; } }) };
    const s = create(port); p = s.example(); instances.at(-1).accept(); await p; s.stage('height', '6'); const before = stable(s);
    if (mode === 'display-refusal') port.prepare = async () => ({ commit() { throw new Error('display refused'); }, dispose() { disposals++; } });
    if (mode === 'cancel-staging' || mode === 'worker-failure-staging') port.prepare = () => new Promise(resolve => { release = () => resolve({ commit() { commits++; }, dispose() { disposals++; } }); });
    p = s.apply(); const value = structuredClone(authored); value.parameters.height = mode === 'wrong-parameters' ? 7 : 6; const r = reply(value, mode === 'wrong-revision' ? 9 : 1);
    if (mode === 'wrong-document') { r.summary.documentId = 'other'; r.display.documentId = 'other'; }
    if (mode === 'changed-literal') { value.nodes[0].max[0] = 31; r.text = signedJSON(value); }
    if (mode === 'changed-dependency') { value.nodes[1].sketch = 1; r.text = signedJSON(value); }
    if (mode === 'changed-output') { value.outputs.part.node = 0; r.text = signedJSON(value); }
    instances.at(-1).send(r); await tick(); await tick();
    if (mode === 'cancel-staging') { assert.equal(typeof release, 'function'); s.cancel(); release(); }
    if (mode === 'worker-failure-staging') { assert.equal(typeof release, 'function'); instances.at(-1).callbacks.get('error')(); release(); }
    await p; assert.deepEqual(stable(s), before); assert.equal(commits, 1); assert.equal(s.getSnapshot().busy, false);
    if (mode === 'display-refusal' || mode === 'cancel-staging' || mode === 'worker-failure-staging') assert.ok(disposals >= 2); s.dispose(); checks++;
  }
  // Every additive sample uses the same atomic replacement path, including drafts/history.
  for (const [example, document, kind, outputs, axis] of [['intersection', overlap, 'intersect', ['overlap']], ['horizontal-split', split, 'split', ['lower', 'upper']], ['horizontal-split', cardinal('x'), 'split', ['negative', 'positive'], 'x'], ['horizontal-split', cardinal('y'), 'split', ['negative', 'positive'], 'y']]) {
    const samples = create(); p = samples.example(); let sampleWorker = instances.at(-1); sampleWorker.accept(); await p;
    samples.stage('height', '6'); p = samples.apply(); sampleWorker.accept(); await p;
    samples.stage('height', '7'); const beforeSample = stable(samples);
    p = samples.example(example, axis); assert.equal(sampleWorker.requests.at(-1).example, example); assert.equal(sampleWorker.requests.at(-1).splitAxis, axis);
    sampleWorker.send({ ok: false, message: `${example} sample refused` }); await p;
    assert.deepEqual(stable(samples), beforeSample); checks++;
    p = samples.example(example, axis); const cancelledSample = sampleWorker.requests.at(-1); samples.cancel(); sampleWorker.accept(cancelledSample); await p;
    assert.deepEqual(stable(samples), beforeSample); checks++;
    p = samples.example(example, axis); sampleWorker = instances.at(-1); sampleWorker.accept(); await p;
    assert.deepEqual(samples.getSnapshot().accepted.outputs.map(output => output.name), outputs);
    assert.equal(samples.getSnapshot().accepted.features.at(-1).kind, kind);
    assert.equal(samples.getSnapshot().history.count, 1); assert.deepEqual(samples.getSnapshot().drafts, {}); checks++;
    samples.stage('height', '2'); const beforeOutputChange = stable(samples); p = samples.apply();
    const changed = structuredClone(document); changed.parameters.height = 2;
    if (axis) changed.outputs.negative.side = 'positive';
    else if (example === 'horizontal-split') changed.outputs.lower.side = 'positive';
    else changed.outputs.overlap.node = 1;
    sampleWorker.send(reply(changed, 1)); await p; assert.deepEqual(stable(samples), beforeOutputChange); checks++;
    if (axis) {
      // A rejected forged result terminates that worker; use a fresh accepted session for the independent axis guard.
      const axisSession = create(); p = axisSession.example(example, axis); const axisWorker = instances.at(-1); axisWorker.accept(); await p;
      axisSession.stage('height', '2'); const beforeAxisChange = stable(axisSession); p = axisSession.apply();
      const forged = structuredClone(document); forged.parameters.height = 2; forged.nodes[2].axis = axis === 'x' ? 'y' : 'x';
      axisWorker.send(reply(forged, 1)); await p; assert.deepEqual(stable(axisSession), beforeAxisChange); axisSession.dispose(); checks++;
    }
    samples.dispose();
  }
  const invalid = create(); const beforeInvalid = stable(invalid), beforeWorkers = instances.length;
  for (const [example, axis] of [['horizontal-split', 'q'], ['horizontal-split', null], ['horizontal-split', 1], ['horizontal-split', {}], ['intersection', 'x'], ['cut-chamfer', 'z'], [undefined, 'y'], ['unknown', undefined]]) {
    await assert.rejects(invalid.example(example, axis), /Choose/);
    assert.equal(instances.length, beforeWorkers); assert.deepEqual(stable(invalid), beforeInvalid); checks++;
  }
  invalid.dispose();
  // The codec owns supported kinds. The transport validates their shape without a whitelist.
  for (const kind of ['intersect', 'split', 'future-native-operation']) {
    const data = structuredClone(authored); data.nodes[1].kind = kind;
    const s = create(); p = s.open(signedJSON(data)); instances.at(-1).send(reply(data)); await p;
    assert.equal(s.getSnapshot().accepted.features[1].kind, kind); s.dispose(); checks++;
  }
  for (const kind of ['', '   ', 'x'.repeat(65), 12, null, [], {}]) {
    const data = structuredClone(authored); data.nodes[1].kind = kind;
    const s = create(); p = s.open(signedJSON(data)); instances.at(-1).send(reply(data)); await p;
    assert.equal(s.getSnapshot().accepted, null); assert.match(s.getSnapshot().error, /feature dependencies/); s.dispose(); checks++;
  }
  const changes = [p => p.components[0].lineage.name = 'wrong', p => p.components[0].lineage.solidId = 'wrong',
    p => p.components[0].lineage.graph.faces[0].faceId = 'wrong', p => p.components[0].lineage.graph.edges[0].uses[0].use.curveId = 'wrong',
    p => p.components[0].lineage.graph.vertices[0].pointMM[0] += 1, p => p.components[0].boundaries[0].solidEdgeId = 'wrong',
    p => p.components[0].lineage.graph.faces[0].vertexIds[0] = 'wrong', p => p.outcomes[0].role = 'wrong', p => p.components.push(structuredClone(p.components[0])),
    p => p.components[0].lineage.graph.vertices[0].pointMM = [], p => p.components[0].lineage.graph.edges[0].uses[0].use.interval = [],
    p => p.components[0].lineage.graph.edges[0].uses[0].use.vertexIds = [], p => p.components[0].lineage.graph.edges[0].vertexIds = [],
    p => p.components[0].lineage.graph.edges[0].uses.pop(), p => p.components[0].lineage.graph.vertices[0].members.pop(),
    p => p.components[0].lineage.graph.vertices[1].id = p.components[0].lineage.graph.vertices[0].id,
    p => p.components[0].lineage.graph.vertexLinks = []];
  for (const change of changes) { const packet = reply().display; change(packet); assert.throws(() => prepare(packet, 'result')); checks++; }
  const aliases = structuredClone(authored); aliases.outputs.sameBody = { ...aliases.outputs.part };
  const scene = prepare(reply(aliases).display, 'result');
  assert.equal(scene.scene.geometries.length, 2); assert.notEqual(scene.scene.nodes[0].id, scene.scene.nodes[1].id);
  assert.equal(scene.packet.components[0].report.solidId, scene.packet.components[1].report.solidId); checks++;
  let hit = null; for (let y = 4; y < 160 && !hit; y += 8) for (let x = 4; x < 160 && !hit; x += 8) hit = pick(scene, 160, 160, x, y);
  assert.ok(hit && ['part', 'sameBody'].includes(hit.role)); assert.equal(hit.solidId, nativeId); checks++;
  if (process.env.SERIAL_REPLIES) {
    const real = JSON.parse(readFileSync(process.env.SERIAL_REPLIES, 'utf8'))[0];
    const wrap = input => {
      const r = structuredClone(input), d = r.summary.document;
      return { id: r.id, ok: true, text: r.text, display: r.display, compatibility: r.summary,
        summary: { documentId: d.id, revision: d.revision, source: 'legacy', parameters: Object.fromEntries(d.parameters.map(p => [p.id, p.valueMM])),
          features: d.nodes.map((n, index) => ({ kind: n.kind, index, dependencies: (r.summary.dependencies.find(dep => dep.nodeId === n.id)?.dependsOn ?? []).map(id => d.nodes.findIndex(node => node.id === id)) })),
          outputs: r.summary.components.filter(c => c.status === 'solid').map(c => ({ name: c.role, solidId: c.solidId, volumeMM3: c.role === 'second' ? r.summary.serial.volumes.negative : r.summary.volumes[c.role] })) } };
    };
    const s = create(); p = s.open(real.text); instances.at(-1).send(wrap(real)); await p; assert.ok(s.getSnapshot().accepted); s.dispose(); legacyChecks++;
    for (const mutate of [r => r.compatibility.document.nodes[5].reference.a.faceId = 'forged',
      r => r.compatibility.document.nodes[5].options.retainedSolidId = 'forged', r => r.compatibility.selectedWalls[0].segmentId = 'forged',
      r => r.compatibility.serial.resolution.originalPrismNodeId = 'forged']) {
      const r = wrap(real); mutate(r); r.text = signedJSON(r.compatibility.document);
      const s = create(); p = s.open(r.text); instances.at(-1).send(r); await p; assert.equal(s.getSnapshot().accepted, null); assert.ok(s.getSnapshot().error); s.dispose(); legacyChecks++;
    }
  }
  session.stage('height', '8'); p = session.apply(); [...timers][0].callback(); await p; assert.match(session.getSnapshot().error, /timed out/); checks++;
  session.dispose(); assert.equal(timers.size, 0);
} finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
const result = { ok: true, checks, legacyChecks, evidence: 'CPU controller, saved mesh and synthesized graph-shaped DTO; optional saved real legacy replies; no native geometry, browser, GPU or OS files' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
