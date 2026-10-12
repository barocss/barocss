import { cad, type CadModelSnapshot, type CadShape, type CadParameter, type CadSplit } from '../src/index.js';
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
