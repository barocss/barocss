import assert from 'node:assert/strict';
// #region imports
import {
  evaluateXYAffinePrismFeatureDocument, updateXYAffinePrismFeatureDocument,
  serializeXYAffinePrismFeatureDocument, parseXYAffinePrismFeatureDocument,
  chamferConvexPlanarSolid, XYAffinePrismFeatureError,
  ConvexPlanarSolidChamferError,
} from '@barocss/cad';
// #endregion imports

// #region recipe
function sketchAndPrism(id, coordinates, originXY, spanXY) {
  const points = coordinates.map((position, i) => ({ id: `p${i}`, position }));
  const segments = points.map((p, i) => ({
    id: `s${i}`, startPointId: p.id, endPointId: points[(i + 1) % points.length].id,
  }));
  const sketch = {
    id: `${id}_sketch_node`, kind: 'sketch', sourceId: `${id}_source`, revision: 0,
    document: {
      format: 'barocss-xy-affine-sketch', version: 0,
      profile: 'exact-affine-binary64', id: `${id}_sketch`, lengthUnit: 'mm',
      points, segments, referenceLines: [],
      constraints: points.map(p => ({
        id: `fix_${p.id}`, kind: 'fixed', pointId: p.id, target: [...p.position],
      })),
    },
  };
  const prism = {
    id: `${id}_prism_node`, kind: 'prism', sketchNodeId: sketch.id,
    options: {
      orderedSegmentIds: segments.map(s => s.id), heightMM: 8,
      capChart: { originXY, spanXY }, solidId: `${id}_solid`, resultIdPrefix: id,
    },
  };
  return [sketch, prism];
}
const [partSketch, partPrism] = sketchAndPrism('aa',
  [[-0, 0], [32, 0], [32, 16], [16, 32], [0, 32]], [0, 0], [32, 32]);
const [toolSketch, toolPrism] = sketchAndPrism('bb',
  [[8, -16], [16, -16], [16, 48], [8, 48]], [0, -16], [32, 64]);
const component = (segmentId, solidId, resultIdPrefix) => ({
  reference: {
    sourceId: toolSketch.sourceId, sketchId: toolSketch.document.id,
    sourceRevision: 0, segmentId,
  },
  solidId, resultIdPrefix,
});
const parameter = (id, valueMM, pointIndices, axis) => ({
  id, unit: 'mm', valueMM,
  bindings: pointIndices.map(i => ({
    sketchNodeId: toolSketch.id, constraintId: `fix_p${i}`, axis,
  })),
});
const document = {
  format: 'barocss-xy-affine-prism-feature-document', version: 0,
  id: 'part_document', revision: 0, lengthUnit: 'mm',
  nodes: [partSketch, toolSketch, partPrism, toolPrism, {
    id: 'subtraction_feature', kind: 'subtraction',
    parentPrismId: partPrism.id, toolPrismId: toolPrism.id,
    operationId: 'remove_slab',
    first: component('s3', 'left_part', 'left'),
    second: component('s1', 'right_part', 'right'),
  }],
  parameters: [
    parameter('lowerX', 8, [0, 3], 'x'), parameter('upperX', 16, [1, 2], 'x'),
    parameter('lowerY', -16, [0, 1], 'y'), parameter('upperY', 48, [2, 3], 'y'),
  ],
};
// #endregion recipe

// #region edit
const accepted = evaluateXYAffinePrismFeatureDocument(document);
const transaction = updateXYAffinePrismFeatureDocument(accepted, {
  expectedRevision: 0, revision: 1,
  parameterEdits: [{ parameterId: 'upperX', valueMM: 24 }],
});
const updated = transaction.result;
console.log(accepted.subtraction.report.volumeMM3.remaining); // 5120 / 1 mm³
console.log(updated.subtraction.report.volumeMM3.remaining); // 3328 / 1 mm³
// Save the authored document, not the evaluated result/certificates.
const text = serializeXYAffinePrismFeatureDocument(updated.document);
const reopened = parseXYAffinePrismFeatureDocument(text); // cold evaluation
// #endregion edit

// #region chamfer
// A separate operation on the original uncut parent, not the slab components.
const prism = accepted.prisms[0];
const parent = prism.solid;
const front = prism.lineage.segments.find(segment => segment.segmentId === 's0');
if (!front) throw new Error('Original front segment is missing');
const edge = parent.graph.edges.find(edge => edge.id === front.topEdgeId);
if (!edge) throw new Error('Original top edge is missing');
const reference = u => ({
  sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId,
  loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId,
});
const selection = {
  parentSolidId: parent.request.options.solidId,
  a: reference(edge.uses[0]), b: reference(edge.uses[1]),
};
const options = {
  operationId: 'front_chamfer', resultIdPrefix: 'cham',
  retainedSolidId: 'finished_part', removedSolidId: 'removed_wedge',
};
const chamfer2 = chamferConvexPlanarSolid(parent, selection, 2, options);
const chamfer1 = chamferConvexPlanarSolid(parent, selection, 1, options);
if (chamfer2.split.negative.kind !== 'solid' || chamfer1.split.negative.kind !== 'solid') {
  throw new Error('Expected retained Solid');
}
console.log(chamfer2.split.negative.solid.certificate.volumeMM3); // 7104 / 1 mm³
console.log(chamfer1.split.negative.solid.certificate.volumeMM3); // 7152 / 1 mm³
// #endregion chamfer

const fraction = n => ({ numerator: String(n), denominator: '1' });
assert.deepEqual(accepted.subtraction.report.volumeMM3.remaining, fraction(5120));
assert.deepEqual(updated.subtraction.report.volumeMM3.remaining, fraction(3328));
assert.deepEqual(reopened.document, updated.document);
assert.deepEqual(reopened.subtraction.report.volumeMM3.remaining, fraction(3328));
assert.equal(Buffer.byteLength(text), 3641);
assert.ok(Object.is(reopened.document.nodes[0].document.points[0].position[0], -0));
assert.deepEqual(updated.prisms[0], accepted.prisms[0]);
assert.deepEqual(transaction.transaction.report.actions.map(a => a.action),
  ['retained', 'rebuilt', 'retained', 'rebuilt', 'rebuilt']);
assert.deepEqual(parent.certificate.volumeMM3, fraction(7168));
assert.deepEqual(chamfer2.split.negative.solid.certificate.volumeMM3, fraction(7104));
assert.deepEqual(chamfer1.split.negative.solid.certificate.volumeMM3, fraction(7152));
const before = structuredClone(accepted);
assert.throws(() => updateXYAffinePrismFeatureDocument(accepted, {
  expectedRevision: 9, revision: 1, parameterEdits: [{ parameterId: 'upperX', valueMM: 24 }],
}), e => e instanceof XYAffinePrismFeatureError && e.code === 'REVISION');
assert.throws(() => chamferConvexPlanarSolid(parent, selection, 0, options),
  e => e instanceof ConvexPlanarSolidChamferError && e.code === 'METRIC');
assert.deepEqual(accepted, before);
console.log(JSON.stringify({
  flow: 'authored sketch-prism-slab/edit/codec; separate original-edge chamfer',
  remainingMM3: [5120, 3328], parentMM3: 7168, retainedChamferMM3: [7104, 7152],
  authoredBytes: Buffer.byteLength(text), sourceOnlyCodec: true,
  priorValidation: transaction.transaction.report.validation,
  selectiveCandidate: transaction.transaction.report.candidate,
  refusals: ['stale document revision', 'zero chamfer distance'],
  browser: 'not run', gpu: 'not run', emittedPackage: 'not run',
}));
