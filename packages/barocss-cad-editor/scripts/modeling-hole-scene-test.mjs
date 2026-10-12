// Actual retained native baseline, CPU data admission and raycast only; no native calls or GPU pixels.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1644-hole-scene');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const source = resolve(root, 'packages/barocss-cad-editor/src/modeling-scene.ts');
// Load the unchanged GPU functions directly; unrelated GPU exports import native CAD providers.
const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview'].map(name => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src/' + name + '.ts'))};`).join('\n'));
const build = await require('esbuild').build({ stdin: { contents: `export * from ${JSON.stringify(source)}; export { prepareKernelFacePreview, resolveKernelFaceReference, raycastEngineScene, prepareEngineScene } from ${JSON.stringify(gpu)};`, resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, alias: { '@barocss/gpu': gpu } });
writeFileSync(resolve(output, 'scene.mjs'), build.outputFiles[0].text);
const { prepareModelingScene: prepare, pickModelingScene: pick, resolveModelingFaceReference: resolveFace,
  prepareKernelFacePreview, resolveKernelFaceReference, raycastEngineScene, prepareEngineScene } = await import(pathToFileURL(resolve(output, 'scene.mjs')));
const bytes = readFileSync(resolve(import.meta.dirname, 'fixtures/modeling-hole/baseline-native.json'));
assert.equal(bytes.length, 277591);
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256, '3ee3d585448a24ad6d8fcdbc3cddd927eb6e13b399db6a707444940080fc4024');
const baseline = JSON.parse(bytes), native = baseline.bodies.plate.native, bundle = native.bundle;
const qualificationKeys = ['kind', 'version', 'lengthUnit', 'geometryAuthority', 'solid', 'topologyCertified', 'embeddedStoredGeometryCertified',
  'materialComponentCount', 'genus', 'faceCount', 'vertexCount', 'edgeCount', 'loopCount', 'edgeUseCount', 'weightedEuler'];
const blank = baseline.bodies.blank.native;
const blankComponent = { role: 'blank', ...Object.fromEntries(['mesh', 'boundaries', 'internalDiagonals', 'report'].map(k => [k, structuredClone(baseline.blankMesh[k])])),
  lineage: { kind: 'model-output', name: 'blank', solidId: baseline.blankMesh.report.solidId, graph: { vertices: structuredClone(blank.graph.vertices), faces: structuredClone(blank.graph.faces),
    edges: blank.graph.edges.map(({ id, vertexIds, uses }) => structuredClone({ id, vertexIds, uses })) } } };
const plate = { family: 'stored-rational-plate-hole', role: 'plate', solidId: bundle.request.bodyId, preview: structuredClone(baseline.holeMesh),
  qualification: Object.fromEntries(qualificationKeys.map(k => [k, native.certificate[k]])), lineage: { bodyId: bundle.request.bodyId,
    faces: bundle.faces.map(({ id, role, surface, orientation, outerLoopId, innerLoopIds }) => ({ id, role, surfaceId: surface.id, orientation, outerLoopId, innerLoopIds: [...innerLoopIds] })),
    vertices: structuredClone(bundle.topology.vertices), edges: bundle.topology.edges.map(({ id, curve, vertexIds, sourceParameterRange }) => ({ id, curveId: curve.id, vertexIds: [...vertexIds], sourceParameterRange: [...sourceParameterRange] })),
    loops: bundle.topology.loops.map(({ id, faceId, role, uses }) => ({ id, faceId, role, uses: uses.map(({ id, edgeId, sense, pcurve }) => ({ id, edgeId, sense, pcurveId: pcurve.curve.id, domain: [...pcurve.domain] })) })) } };
// Request envelope adaptation only: original mesh arrays/provenance/report/native bodies stay byte-equal.
const packet = { profile: 'model-body-faces', documentId: 'mounting_plate', revision: 0, taskToken: 'scene_request_0',
  components: [{ family: 'convex-planar', component: blankComponent }, plate],
  outcomes: [{ role: 'blank', solidId: baseline.blankMesh.report.solidId, family: 'convex-planar', status: 'solid' }, { role: 'plate', solidId: plate.solidId, family: plate.family, status: 'solid' }] };
Object.assign(plate.preview.mesh.context, { documentId: packet.documentId, documentRevision: '0', kernelResultRevision: '0', topologyRevision: '0', taskToken: packet.taskToken });
const before = structuredClone(packet), scene = prepare(packet), blankScene = prepare(packet, 1, 'blank');
assert.deepEqual(packet, before); assert.equal(scene.selectedOutput, 'plate'); assert.equal(scene.packet.components.length, 2);
assert.equal(blankScene.selectedOutput, 'blank'); assert.equal(scene.scene.geometries.length, 1); assert.equal(blankScene.scene.geometries.length, 1);
assert.match(scene.canvasLabel, /plate.*stored-rational-plate-hole/);
assert.deepEqual(scene.packet.components[1].preview.mesh.chunks, baseline.holeMesh.mesh.chunks);
assert.deepEqual(scene.packet.components[1].preview.provenance, baseline.holeMesh.provenance);
assert.deepEqual(scene.packet.components[1].preview.report, baseline.holeMesh.report);
assert.deepEqual(scene.packet.components[1].qualification, Object.fromEntries(qualificationKeys.map(k => [k, native.certificate[k]])));
assert.equal(scene.packet.components[1].qualification.solid, true); assert.equal(scene.packet.components[1].preview.report.solid, false);
assert.equal(scene.packet.components[1].preview.report.topologyCertified, false);
const geometry = scene.scene.geometries[0], transform = values => values.flatMap((v, i) => i % 3 ? [] : [v, values[i + 2], -values[i + 1]]);
assert.deepEqual(geometry.positions, transform(plate.preview.mesh.chunks.flatMap(c => c.positionsMM)));
assert.deepEqual(geometry.normals, transform(plate.preview.mesh.chunks.flatMap(c => c.normals)));
assert.deepEqual(geometry.uvs, plate.preview.mesh.chunks.flatMap(c => c.parametersUV));
let vertexOffset = 0, indexOffset = 0;
for (const [i, chunk] of plate.preview.mesh.chunks.entries()) {
  const reference = { ...plate.preview.mesh.context, faceToken: chunk.faceToken, nativeFaceId: chunk.nativeFaceId };
  const binding = resolveFace(scene, reference);
  assert.deepEqual(binding.vertexRange, [vertexOffset, vertexOffset + chunk.positionsMM.length / 3]);
  assert.deepEqual(binding.indexRange, [indexOffset, indexOffset + chunk.indices.length]);
  assert.deepEqual(geometry.indices.slice(indexOffset, indexOffset + chunk.indices.length), chunk.indices.map(v => v + vertexOffset));
  assert.equal(plate.lineage.faces[i].id, reference.nativeFaceId);
  assert.deepEqual(plate.preview.provenance[i].nativeLoopIds, bundle.topology.loops.filter(l => l.faceId === reference.nativeFaceId).map(l => l.id));
  for (const field of ['documentId', 'bodyId', 'documentRevision', 'kernelResultRevision', 'topologyRevision', 'taskToken', 'faceToken', 'nativeFaceId'])
    assert.equal(resolveFace(scene, { ...reference, [field]: 'stale' }), null);
  vertexOffset += chunk.positionsMM.length / 3; indexOffset += chunk.indices.length;
}
assert.equal(vertexOffset, 256); assert.equal(indexOffset / 3, 128);
assert.deepEqual(plate.preview.provenance.filter(p => ['bottom-cap', 'top-cap'].includes(p.role)).map(p => [p.nativeLoopIds.length, p.panels.length]), [[2, 20], [2, 20]]);
assert.equal(plate.preview.provenance.find(p => p.role === 'hole-wall').panels.length, 20);
const ray = (origin, direction) => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin, direction, near: 0, far: 200 });
assert.equal(raycastEngineScene(scene.scene, ray([40, 100, -20], [0, -1, 0])), null, 'aperture must remain open');
const capHit = raycastEngineScene(scene.scene, ray([10, 100, -10], [0, -1, 0]));
assert.ok(capHit); assert.deepEqual(capHit.normal, [0, 1, 0]); assert.ok(Math.abs(capHit.point[1] - 8) < 1e-10);
const wallHit = raycastEngineScene(scene.scene, ray([40, 4, -20], [1, 0, 0]));
assert.ok(wallHit); assert.ok(wallHit.normal[0] < 0); assert.ok(Math.abs(wallHit.point[0] - 45) < 1e-10);
assert.ok(raycastEngineScene(blankScene.scene, ray([40, 100, -20], [0, -1, 0])), 'blank has no aperture');
let picked;
for (let y = 35; y < 165 && !picked; y += 15) for (let x = 35; x < 165 && !picked; x += 15) picked = pick(scene, 200, 200, x, y);
assert.ok(picked); assert.equal(picked.family, 'stored-rational-plate-hole'); assert.equal(picked.approximate, true);
assert.deepEqual(picked.provenance, plate.preview.provenance.find(p => p.faceToken === picked.reference.faceToken));
assert.deepEqual(picked.lineage, plate.lineage); assert.ok(resolveFace(scene, picked.reference));
assert.throws(() => resolveFace(structuredClone(scene), picked.reference), /original accepted scene/);
assert.throws(() => pick(structuredClone(scene), 200, 200, 100, 100), /original accepted scene/);
const gpuPrepared = prepareKernelFacePreview(plate.preview.mesh, { displayId: 'plate', packetRevision: 0 });
assert.ok(resolveKernelFaceReference(gpuPrepared, picked.reference));
assert.throws(() => resolveKernelFaceReference(structuredClone(gpuPrepared), picked.reference), /owned/);
const next = structuredClone(packet); next.taskToken = 'scene_request_1'; next.components[1].preview.mesh.context.taskToken = next.taskToken;
assert.equal(resolveFace(prepare(next), picked.reference), null);
const mutations = [
  ['tagged all-convex', p => { p.components.pop(); p.outcomes.pop(); }],
  ['unknown family', p => p.components[1].family = p.outcomes[1].family = 'cylinder'],
  ['unknown profile', p => p.profile = 'other'], ['output body', p => p.outcomes[1].solidId = 'other'],
  ['duplicate output', p => p.outcomes[1].role = 'blank'], ['revision', p => p.revision++],
  ['request', p => p.taskToken = 'other'], ['token budget', p => p.taskToken = 'x'.repeat(49)],
  ['wrong document', p => p.components[1].preview.mesh.context.documentId = 'other'],
  ['wrong body', p => p.components[1].preview.mesh.context.bodyId = 'other'],
  ['kernel revision', p => p.components[1].preview.mesh.context.kernelResultRevision = 'other'],
  ['topology revision', p => p.components[1].preview.mesh.context.topologyRevision = 'other'],
  ['fake volume', p => p.components[1].volumeMM3 = 24971], ['false qualification', p => p.components[1].qualification.solid = false],
  ['preview certified', p => p.components[1].preview.report.solid = true], ['source certified', p => p.components[1].preview.report.native.solid = true],
  ['source report limits', p => p.components[1].preview.report.native.limits.nativeComparisonMM = 1],
  ['source report count', p => p.components[1].preview.report.native.edgeCount = 14],
  ['missing chunk', p => p.components[1].preview.mesh.chunks.pop()], ['duplicate face', p => p.components[1].preview.mesh.chunks[1].nativeFaceId = p.components[1].preview.mesh.chunks[0].nativeFaceId],
  ['duplicate token', p => p.components[1].preview.mesh.chunks[1].faceToken = p.components[1].preview.mesh.chunks[0].faceToken],
  ['nonfinite', p => p.components[1].preview.mesh.chunks[0].positionsMM[0] = NaN], ['missing UV', p => p.components[1].preview.mesh.chunks[0].parametersUV.pop()],
  ['local index', p => p.components[1].preview.mesh.chunks[0].indices[0] = 999], ['orientation', p => p.components[1].preview.mesh.chunks[6].faceOrientation = 'forward'],
  ['reversed complete panel', p => { const c = p.components[1].preview.mesh.chunks[0]; for (let i = 0; i < 6; i += 3) [c.indices[i + 1], c.indices[i + 2]] = [c.indices[i + 2], c.indices[i + 1]]; }],
  ['degenerate panel UV', p => { const c = p.components[1].preview.mesh.chunks[0]; c.parametersUV[2] = c.parametersUV[0]; c.parametersUV[3] = c.parametersUV[1]; }],
  ['panel range', p => p.components[1].preview.provenance[4].panels[1].indexRange[0]++], ['panel missing', p => p.components[1].preview.provenance[4].panels.pop()],
  ['panel source normal', p => p.components[1].preview.report.native.normalObservations[0].normal[0] = 1],
  ['source normal inventory', p => p.components[1].preview.report.native.normalObservations[0] = structuredClone(p.components[1].preview.report.native.normalObservations[1])],
  ['annular continuity', p => { const chunk = p.components[1].preview.mesh.chunks[4]; chunk.positionsMM[3] = 80; chunk.positionsMM[4] = 40; }],
  ['surface identity', p => p.components[1].preview.provenance[0].nativeSurfaceId = 'other'], ['cap inner loop', p => p.components[1].lineage.faces[4].innerLoopIds = []],
  ['missing native loop', p => p.components[1].lineage.loops.pop()], ['edge use identity', p => p.components[1].lineage.loops[0].uses[0].id = 'other'],
  ['native vertex position', p => p.components[1].lineage.vertices[0].point[0] = 12],
  ['edge curve identity', p => p.components[1].lineage.edges[0].curveId = p.components[1].lineage.edges[1].curveId],
  ['provenance edge', p => p.components[1].preview.provenance[0].nativeEdgeIds[0] = 'other'],
  ['invented normal source', p => p.components[1].preview.mesh.chunks[0].normalSource = 'mesh-computed'],
  ['bad hidden blank', p => p.components[0].component.mesh.indices[0] = 999],
  ['bad hidden blank graph', p => p.components[0].component.lineage.graph.edges.pop()],
  ['ring inventory', p => p.components[1].preview.report.ringParameters[1] = .125],
  ['fake report volume certification', p => p.components[1].preview.report.native.referenceSemantics = 'certified'],
  ['oversized mesh', p => p.components[1].preview.mesh.chunks[0].positionsMM = Array(23815).fill(0)],
  ['symbol', p => p[Symbol('hidden')] = 1], ['cycle', p => p.components[1].lineage.extra = p],
];
for (const [label, mutate] of mutations) {
  const broken = structuredClone(packet); mutate(broken);
  for (const selected of ['plate', 'blank']) assert.throws(() => prepare(broken, 1, selected), undefined, label + ' (visible=' + selected + ')');
}
let getterCalls = 0; const accessor = structuredClone(packet);
Object.defineProperty(accessor.components[1].preview, 'report', { enumerable: true, get() { getterCalls++; return plate.preview.report; } });
assert.throws(() => prepare(accessor)); assert.equal(getterCalls, 0);
assert.throws(() => prepare(packet, 1, 'absent')); assert.throws(() => prepare(packet, 0));
// Actual renderer camera limits can refuse otherwise accepted native geometry. No automatic rescaling.
assert.throws(() => prepare(packet, 1 / 2048), /scene|Camera|camera/i);
const causes = error => { const messages = []; while (error) { messages.push(error.message); error = error.cause; } return messages.join(' / '); };
// Deliberately modified display-only transport, not a claim of a new native run.
const scaled = structuredClone(packet), scale = 20, scaledHole = scaled.components[1], scaledNative = scaledHole.preview.report.native;
for (const chunk of scaledHole.preview.mesh.chunks) chunk.positionsMM = chunk.positionsMM.map(v => v * scale);
for (const vertex of scaledHole.lineage.vertices) vertex.point = vertex.point.map(v => v * scale);
scaledNative.boundsMM.max = scaledNative.boundsMM.max.map(v => v * scale); scaledNative.clearanceMM = scaledNative.clearanceMM.map(v => v * scale);
for (const observation of scaledNative.normalObservations) observation.pointMM = observation.pointMM.map(v => v * scale);
for (const observation of scaledHole.preview.report.cornerRayObservations) observation.cornerMM = observation.cornerMM.map(v => v * scale);
scaledNative.referenceVolumeMM3 *= scale ** 3; scaledNative.referenceCapAreaMM2 *= scale ** 2; scaledNative.referenceCavityAreaMM2 *= scale ** 2;
assert.throws(() => prepare(scaled), error => /Camera.eye.*bounded/.test(causes(error)));
const oversizedGeometryScene = structuredClone(scene.scene); oversizedGeometryScene.geometries[0].positions = oversizedGeometryScene.geometries[0].positions.map(v => v * scale);
assert.throws(() => prepareEngineScene(oversizedGeometryScene), error => /1000 scene units/.test(causes(error)));
const longNormal = structuredClone(packet), wall = longNormal.components[1].preview.mesh.chunks[6];
wall.normals = wall.normals.map(v => v * (1 + 2e-6));
for (const panel of longNormal.components[1].preview.provenance[6].panels) panel.normal = panel.normal.map(v => v * (1 + 2e-6));
prepareKernelFacePreview(longNormal.components[1].preview.mesh, { displayId: 'plate', packetRevision: 0 });
assert.throws(() => prepare(longNormal), error => /unit length within 1e-6/.test(causes(error)));
const legacyPacket = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json'), 'utf8'));
const legacy = prepare(legacyPacket); assert.equal(legacy.scene.geometries.length, 2); assert.deepEqual(legacy.packet, legacyPacket);
assert.deepEqual(Object.keys(legacy), ['packet', 'view', 'scene']);
writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ ok: true, fixtureSHA256: sha256, envelopeAdaptation: 'request/document/revision metadata only; mesh arrays, native bodies, provenance and reports unchanged',
  faces: 7, vertices: vertexOffset, triangles: indexOffset / 3, malformedControls: mutations.length, hiddenAdmission: ['blank', 'plate'],
  rays: ['aperture miss', 'cap material hit', 'inward cavity hit', 'blank center hit'], qualifiedNativeSolid: true, sampledPreviewSolid: false,
  copiedAuthorityRefused: true, rendererBoundsRetained: true, evidence: 'actual retained native mesh -> existing EngineScene CPU preparation/raycast; no native campaign, browser interactions or GPU pixels' }, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, faces: 7, vertices: vertexOffset, triangles: indexOffset / 3, malformedControls: mutations.length, fixtureSHA256: sha256, evidence: 'CPU native-mesh admission and picking only' }));
