import { cad, type CadModelSnapshot, type CadShape, type CadParameter, type CadSplit, type CadDimensionExpression } from '../src/index.js';
const model = cad.model();
const width: CadParameter = model.parameter('width', 80);
const plate: CadShape = model.sketch.rectangle({ min: [0, 0], max: [width, 60] }).extrude(10);
const result: CadModelSnapshot = model.build({ plate });
const wider = result.withParameters({ width: 100 });
const reopened = cad.load(wider.save());
reopened.bodies.plate.certificate.volumeMM3;
const serial = cad.model(), setback = serial.parameter('setback', 1);
const blank = serial.sketch.polygon([[0,0],[32,0],[32,16],[16,32],[0,32]]).extrude(8);
const tool = serial.sketch.rectangle({ min: [8,-16], max: [16,48] }).extrude(8);
const cut = blank.cut(tool, { axis: 'x' });
const part = cut.positive.chamfer(cut.positive.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), setback);
serial.build({ part, other: cut.negative });
// @ts-expect-error Public cut is cardinal through-slab only.
blank.cut(tool, { axis: 'z' });
// @ts-expect-error Scalar parameter values have explicit mm number input.
model.parameter('bad', '8');
const overlapModel = cad.model();
const left = overlapModel.sketch.rectangle({ width: 16, height: 16 }).extrude(8);
const right = overlapModel.sketch.rectangle({ min: [8, 0], max: [24, 16] }).extrude(4);
const overlap: CadShape = left.intersect(right);
const overlapResult: CadModelSnapshot = overlapModel.build({ overlap });
overlapResult.features[4].dependencies;
// @ts-expect-error Intersection accepts a same-model shape handle, not a serialized reference.
left.intersect({ node: 3, side: 'solid' });
const splitModel = cad.model();
const splitHeight = splitModel.parameter('splitHeight', 2);
const splitBlank = splitModel.sketch.rectangle({ width: 16, height: 8 }).extrude(8);
const halves: CadSplit = splitBlank.split({ axis: 'z', at: splitHeight });
const splitResult: CadModelSnapshot = splitModel.build({ lower: halves.negative, upper: halves.positive });
splitResult.withParameters({ splitHeight: 4 }).save();
for (const axis of ['x', 'y'] as const) {
  const m = cad.model(), location = m.parameter('splitAt', 2);
  const parts: CadSplit = m.sketch.rectangle({ width: 16, height: 8 }).extrude(8).split({ axis, at: location });
  m.build({ negative: parts.negative, positive: parts.positive });
}
// @ts-expect-error Split uses a cardinal axis, not an arbitrary plane description.
splitBlank.split({ axis: 'w', at: 2 });
// @ts-expect-error The plane location uses a number or owned dimension handle.
splitBlank.split({ axis: 'z', at: '2' });

const chainModel = cad.model(), frontDistance = chainModel.parameter('frontDistance', 1), backDistance = chainModel.parameter('backDistance', 2);
const chainBlank = chainModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const front = chainBlank.chamfer(chainBlank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
const finished = front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance);
chainModel.build({ finished }).withParameters({ backDistance: 3 }).save();

const reusedFeatureIndices: readonly number[] = reopened.recomputation.reusedFeatures;
const evaluatedFeatureIndices: readonly number[] = reopened.recomputation.evaluatedFeatures;
void reusedFeatureIndices; void evaluatedFeatureIndices;
// @ts-expect-error Recompute diagnostics are immutable derived data.
reopened.recomputation.reusedFeatures.push(0);
// @ts-expect-error There is no caller-supplied reuse/cache parameter.
reopened.withParameters({ width: 80 }, { evidence: [] });

const dividedRail: CadSplit = finished.split({ axis: 'x', at: chainModel.parameter('splitAt', 16) });
chainModel.build({ negative: dividedRail.negative, positive: dividedRail.positive }).withParameters({ splitAt: 8 });

const derivedModel = cad.model(), drivenWidth = derivedModel.parameter('width', 32), offset = derivedModel.parameter('offset', 0);
const midpoint: CadDimensionExpression = derivedModel.dimension.add(derivedModel.dimension.scale(drivenWidth, .5), offset);
const drivenBlank = derivedModel.sketch.rectangle({ width: drivenWidth, height: derivedModel.dimension.add(12, 12) }).extrude(8);
const drivenHalves = drivenBlank.split({ axis: 'x', at: midpoint });
derivedModel.build({ negative: drivenHalves.negative, positive: drivenHalves.positive }).withParameters({ width: 40, offset: 4 });
// @ts-expect-error Scale is a numeric dimensionless factor, not a length handle.
derivedModel.dimension.scale(drivenWidth, drivenWidth);
// @ts-expect-error No expression strings or parser API.
derivedModel.dimension.add(drivenWidth, 'offset');
// @ts-expect-error Expression metadata is readonly, and never editable formula input.
midpoint.kind = 'other';

const miterModel = cad.model(), cutPosition = miterModel.parameter('cutPosition', 24);
const miterBlank = miterModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const miterParts: CadSplit = miterBlank.split({ plane: 'x+y', at: miterModel.dimension.add(cutPosition, 0) });
miterModel.build({ negative: miterParts.negative, positive: miterParts.positive }).withParameters({ cutPosition: 28 });
// @ts-expect-error Axis and plane are mutually exclusive even on a non-literal variable.
const bothPlanes: Parameters<CadShape['split']>[0] = { axis: 'x', plane: 'x+y', at: 24 };
void bothPlanes;
// @ts-expect-error One axis or fixed plane is required.
miterBlank.split({ at: 24 });
// @ts-expect-error Only the fixed x+y plane enum is supported.
miterBlank.split({ plane: 'x-y', at: 24 });
// @ts-expect-error Arbitrary normals are not an admitted plane option.
miterBlank.split({ normal: [1,1,0], at: 24 });

const finishModel = cad.model(), finishBlank = finishModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const finishEdge = finishBlank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one();
const optionalFinish: CadShape = finishBlank.chamfer(finishEdge, 1, { name: 'frontFinish' });
const finishSnapshot = finishModel.build({ part: optionalFinish });
const configured: CadModelSnapshot = finishSnapshot.withSuppression({ frontFinish: true });
const finishStates: Readonly<Record<string, boolean>> = configured.suppression;
void finishStates; configured.features[2].name; configured.features[2].suppressed;
// @ts-expect-error Finishing states are strict booleans, not numeric dimensions.
finishSnapshot.withSuppression({ frontFinish: 1 });
// @ts-expect-error Configuration is readonly.
finishSnapshot.suppression.frontFinish = true;
// @ts-expect-error Boolean state is not a millimeter parameter value.
finishModel.parameter('enabled', false);
// @ts-expect-error Initial finish options name the feature; they cannot skip initial native validation.
finishBlank.chamfer(finishEdge, 1, { name: 'frontFinish', suppressed: true });
