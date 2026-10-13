import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { translatedPair, proveSnapshot as provePair, provePreview, collectLedgers as collectModelLedgers,
  signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged } from './modeling-translation-fixture.mjs';
import { binary64 } from './stored-circle-prism-solid-fixture.mjs';
import { PRISM_COUNTS } from './modeling-offset-fixture.mjs';
export { translatedPair, provePair, signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged };

// Frozen #1890 schedule. These are reviewed call-site expectations, not hidden
// instrumentation. Imports and all proof helpers perform zero native CAD work.
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 3, sourceModelCalls: 2, coldModelCalls: 1,
  exportCalls: 4, sourceExportCalls: 3, coldExportCalls: 1, tessellations: 4, successfulExports: 3,
  successfulPrisms: 3, successfulCopies: 2, encodingCollapseRefusals: 1,
  standaloneValidators: 0, massQueries: 0, cpuBufferPreparations: 0, samplingQueries: 0,
  sourceDerived: { standaloneSuccessfulSketchCompilations: 3, totalSolverAttempts: 6,
    prismSourceCompilations: 39, prismBindingObservations: 432, prismD1: 1296,
    translationParentValidationCount: 2, parentSourceCompilations: 12, parentBindingObservations: 144, parentD1: 432,
    targetQualificationCount: 2, targetSourceCompilations: 12, targetBindingObservations: 144, targetD1: 432,
    exportParentValidationCount: 4, exportSourceCompilations: 24, exportBindingObservations: 288, exportD1: 864,
    initialFaceConstructionCount: 12, initialFaceSourceCompilations: 12, initialFaceBindingObservations: 144, initialFaceD1: 432,
    returnedLedgerSourceCompilations: 87, returnedLedgerBindingObservations: 1008, returnedLedgerD1: 3024,
    knownSourceCompilations: 102, combinedBindingObservations: 1152, knownD1: 3456 },
  fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const SOURCE_ACCOUNTING = Object.freeze({ returnedLedgerSourceCompilations: 56, returnedLedgerBindingObservations: 648,
  returnedLedgerD1: 1944, knownSourceCompilations: 64, combinedBindingObservations: 720, knownD1: 2160,
  initialFaceConstructionCount: 6, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const COLD_ACCOUNTING = Object.freeze({ returnedLedgerSourceCompilations: 31, returnedLedgerBindingObservations: 360,
  returnedLedgerD1: 1080, knownSourceCompilations: 38, combinedBindingObservations: 432, knownD1: 1296,
  initialFaceConstructionCount: 6, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const WHOLE_ACCOUNTING = Object.freeze({ returnedLedgerSourceCompilations: 87, returnedLedgerBindingObservations: 1008,
  returnedLedgerD1: 3024, knownSourceCompilations: 102, combinedBindingObservations: 1152, knownD1: 3456,
  initialFaceConstructionCount: 12, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const BOUNDS = Object.freeze({ left: { min: [0, 0, 0], max: [40, 24, 8] }, right: { min: [48, 0, 0], max: [88, 24, 8] },
  thin: { min: [0, 0, 9999], max: [2, 2, 9999 + 1 / 4096] } });
export function thinPlate(cad) {
  const model = cad.model(), part = model.sketch.rectangle({ width: 2, height: 2 }).extrude(1 / 4096, { from: 9999 });
  return { model, part, build: () => model.build({ thin: part }) };
}

// Independent represented-binary64 arithmetic. No production rational context,
// mesh validator, mass query or geometry evaluator is used by these oracles.
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const q = (n, d = 1n) => { const g = gcd(n, d); return { n: n / g, d: d / g }; };
const zero = q(0n), add = (a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => q(a.n * b.d - b.n * a.d, a.d * b.d), mul = (a, b) => q(a.n * b.n, a.d * b.d);
const fraction = a => ({ numerator: String(a.n), denominator: String(a.d) });
const dot = (a, b) => a.reduce((sum, x, i) => add(sum, mul(x, b[i])), zero);
const cross = (a, b) => [sub(mul(a[1], b[2]), mul(a[2], b[1])), sub(mul(a[2], b[0]), mul(a[0], b[2])), sub(mul(a[0], b[1]), mul(a[1], b[0]))];
const difference = (a, b) => a.map((x, i) => sub(x, b[i]));
const areaCross = points => { const [a, b, c] = points.map(p => p.map(binary64)); return cross(difference(b, a), difference(c, a)); };
const bounds = points => ({ min: [0, 1, 2].map(i => Math.min(...points.map(p => p[i]))), max: [0, 1, 2].map(i => Math.max(...points.map(p => p[i]))) });
function orientedVolume(triangles) {
  const six = triangles.reduce((sum, points) => { const [a, b, c] = points.map(p => p.map(binary64)); return add(sum, dot(a, cross(b, c))); }, zero);
  return fraction(q(six.n, six.d * 6n));
}

// A plain byte consumer, intentionally independent of all STL production code.
// DataView reads every header/count/facet/attribute byte in little-endian order.
export function decodeBinaryStl(input) {
  const bytes = Array.from(input);
  assert.ok(bytes.every((x, i) => Object.hasOwn(bytes, i) && Number.isInteger(x) && x >= 0 && x <= 255));
  assert.ok(bytes.length >= 84);
  const view = new DataView(Uint8Array.from(bytes).buffer), headerText = 'BaroCSS binary STL | mm convention | approximate facets';
  const header = Array.from({ length: 80 }, (_, i) => view.getUint8(i));
  exactData(header, Array.from({ length: 80 }, (_, i) => i < headerText.length ? headerText.charCodeAt(i) : 0));
  const triangleCount = view.getUint32(80, true); assert.equal(bytes.length, 84 + 50 * triangleCount);
  const facets = [];
  for (let index = 0; index < triangleCount; index++) {
    const byteOffset = 84 + 50 * index;
    const scalars = Array.from({ length: 12 }, (_, i) => view.getFloat32(byteOffset + 4 * i, true));
    assert.ok(scalars.every(Number.isFinite));
    const normal = scalars.slice(0, 3), points = [scalars.slice(3, 6), scalars.slice(6, 9), scalars.slice(9, 12)];
    const attributeByteCount = view.getUint16(byteOffset + 48, true); assert.equal(attributeByteCount, 0);
    const exactCross = areaCross(points), alignment = dot(exactCross, normal.map(binary64));
    assert.ok(exactCross.some(x => x.n !== 0n)); assert.ok(alignment.n > 0n);
    assert.ok(Math.abs(Math.hypot(...normal) - 1) <= 1e-5);
    facets.push({ index, byteOffset, normal, points, attributeByteCount,
      float32Bits: Array.from({ length: 12 }, (_, i) => view.getUint32(byteOffset + 4 * i, true)),
      exactCross: exactCross.map(fraction), exactNormalDotCross: fraction(alignment) });
  }
  return { header, triangleCount, byteLength: bytes.length, facets,
    boundsMM: bounds(facets.flatMap(f => f.points)), orientedVolumeMM3: orientedVolume(facets.map(f => f.points)),
    bytesSHA256: sha256(Uint8Array.from(bytes)) };
}

function proveMesh(result, solid, expectedBounds, volume) {
  assert.notEqual(result.solid, solid); exactData(result.solid, solid); exactData(result.options, { maximumFanTriangles: 40 });
  const { mesh, report } = result;
  exactData([mesh.faces.length, mesh.vertices.length, mesh.indices.length, mesh.positionsMM.length], [6, 24, 36, 72]);
  exactData([report.faceCount, report.vertexCount, report.triangleCount], [6, 24, 12]);
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  exactData(report.directCounts, { parentValidationCount: 1, newGeometryEvaluationCount: 0, retries: 0 });
  exactData(report.parentNativeWork, solid.report.childNativeWork);
  exactData([report.parentNativeWork.sourceCompilationCount, report.parentNativeWork.bindingObservationCount, report.parentNativeWork.totalD1Count], [6, 72, 216]);
  const points = mesh.vertices.map((vertex, i) => {
    const point = mesh.positionsMM.slice(3 * i, 3 * i + 3), asset = solid.request.assets.find(a => a.sourceId === vertex.sourceId); assert.ok(asset);
    const face = asset.face; assert.equal(face.options.faceId, vertex.faceId); assert.equal(face.plane.id, vertex.surfaceId);
    const use = face.topology.loop.uses.find(u => u.id === vertex.useId), native = face.topology.vertices.find(v => v.id === vertex.nativeVertexId);
    assert.ok(use && native); assert.equal(use.vertexIds[0], native.id); exactData(point, native.point);
    exactData(point, solid.graph.vertices.find(v => v.id === vertex.solidVertexId).pointMM); return point;
  });
  const triangles = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = mesh.indices.slice(i, i + 3), triangle = ids.map(index => points[index]);
    assert.ok(dot(areaCross(triangle), mesh.normals.slice(ids[0] * 3, ids[0] * 3 + 3).map(binary64)).n > 0n); triangles.push(triangle);
  }
  exactData(bounds(points), expectedBounds); exactData(orientedVolume(triangles), volume);
  assert.equal(report.nativeAuthority, false); assert.equal(report.float32ProjectionCertified, false);
  return { boundsMM: bounds(points), orientedVolumeMM3: orientedVolume(triangles), nativeSHA256: dataHash(result) };
}
export function proveExport(result, snapshot, outputName, { retainedReplay = false } = {}) {
  exactData(Object.keys(result).sort(), ['outputName', 'family', 'format', 'lengthUnit', 'bytes', 'byteLength', 'triangleCount', 'maximumVertexDisplacementMM', 'details'].sort());
  assert.equal(result.outputName, outputName); assert.equal(result.family, 'convex-planar'); assert.equal(result.format, 'binary-stl'); assert.equal(result.lengthUnit, 'mm');
  assert.equal(result.byteLength, 684); assert.equal(result.triangleCount, 12); assert.equal(result.maximumVertexDisplacementMM, 0);
  exactData(Object.keys(result.details).sort(), ['native', 'encoding', 'report'].sort());
  const { native, encoding, report } = result.details, mesh = native.mesh;
  const nativeProof = proveMesh(native, snapshot.bodies[outputName].native, BOUNDS[outputName], { numerator: '6912', denominator: '1' });
  provePreview(native, snapshot.bodies[outputName].native);
  assert.ok(Array.isArray(result.bytes)); assert.equal(result.bytes.length, 684);
  exactData(result.bytes, encoding.bytes); assert.equal(encoding.vertexLosses.length, 24); assert.equal(encoding.facets.length, 12);
  exactData(encoding.maximumSquaredDisplacementMM2, { numerator: '0', denominator: '1' }); assert.equal(encoding.maximumMeasuredDisplacementMM, 0);
  for (const [index, loss] of encoding.vertexLosses.entries()) {
    assert.equal(loss.vertexIndex, index); exactData(loss.sourcePointMM, mesh.positionsMM.slice(3 * index, 3 * index + 3));
    exactData(loss.float32PointMM, loss.sourcePointMM.map(Math.fround));
    exactData(loss.componentLossMM, loss.sourcePointMM.map((v, a) => v - loss.float32PointMM[a]));
    const delta = loss.sourcePointMM.map((v, a) => sub(binary64(v), binary64(loss.float32PointMM[a])));
    exactData(loss.exactSquaredDisplacementMM2, fraction(dot(delta, delta))); assert.equal(loss.measuredDisplacementMM, 0);
  }
  const decoded = decodeBinaryStl(result.bytes);
  for (const [index, facet] of encoding.facets.entries()) {
    const actual = decoded.facets[index], ids = mesh.indices.slice(3 * index, 3 * index + 3);
    const face = mesh.faces.find(f => 3 * index >= f.indexOffset && 3 * index + 3 <= f.indexOffset + f.indexCount); assert.ok(face);
    assert.equal(facet.triangleIndex, index); assert.equal(facet.faceId, face.faceId); exactData(facet.vertexIndices, ids);
    assert.ok(ids.every(i => i >= face.vertexOffset && i < face.vertexOffset + face.vertexCount));
    exactData(actual.points, ids.map(i => encoding.vertexLosses[i].float32PointMM)); exactData(actual.normal, facet.normal);
    assert.equal(facet.byteOffset, actual.byteOffset); assert.equal(facet.attributeByteCount, 0);
    exactData(actual.exactCross, facet.exactCross); exactData(actual.exactNormalDotCross, facet.exactNormalDotCross);
    const [a, b, c] = actual.points, u = b.map((x, i) => x - a[i]), v = c.map((x, i) => x - a[i]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    exactData(actual.normal, normal.map(x => Math.fround(x / Math.hypot(...normal))));
  }
  exactData(decoded.boundsMM, BOUNDS[outputName]); exactData(decoded.orientedVolumeMM3, { numerator: '6912', denominator: '1' });
  exactData([report.vertexCount, report.triangleCount, report.byteLength], [24, 12, 684]);
  exactData(report.directCounts, encoding.directCounts); exactData(report.inheritedMeshReport, native.report);
  exactData(report.rationalCounts, encoding.rationalCounts);
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.byteOrder, 'little-endian'); assert.equal(report.unitSource, 'caller-convention-not-stl-metadata');
  assert.equal(report.hiddenTransitiveNativeWork, 'not-measured');
  for (const name of ['globalTopologyPreservationCertified', 'originalSolidOrientationAfterQuantizationCertified',
    'stlWatertightnessCertified', 'stlManifoldCertified', 'stlEmbeddedSolidCertified', 'manufacturingToleranceCertified',
    'slicerAcceptance', 'rendererAcceptance', 'fileWrittenByAPI', 'fileReadByAPI', 'downloadStartedByAPI']) assert.equal(report.quality[name], false);
  for (const name of ['wholeNativeParentValidated', 'originalMeshRetained', 'parentFlagsUnchanged',
    'allOriginalVerticesCompared', 'float32LossMeasured', 'exactQuantizedCollapseChecked', 'serializationCertified']) assert.equal(report.quality[name], true);
  exactData([report.limits.faces, report.limits.meshVertices, report.limits.triangles, report.limits.binaryBytes,
    report.limits.rationalOperations, report.limits.gcdSteps, report.limits.integerBits], [12, 64, 40, 2084, 200000, 200000, 8192]);
  exactData(report.parentNativeWork, native.report.parentNativeWork);
  exactData(report.directCalls, { tessellationCount: 1, separateMeshValidationCount: 0, retries: 0 });
  const counts = encoding.directCounts;
  exactData([counts.meshValidationCount, counts.vertexCount, counts.coordinateFloat32RoundCount, counts.triangleCount,
    counts.exactCrossCount, counts.normalAlignmentCount, counts.normalFloat32RoundCount,
    counts.encodedFloat32Count, counts.encodedAttributeCount, counts.encodedByteCount], [0, 24, 72, 12, 12, 12, 36, 144, 12, 684]);
  for (const name of ['curveD0Count', 'curveD1Count', 'surfaceD0Count', 'surfaceD1Count', 'sourceCompilationCount', 'rootSolveCount', 'rationalFloatConversionCount', 'fileWriteCount', 'fileReadCount']) assert.equal(counts[name], 0);
  assert.ok(encoding.rationalCounts.operations > 0 && encoding.rationalCounts.operations <= 200000);
  assert.ok(encoding.rationalCounts.gcdSteps <= 200000 && encoding.rationalCounts.maximumObservedBits <= 8192);
  if (!retainedReplay) deepFrozen(result);
  return { outputName, byteLength: result.byteLength, triangleCount: result.triangleCount, maximumVertexDisplacementMM: 0,
    boundsMM: decoded.boundsMM, orientedVolumeMM3: decoded.orientedVolumeMM3, native: nativeProof,
    exportSHA256: dataHash(result), bytesSHA256: decoded.bytesSHA256, encodingSHA256: dataHash(encoding), reportSHA256: dataHash(report),
    independentEveryFacetByteDecoder: true, fullNativeFaceAndVertexLineage: true, deepFrozenInActualProcess: retainedReplay ? null : true,
    ...(retainedReplay ? { replayScope: 'parsed retained packet; original freeze state is not observable' } : {}) };
}
export function proveThin(snapshot) {
  exactData(Object.keys(snapshot.bodies), ['thin']); exactData(snapshot.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1] });
  exactData(snapshot.evidence.map(e => e.kind), ['sketch', 'extrude']);
  const solid = snapshot.bodies.thin.native, prism = snapshot.evidence[1].native;
  assert.equal(snapshot.bodies.thin.family, 'convex-planar'); assert.equal(solid, prism.solid);
  exactData(prism.report.childNativeWork, PRISM_COUNTS); assert.equal(prism.request.options.heightMM, 1 / 4096); assert.equal(prism.request.options.fromMM, 9999);
  exactData(solid.certificate.volumeMM3, { numerator: '1', denominator: '1024' });
  exactData(bounds(solid.graph.vertices.map(v => v.pointMM)), BOUNDS.thin);
  deepFrozen(snapshot); return { exactVolumeMM3: solid.certificate.volumeMM3, boundsMM: BOUNDS.thin, authoredSHA256: sha256(snapshot.save()) };
}
export function proveCollapse(error, CadModelError, thin) {
  // Preserve an earlier genuine refusal, rather than replacing it with an
  // assertion failure or silently adapting/rerunning the agreed specimen.
  if (!(error instanceof CadModelError) || error.operation !== 'exportStl' || error.cause?.code !== 'COLLAPSE') throw error ?? new Error('Expected genuine thin-prism STL COLLAPSE');
  assert.equal(error.code, 'NATIVE'); const cause = error.cause;
  assert.ok(cause instanceof Error); assert.equal(cause.name, 'ModelingStlError'); assert.equal(cause.stage, 'facet');
  const { native, vertexLosses, facets, bytes } = cause.progress;
  assert.ok(native); assert.equal(bytes, null); assert.equal(cause.context.directCounts.encodedByteCount, 0);
  assert.equal(cause.context.directCounts.encodedFloat32Count, 0); assert.equal(cause.context.directCounts.encodedAttributeCount, 0);
  const nativeProof = proveMesh(native, thin.bodies.thin.native, BOUNDS.thin, { numerator: '1', denominator: '1024' });
  assert.equal(vertexLosses.length, 24);
  const upper = 9999 + 1 / 4096;
  for (const [index, loss] of vertexLosses.entries()) {
    exactData(loss.sourcePointMM, native.mesh.positionsMM.slice(3 * index, 3 * index + 3));
    exactData(loss.float32PointMM, loss.sourcePointMM.map(Math.fround)); assert.equal(loss.float32PointMM[2], 9999);
    assert.ok(loss.sourcePointMM[2] === 9999 || loss.sourcePointMM[2] === upper);
    exactData(loss.exactSquaredDisplacementMM2, loss.sourcePointMM[2] === upper
      ? { numerator: '1', denominator: '16777216' } : { numerator: '0', denominator: '1' });
  }
  const index = cause.context.triangleIndex; assert.ok(Number.isInteger(index) && index >= 0 && index < 12);
  const ids = native.mesh.indices.slice(3 * index, 3 * index + 3);
  assert.ok(areaCross(ids.map(i => vertexLosses[i].sourcePointMM)).some(x => x.n !== 0n));
  assert.ok(areaCross(ids.map(i => vertexLosses[i].float32PointMM)).every(x => x.n === 0n));
  // The provider retains the completed vertex phase, never a partially
  // completed facet phase. Attempt counters still identify the first collapse.
  assert.equal(facets.length, 0);
  assert.equal(cause.context.directCounts.triangleCount, index + 1);
  assert.equal(cause.context.directCounts.exactCrossCount, index + 1);
  assert.equal(cause.context.directCounts.normalAlignmentCount, index);
  exactData(cause.context.directCalls, { tessellationCount: 1, separateMeshValidationCount: 0, retries: 0 });
  for (const object of [error, cause, cause.progress]) assert.equal(Object.hasOwn(object, 'bytes') && object.bytes !== null, false);
  return { code: cause.code, stage: cause.stage, triangleIndex: index, native: nativeProof,
    originalNativeDiagnosticRetained: true, exactNonzeroNativeVolumeMM3: { numerator: '1', denominator: '1024' },
    distinctBinary64LevelsCollapseTo9999: true, noBinaryAllocation: true, completedNativeSHA256: dataHash(native),
    completedVertexLossSHA256: dataHash(vertexLosses), directCounts: cause.context.directCounts, rationalCounts: cause.context.rationalCounts };
}
export const emptyLedgers = () => ({ sketches: [], prisms: [], parents: [], targets: [], initialFaces: [], exports: [] });
export function accounting(ledgers, expected) {
  exactData(['sketches', 'prisms', 'parents', 'targets', 'initialFaces', 'exports'].map(k => ledgers[k].length), expected);
  const returned = [...ledgers.prisms, ...ledgers.parents, ...ledgers.targets, ...ledgers.exports], all = [...returned, ...ledgers.initialFaces];
  const sum = (rows, field) => rows.reduce((n, entry) => n + entry.report[field], 0);
  return { returnedLedgerSourceCompilations: sum(returned, 'sourceCompilationCount'), returnedLedgerBindingObservations: sum(returned, 'bindingObservationCount'),
    returnedLedgerD1: sum(returned, 'totalD1Count'), knownSourceCompilations: sum(all, 'sourceCompilationCount') + ledgers.sketches.length,
    combinedBindingObservations: sum(all, 'bindingObservationCount'), knownD1: sum(all, 'totalD1Count'),
    initialFaceConstructionCount: sum(ledgers.initialFaces, 'faceCount'), fullTransitiveNativeCoverage: 'NOT_MEASURED' };
}
export function checkProcess() {
  assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
  assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
}
export function recorder(directory, kind, extra = {}) {
  mkdirSync(directory, { recursive: true }); const receipt = resolve(directory, kind + '-flow.json'), started = performance.now();
  const caps = kind === 'source' ? { modelCalls: 2, exportCalls: 3 } : { modelCalls: 1, exportCalls: 1 };
  const flow = { status: 'running', issue: 1890, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
    startedAt: new Date().toISOString(), groupStartedAtMS: Date.now(), timingScope: 'stage action plus artifact persistence; not isolated kernel timing',
    modelCalls: 0, exportCalls: 0, tessellations: 0, standaloneValidators: 0, massQueries: 0, cpuBufferPreparations: 0, samplingQueries: 0,
    nativeElapsedMS: 0, stages: [], artifacts: {}, returnedLedgers: emptyLedgers(), expectedWholeCampaign: EXPECTED_CAMPAIGN,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', sourceDerivedExpectedWorkIsNotInstrumented: true,
    limits: { heapMiB: 1536, freeDiskMiB: 500, processGroupSeconds: 600 }, externalSerialProcessGroupTimeoutRequired: true, ...extra };
  writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' }); const write = () => writeFileSync(receipt, signedData(flow) + '\n');
  function artifact(filename, value, scope, raw = false) {
    const bytes = raw ? value : signedData(value) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
    writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
    flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write(); return bytes;
  }
  function stage(type, label, action, filename, stlFilename) {
    const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
    assert.ok(Date.now() - flow.groupStartedAtMS < 600000 && flow.nativeElapsedMS < 600000); assert.ok(flow[type] < caps[type]);
    flow[type]++; if (type === 'exportCalls') flow.tessellations++;
    flow.pending = { type, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
    try {
      const result = action(); outcome = 'returned';
      artifact(filename, type === 'modelCalls' ? snapshotData(result) : result, 'complete actual return before fixture oracle');
      if (type === 'modelCalls') collectModelLedgers(flow.returnedLedgers, result, label);
      else {
        flow.returnedLedgers.exports.push({ label, report: result.details.native.report.parentNativeWork });
        if (stlFilename) artifact(stlFilename, Buffer.from(result.bytes), 'actual successful public STL bytes, retained before byte oracle', true);
      }
      return result;
    } catch (error) {
      failure = errorData(error); artifact(filename + '.refusal.json', failure, 'original error, native progress, encoder progress and complete cause before refusal oracle');
      if (type === 'exportCalls' && error.cause?.progress?.native) flow.returnedLedgers.exports.push({ label, report: error.cause.progress.native.report.parentNativeWork });
      throw error;
    } finally {
      const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
      flow.stages.push({ type, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
    }
  }
  function finish() {
    assert.ok(flow.nativeElapsedMS < 600000 && Date.now() - flow.groupStartedAtMS < 600000);
    flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  }
  function fail(error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); }
  return { flow, write, artifact, stage, finish, fail };
}
